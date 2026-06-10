# 🤖 Rosey Research Partner

A premium, multi-user web application designed to track, scrape, summarize, and prioritize research topics using **Ollama Cloud** and **Tailwind CSS v4** with a dark glassmorphic design.

---

## ✨ Features

- **🔐 Multi-User Authentication**: Register and log in securely. Uses custom JWT sessions stored in secure HTTP-only cookies and hashes passwords with bcrypt.
- **📁 Topic-Based Workspaces**: Organize your research into distinct topics (e.g. *AI Agents*, *Quantum Computing*, *Web Frameworks*).
- **💡 AI URL Recommendations**: Stuck on where to start researching? Click "Suggest Sources", and the AI will analyze your topic and recommend 5-6 authoritative articles or official documentation sites.
- **🕸️ Robotic Web Ingestor**: 
  - Scrapes target websites via the fast, serverless-friendly **Jina Reader API**.
  - Bypasses JavaScript-rendering blocks and provides clean markdown formatting.
- **🧠 Cybernetic Summarizer & Prioritization**: 
  - Connects to your **Ollama Cloud** (or custom OpenAI-compatible) endpoint.
  - Automatically summarizes content and extracts key takeaways.
  - Calculates a general relevance score (1-10) and provides a clear scoring justification.
  - Auto-sorts your articles on the dashboard by priority.
- **🎭 Fancy Robotic Scanner UI**: Clicking "Start Research" triggers glowing neon scanlines, card outlines that pulse to indicate scraping states, and a rolling cybernetic terminal showing real-time logs of the AI's state.
- **📄 High-Fidelity PDF Export**: Compiles summaries, scores, takeaways, and bibliography into a formatted, multi-page PDF report.

---

## 🛠️ Tech Stack

- **Framework**: [Next.js (App Router)](https://nextjs.org/) + React 19
- **Database**: [Neon Serverless Postgres](https://neon.tech/)
- **ORM**: [Prisma ORM](https://www.prisma.io/)
- **Styling**: [Tailwind CSS v4](https://tailwindcss.com/) (Dark Mode Glassmorphism Theme)
- **Security**: JWT (`jose`), `bcryptjs`, and Next.js Middleware guards
- **Scraper**: [Jina Reader API](https://jina.ai/)
- **LLM API**: OpenAI-compatible API client connecting to **Ollama Cloud**
- **PDF Compiler**: `jsPDF` + `html2canvas`

---

## 🚀 Getting Started

### 1. Prerequisites
- [Node.js](https://nodejs.org/) (v18.x or higher)
- A [Neon Postgres](https://neon.tech/) account (free database URL)
- Access to your **Ollama Cloud** (or OpenAI-compatible) endpoint and API key.

### 2. Installation
Clone the repository and install dependencies:
```bash
npm install
```

### 3. Environment Setup
Create a `.env` file in the root of the project and add the following keys:

```env
# Database connection (Neon Postgres connection string)
DATABASE_URL="postgresql://user:password@ep-xxxx-xxxx.us-east-2.aws.neon.tech/neondb?sslmode=require"

# Session JWT secret (used to sign user auth cookies)
JWT_SECRET="generate-a-secure-random-string-here"
```

### 4. Database Setup & Migrations
Initialize the Neon database schema with Prisma:
```bash
# Push the schema structure to your Neon database
npx prisma db push

# Generate the Prisma Client
npx prisma generate
```

### 5. Running Locally
Start the development server:
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 📂 Project Structure

```text
├── prisma/
│   └── schema.prisma        # Database models (User, Topic, WatchedUrl)
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   ├── auth/        # Login/Register API endpoints
│   │   │   ├── research/    # Scraper & Ollama LLM processor routes
│   │   │   └── suggestions/ # AI URL recommendations generator
│   │   ├── dashboard/       # Main workspace and robotic research hub
│   │   ├── login/           # Flip-card authentication screen
│   │   ├── globals.css      # Custom animations, variables & Tailwind setup
│   │   ├── layout.tsx       # Root document layout with fonts
│   │   └── page.tsx         # Welcome / Landing page
│   ├── components/          # Reusable glassmorphic UI elements
│   ├── lib/                 # Utility files (db connection, auth helpers)
│   └── middleware.ts        # Guard for dashboard and secure API paths
├── package.json
└── README.md
```

---

## 📡 API Configuration
To configure the AI research partner, open the **Settings** drawer in the dashboard and input:
1. **Ollama Cloud Base URL** (e.g., `https://api.ollamacloud.com/v1` or your custom server/tunnel URL).
2. **Ollama API Key**.
3. **Model Name** (e.g., `llama3.1`, `mistral`).

These credentials are saved locally in your browser's `localStorage` and never sent to any server other than your designated Ollama Cloud endpoint.

---

## 📄 License
This project is open-source and available under the [MIT License](LICENSE).
