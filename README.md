# 📚 Planner — Local-First AI Study & Task Management Platform

**Planner** is a feature-rich, local-first study and schedule planner designed to help learners and professionals structure their goals, manage study blocks, track productivity, and query reference materials with local AI. Powered by **React 19**, **Express**, **SQLite**, and **Ollama local LLMs**.

---

## 🌟 Key Features

### 🧠 1. AI Study Plan Generator
- **Ollama Integration**: Uses local LLMs (e.g. `llama3.2`, `qwen`, `deepseek`) for 100% private, zero-latency generation.
- **Customized Schedules**: Automatically builds structured, day-by-day study roadmaps based on topic, custom timeframe (1–30 days), and daily available hours.
- **YouTube Playlist Auto-Sync**: Automatically fetches videos and metadata from YouTube playlists to insert relevant video study blocks.
- **Resource Integration**: Automatically links pre-indexed reference documentation (React, Python, PyTorch, Rust, Next.js, etc.) into daily plans.

### 📅 2. Time Blocking & Schedule Views
- **Weekly Grid**: 7-day interactive time-blocking grid for easy scheduling and overview of your week.
- **Daily View**: Granular hourly timeline showing current tasks, completion status, priority badges, and estimated vs. spent time.
- **Category & Priority System**: Organize tasks with custom categories (Study, Work, Personal, Fitness, etc.), distinct color themes, and priority levels.

### 💬 3. RAG (Retrieval-Augmented Generation) Chat
- **Document & Resource Chat**: Ask questions and chat directly with your saved study materials, notes, and indexed documentation.
- **Context-Aware Assistance**: Retrieves relevant context from your library before answering with the local LLM.

### 📖 4. Resources & Knowledge Base Library
- **Centralized Reference Hub**: Save, tag, and search links, articles, code snippets, documentation, and video tutorials.
- **Fast Search**: Instant filtering and document discovery integrated into study planning.

### 🔥 5. Heatmap Streak & Adherence Analytics
- **GitHub-style Contribution Heatmap**: Visual streak calendar tracking study consistency and task completions across months.
- **Productivity Telemetry**: Monitor daily completion percentages, adherence rates, and accumulated focus hours.

### 💡 6. AI Schedule Suggestions & Rest Break Optimizer
- **Smart Workload Analysis**: Analyzes current workload, completion stats, and study patterns.
- **☕ Automatic Break Detection**: Scans your schedule for heavy continuous sessions (≥90 mins) or back-to-back blocks with zero gaps and recommends 15-minute rest breaks.
- **1-Click Rest Insertion**: 1-click button directly inserts rest blocks into your schedule in SQLite.

### 📝 7. Weekly Review & Reflection
- **End-of-Week Retrospective**: Dedicated modal to log weekly accomplishments, key learnings, overall mood/rating, and goal adjustments.

### ⚡ 8. Quick Capture (`Ctrl + K` / `Cmd + K`)
- **Global Quick Capture**: Rapidly capture ideas, tasks, or study blocks from anywhere in the app using keyboard shortcuts.

### ☁️ 9. Cloud Sync & Automatic Backup (MEGA Cloud)
- **Automatic SQLite Backup**: Background database sync with MEGA cloud storage to safeguard your data.
- **Manual Backup & Restore**: One-click database export/import options.

### 🌐 10. Local-First & Offline Ready
- **Privacy & Speed**: All core user data is stored locally in SQLite (`planner.db`).
- **Offline Banner**: Network connection monitoring ensures awareness during offline sessions.

---

## 🛠️ Tech Stack

### Frontend
- **Framework**: React 19 + TypeScript + Vite
- **Styling**: Tailwind CSS + Custom CSS Variables
- **Animations & Interactivity**: Framer Motion, GSAP, Canvas Confetti
- **Icons**: Lucide React
- **Drag & Drop**: `@dnd-kit/core`, `@dnd-kit/sortable`

### Backend
- **Server**: Node.js + Express (TypeScript)
- **Database**: SQLite (`better-sqlite3` with WAL mode)
- **Local AI Engine**: Ollama API (`ollama`)
- **Cloud Backup**: MEGA API (`megajs`)

---

## 🚀 Getting Started

### Prerequisites
- [Node.js](https://nodejs.org/) (v18+)
- [Ollama](https://ollama.com/) (Optional but recommended for AI features; pull your preferred model e.g. `ollama pull llama3.2`)

### 1. Clone & Install Dependencies

```bash
# Frontend
cd frontend
npm install

# Backend
cd ../backend
npm install
```

### 2. Environment Setup

Create a `.env` file in the `backend` directory (refer to `.env.example`):

```env
MEGA_EMAIL=your_mega_email@example.com
MEGA_PASSWORD=your_mega_password
BACKUP_INTERVAL_MINUTES=360
YOUTUBE_API_KEY=your_optional_youtube_api_key
```

### 3. Run Development Servers

```bash
# Start Backend (runs on http://localhost:5000)
cd backend
npm run dev

# Start Frontend (runs on http://localhost:5173)
cd frontend
npm run dev
```

---

## 📁 Project Structure

```
Planner/
├── frontend/
│   ├── src/
│   │   ├── api/            # API client functions
│   │   ├── components/     # React UI components (WeeklyGrid, DailyView, RagChat, etc.)
│   │   ├── types/          # TypeScript interface definitions
│   │   ├── App.tsx         # Main application container
│   │   └── main.tsx        # Application entry point
│   └── package.json
└── backend/
    ├── src/
    │   ├── routes/         # Express API endpoints (planner, rag, blocks, backup, etc.)
    │   ├── services/       # Ollama, MEGA Backup & Resource Search services
    │   ├── db.ts           # SQLite database setup & migrations
    │   └── index.ts        # Express server entry point
    └── package.json
```

---

## 📄 License

MIT License. Feel free to modify and build upon it!
