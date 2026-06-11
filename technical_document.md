# 🤖 Nexus Research Partner - System Architecture & Ingestion Mechanics

This document provides a deep technical review of how **Nexus Research Partner** operates. It outlines the cognitive pipelines for URL recommendation, content ingestion, summarization, priority scoring, dual-model validation, and multi-stage deep-dives.

---

## 1. URL Recommendations ("Suggest Sources")

When a researcher initiates a suggestion sequence for an active topic workspace, the engine calculates source recommendations through a structured prompt loop:

1. **Context Extraction:** The system retrieves the topic's `name` and `description` from the database.
2. **LLM Cognitive Core:** The system instructs the Primary LLM to act as an expert research analyst. The model is prompted with a structured instruction set:
   * Analyze the domain space of the topic.
   * Recommend 5 to 6 highly authoritative reference URLs (e.g., official documentation, GitHub repositories, peer-reviewed preprints, or major industry technical articles).
   * Fall back to constructing realistic, high-value reference links on official domains (such as `react.dev`, `developer.mozilla.org`, `arxiv.org`, `web.dev`) if direct URL addresses are not cached in the model's memory.
3. **Structured Response Format:** The LLM is restricted to a JSON array output conforming to:
   ```json
   [
     {
       "url": "https://example.com/reference-guide",
       "name": "Descriptive Link Label"
     }
   ]
   ```
4. **Watchlist Duplication Filter:** The returned list is passed through a reactive filter on the client. Any recommended URL that is already monitored in the workspace watchlist is automatically pruned from the recommendations panel, preventing duplicate research jobs.

---

## 2. Web Ingestion & Content Scraping

When the ingestion engine runs, it accesses web content via a dual-layer scraping system designed to bypass paywalls, scripts, and layout markup:

```
                  ┌───────────────────────────────┐
                  │          Scrape URL           │
                  └──────────────┬────────────────┘
                                 │
                 ┌───────────────┴───────────────┐
                 │  Primary: Jina Reader API     │
                 └───────────────┬───────────────┘
                                 │
                       ┌─────────┴─────────┐
             Succeeded │                   │ Failed
                       ▼                   ▼
            [Markdown parsed]     [Direct GET Request]
                       │                   │
                       │                   ▼
                       │          [HTML Tag Stripper]
                       │                   │
                       └─────────┬─────────┘
                                 │
                                 ▼
                     [First 12,000 Characters]
                                 │
                                 ▼
                      [LLM Ingestion Core]
```

1. **Jina Reader API (Primary):**
   * The scraper requests the target URL prefixed with the Jina Reader edge parser: `https://r.jina.ai/{URL}`.
   * Jina Reader fetches the page, renders dynamic Javascript elements, strips headers, sidebars, cookie banners, ads, and navigation wrappers, and returns the core page text formatted as clean **Markdown**.
2. **Direct Fetch Fallback (Secondary):**
   * If Jina Reader is blocked, times out, or returns a non-200 code, the backend triggers a direct fetch using fake browser User-Agent headers.
   * The received HTML body is cleaned using regex patterns to remove scripts, styles, header tags, and structural tags, leaving only raw paragraph text.
3. **Context Length Slicing:**
   * To prevent large documentation sites from overflowing LLM context windows or inflating token costs, the cleaned Markdown is truncated to the first **12,000 characters** before processing.

---

## 3. Summarization & Key Takeaways

The ingestion engine passes the sliced Markdown content to the Primary LLM Core accompanied by a strict formatting system prompt:

* **Executive Summary:** The model is instructed to write a concise, high-value summary of **3 to 4 sentences** capturing the core findings or architectural patterns of the document.
* **Consolidated Takeaways:** The model extracts **3 to 5 critical takeaways** (e.g., exact benchmarks, code patterns, configuration parameters, or technical steps).
* **Metadata Extraction:** The model parses the page content for a publication date in `YYYY-MM-DD` format (returning `null` if not found).

