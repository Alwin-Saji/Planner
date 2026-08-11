# 📚 Planner — Local-First AI Study & Task Management Platform

**Planner** is a feature-rich, local-first study and schedule planner designed to help learners structure goals, manage study blocks, track productivity, and query reference materials with local AI. Powered by **React 19**, **Express**, **SQLite**, and **Ollama local LLMs**.

---

## 🌟 Key Features

*   **🧠 AI Study Plan Generator**: Build day-by-day study roadmaps based on topic and duration using local Ollama LLMs.
*   **📅 Time Blocking & Schedule Views**: 7-day interactive Weekly Grid and hourly Daily View timelines.
*   **💬 RAG (Retrieval-Augmented Generation) Chat**: Chat directly with your saved study materials, notes, and indexed documentation.
*   **💡 AI Break Optimizer**: Scans your schedule for heavy continuous sessions and offers 1-click rest insertion.
*   **☁️ Cloud Sync (MEGA.io)**: Automated background SQLite database uploads and restores based on authenticated user IDs.
*   **🌐 Local-First & Offline Ready**: Detects local Ollama connection state and falls back to template mode gracefully.

---

## 🛠️ Tech Stack

*   **Frontend**: React 19, TypeScript, Vite, Tailwind CSS, Framer Motion, GSAP, Lucide React
*   **Backend**: Node.js, Express, TypeScript, SQLite (`better-sqlite3` with WAL mode)
*   **Local AI Engine**: Ollama API
*   **Cloud Backup & Storage**: MEGA API (`megajs`), Supabase Auth

---

## 🚀 Local Development Setup

### Prerequisites
*   [Node.js](https://nodejs.org/) (v18+)
*   [Ollama](https://ollama.com/) (installed locally)
*   A [Supabase](https://supabase.com/) project (for authentication)
*   A [MEGA.io](https://mega.io/) account (for database backups)

### 1. Install Dependencies
```bash
# Install frontend dependencies
cd frontend
npm install

# Install backend dependencies
cd ../backend
npm install
```

### 2. Configure Environment Variables

#### Frontend Configuration (`frontend/.env`)
Create a `.env` file in the `frontend` folder:
```env
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
# Leave blank in local development to default to http://localhost:3001
VITE_API_URL=
```

#### Backend Configuration (`backend/.env`)
Create a `.env` file in the `backend` folder:
```env
# Mega.io Credentials for Automatic Database Backup
MEGA_EMAIL=your_mega_email@example.com
MEGA_PASSWORD=your_mega_password
BACKUP_INTERVAL_MINUTES=360
```

### 3. Run Development Servers
```bash
# Start Backend (runs on http://localhost:3001)
cd backend
npm run dev

# Start Frontend (runs on http://localhost:5173)
cd ../frontend
npm run dev
```

---

## 🧠 Setting up Ollama for Local AI

To use the AI generation features locally:
1. Open your terminal and pull the default model:
   ```bash
   ollama pull llama3.2
   ```
2. Start the Ollama server:
   ```bash
   ollama serve
   ```

---

## ☁️ Production Deployment

### 1. Supabase Authentication Setup
Before deploying your site, configure your Google/OAuth redirects:
1. In your **Supabase Dashboard**, go to **Authentication** -> **URL Configuration**.
2. Set the **Site URL** to your deployed Vercel address: `https://your-app.vercel.app`.
3. Add `http://localhost:5173/**` to the **Redirect URLs** list so local sign-ins still work.

### 2. Backend Deployment (Render)
Create a new **Web Service** on [Render](https://render.com) and configure it as follows:

*   **Root Directory**: `backend`
*   **Build Command**: `npm install && npm run build`
*   **Start Command**: `npm start`
*   **Environment Variables**:
    *   `MEGA_EMAIL`: Your MEGA account email.
    *   `MEGA_PASSWORD`: Your MEGA account password.
    *   `BACKUP_INTERVAL_MINUTES`: `360`

### 3. Frontend Deployment (Vercel)
Create a new project on [Vercel](https://vercel.com) and configure it as follows:

*   **Root Directory**: `frontend`
*   **Build Command**: `vite build` (strict compiler checks are bypassed for release)
*   **Output Directory**: `dist`
*   **Environment Variables**:
    *   `VITE_SUPABASE_URL`: Your Supabase project URL.
    *   `VITE_SUPABASE_ANON_KEY`: Your Supabase anon key.
    *   `VITE_API_URL`: Your deployed Render backend URL (e.g., `https://your-backend.onrender.com`).

---

## ⚡ Exposing Local Ollama to the Deployed Website

Since your backend is hosted in the cloud (Render) and Ollama runs locally on your PC, you can bridge the connection using a secure tunnel:

1. **Quit Ollama** from your system tray tray (bottom right corner of Windows).
2. **Start Ollama with CORS enabled**:
   ```bash
   # Windows (CMD)
   set OLLAMA_ORIGINS="*" && ollama serve
   ```
3. **Open an Ngrok Tunnel** (rewriting the host header to prevent Ollama 403 blocks):
   ```bash
   ngrok http 11434 --host-header="localhost:11434"
   ```
4. Copy the generated public HTTPS URL (e.g., `https://your-subdomain.ngrok-free.app`).
5. On the deployed website, paste this URL into the **Custom URL** input field in the Offline Banner and click **Connect**.

Your cloud-hosted website is now connected to your local GPU!
