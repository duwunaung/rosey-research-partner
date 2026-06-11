# 🤖 Nexus Research Partner (v1.5.1)

> **A premium, state-of-the-art cybernetic research workstation designed to track, scrape, analyze, and synthesize research topics using advanced LLMs and high-fidelity network meshes.**

Nexus Research Partner combines modern **dark-mode glassmorphism** aesthetics with powerful agentic pipelines to turn unstructured web URLs into a cohesive, prioritized knowledge catalog.

---

## ⚡ Key Features

* **🔐 Cyber-Secure Authentication**: Secure password hashing with `bcryptjs` and session tracking using signed JWTs stored in secure, edge-compatible HTTP-only cookies.
* **📁 Topic-Based Workspaces**: Segment research into modular workspace nodes (e.g., *Quantum Algorithms*, *AI Agents*, *Distributed Databases*).
* **💡 AI URL Recommendations**: Generate instant, highly relevant documentation and article source suggestions with a single click. Matches against your active watchlist to prevent duplicate additions.
* **🕸️ Interactive Knowledge Graph / Mesh**: 
  * Visualize your research database as a dynamic, interactive spring-physics network graph.
  * Drag-and-drop nodes to explore connections.
  * Auto-links sub-sources to parent documents, and dynamically maps cross-article links based on title keyword overlaps.
  * Hover nodes for real-time cognitive metrics.
* **🔍 Deep-Dive Agentic Scraper**: 
  * Trigger autonomous citation deep-dives on researched articles.
  * The agent reads the page, discovers critical sub-concepts, scrapes those sub-sources, and compiles a comprehensive **Markdown Synthesis Report** highlighting convergences and contradictions.
* **🧠 Prioritization Engine**: Scrapes clean Markdown content via the **Jina Reader API**, summarizes articles, extracts actionable takeaways, and calculates relevance scores (1-10) with detailed justifications using your configured LLM cores.
* **🎭 Futuristic Live Console**: Watch the AI work in real-time through the scrolling Terminal feed, complete with scanline shaders, pulsing state indicators, and glowing telemetry text.
* **📄 Document Digest Compiler**: Compile and download your research summaries, takeaways, scores, and bibliography into a print-ready, multi-page A4 PDF.
* **📱 Progressive Web App (PWA)**: Installable directly to your mobile device or desktop with an offline service worker. Forces landscape orientation on installed PWAs and prompts portrait orientation rotate warnings in browser viewports.

---

## 📐 Architecture & System Flow

```mermaid
graph TD
    User([Researcher]) -->|Access Terminal| WebUI[Next.js App UI]
    WebUI -->|Workspace Management| API_Topics[Topic & URL API]
    API_Topics -->|Sync Schema| DB[(Neon Serverless Postgres)]
    
    %% Research Pipeline
    WebUI -->|Start Ingest| API_Research[Research API Route]
    API_Research -->|Scrape Markdown| Jina[Jina Reader Scraper]
    Jina -->|Raw Markdown| API_Research
    API_Research -->|Query Summary & Score| PrimaryLLM[Primary LLM Core]
    API_Research -->|Optional Cross-Examination| ConfirmLLM[Confirming LLM Core]
    PrimaryLLM & ConfirmLLM -->|Save Results| DB
    
    %% Deep Dive
    WebUI -->|Deep Dive Click| API_DeepDive[Deep-Dive API Routes]
    API_DeepDive -->|Extract Citations| PrimaryLLM
    API_DeepDive -->|Insert Sub-sources| DB
    API_DeepDive -->|Synthesize Mesh| DB
    API_DeepDive -->|Markdown Report| WebUI
    
    %% Network Mesh
    DB -->|Retrieve Node Catalog| WebUI
    WebUI -->|Compute Keyword Overlaps| Graph[Spring-Physics Network Graph]
```

---

## 🛠️ Tech Stack

* **Core Framework**: [Next.js 16 (App Router)](https://nextjs.org/) + React 19
* **Database Engine**: [Neon Serverless Postgres](https://neon.tech/) (PostgreSQL)
* **Object-Relational Mapping (ORM)**: [Prisma ORM v6](https://www.prisma.io/)
* **Aesthetic Styling**: [Tailwind CSS v4](https://tailwindcss.com/) (Custom keyframe scanline, hover pulses, and glassmorphic panels)
* **Auth & Cryptography**: JWT (`jose`) and password hashing (`bcryptjs`)
* **Scraper Core**: [Jina Reader API](https://jina.ai/)
* **Document Compilation**: `jspdf` and `html2canvas-pro` (Fully supports modern Tailwind v4 OKLab/OKLCh colors)

---

## 🚀 Installation & Local Launch

### 1. Clone & Install Dependencies
Clone this repository to your local directory and run install:
```bash
npm install
```

### 2. Environment Configuration
Create a `.env` file in the root directory:
```env
# Neon Postgres Connection String
DATABASE_URL="postgresql://user:password@ep-xxxx-xxxx.us-east-1.aws.neon.tech/neondb?sslmode=require"

# JWT Encryption Key (Ensure this is a strong random secret in production)
JWT_SECRET="nexus-secure-jwt-session-encryption-secret-string"
```

### 3. Sync Database Schema & Generate Models
Push models to your Postgres database and generate the Prisma client:
```bash
npx prisma db push
npx prisma generate
```

### 4. Run Development Workspace
Start the Next.js local server:
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) to access the command terminal.

---

## 📡 LLM Provider Configuration

Nexus supports saved, concurrent configuration states for multiple LLM providers:
1. **Ollama Local**: Direct connections to your local `http://localhost:11434` instance.
2. **Ollama Cloud**: Cloud-hosted instances using API keys.
3. **Groq**: High-speed inference cores.
4. **OpenRouter**: Unified access to top models.

Open the **Settings** panel (cog icon in top-right navbar) to configure provider URLs, API credentials, and target models. Nexus supports typing custom model names or selecting common presets.

---

## 📄 License
This project is open-source software licensed under the [MIT License](LICENSE).