---

## 4. Priority Scoring & Rationale

To help researchers identify high-value articles, the engine scores each article from **1 to 10** based on information density:

* **Score Spectrum:**
  * **9-10 (Critical):** Official API documentation, raw GitHub source code files, primary research papers, or deep-dive articles containing code snippets and structural examples.
  * **6-8 (High Utility):** Comprehensive tutorials, detailed technical blog posts, or thorough design documents.
  * **3-5 (Medium/Low):** News announcements, surface-level introductory guides, or subjective opinion columns.
  * **1-2 (Irrelevant):** Advertising brochures, marketing landing pages, spam, or clickbait columns.
* **Scoring Justification:** The model must output a **1-sentence rationale** explaining why the score was assigned. This provides clear context directly on the card details dashboard.

---

## 5. Dual-Model Cross-Examination

To prevent AI hallucinations or check summaries, the system supports an optional secondary validation pipeline:

1. **Verification Model:** A secondary LLM (Confirming Model) is configured alongside the primary model.
2. **Review Stage:** The verification core receives the webpage content alongside the primary model's summary, takeaways, and score.
3. **Validation Decision:** The secondary model reviews the output and determines whether it is accurate and relevant to the topic workspace.
4. **Rejection Output:**
   * If rejected, the database updates the status to `FAILED`.
   * The summary and takeaways are saved, but the justification is prefixed with:
     `[REJECTED BY CONFIRMING CORE]: {Rejection reason}`.

---

## 6. Multi-Phase Deep-Dive Agentic Scraper

The Deep-Dive Scraper is designed to run asynchronously, avoiding the timeouts common to serverless environments (like Vercel):

```
┌──────────────────┐      1. Extract Citations      ┌──────────────────┐
│ Parent URL Card  ├───────────────────────────────►│ Deep-Dive API    │
│ (COMPLETED status)│                                │ (Initiate Route) │
└──────────────────┘                                └────────┬─────────┘
                                                             │
                                                             │ 2. Create Sub-sources
                                                             ▼
┌──────────────────┐      3. Auto-Scrape Queue      ┌──────────────────┐
│ Frontend Watcher ├───────────────────────────────►│ DB Watchlist     │
│ (Active Process) │                                │ (PENDING status) │
└──────────────────┘                                └────────┬─────────┘
                                                             │
                                                             │ 4. Compile Synthesis
                                                             ▼
┌──────────────────┐                                ┌──────────────────┐
│ Tabbed UI Panel  │◄───────────────────────────────┤ Deep-Dive API    │
│ (Markdown view)  │                                │(Synthesize Route)│
└──────────────────┘                                └──────────────────┘
```

* **Phase 1: Discovery (Initiate Endpoint):**
  * The researcher clicks "Deep Dive" on a completed URL.
  * The backend uses the LLM to scan the parent article's Markdown and extract the top 2-3 external citations or related sub-topics.
  * These 2-3 links are inserted into the database in a `PENDING` state with `parentId` set to the parent URL's ID.
* **Phase 2: Queue Scrape:**
  * The client's active watchlist queue detects the newly added `PENDING` sub-sources.
  * The client automatically starts scraping, summarizing, and scoring them sequentially.
* **Phase 3: Mesh Synthesis (Synthesize Endpoint):**
  * Once all sub-sources are successfully processed (`COMPLETED` or `FAILED`), the user compiles the synthesis.
  * The backend loads the parent document details and the data of all sub-sources.
  * The LLM synthesizes this mesh into a comprehensive comparative Markdown report featuring:
    1. *Executive Metadata & Comparative Overview*
    2. *Sub-source Cognitive Mesh*
    3. *Convergence & Divergence (Cross-examination)*
    4. *Synthesized System Takeaways*
  * The report is stored in `deepDiveReport` on the parent URL and rendered in the dashboard details panel.
