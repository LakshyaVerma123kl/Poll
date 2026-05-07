# 🏏 PredictX Arena

PredictX Arena is a full-stack, real-time Cricket Voting and Leaderboard web application. Designed with an ultra-premium neon glassmorphism UI, it features live automated match fetching, categorized scheduling, and celebratory confetti animations for users who correctly predict winning teams.

## 🚀 Features

- **Live Data Engine**: Automatically fetches and categorizes live Men's Cricket matches (IPL, ICC T20I, ODI, Test, and Domestic).
- **Automated Settlement**: Backend cron jobs detect when a match finishes, determine the winner, and automatically update user points.
- **Glassmorphic UI**: High-fidelity, mobile-first responsive design powered by React and Framer Motion.
- **Dynamic Leaderboard**: Real-time points tracking and automated sorting.
- **Micro-Animations**: Features celebratory `canvas-confetti` when you win and sleek motion transitions between tabs.
- **Zero-Pollution Feed**: Advanced RegEx filtering strictly segregates Domestic/Unofficial matches into their own tab and entirely blocks Women's cricket from the feed to keep standard international and IPL feeds pure.

## 🛠 Tech Stack

- **Frontend**: React 19, Vite, Framer Motion, Canvas Confetti.
- **Backend**: Node.js, Express, Axios.
- **Database**: Local SQLite 3 (Ultra-fast, zero-config).
- **Data Source**: CricAPI v1 (with a robust Cricbuzz scraper & static data fallback).

## 📦 Deployment Configuration

This repository is configured for immediate deployment on platforms like Render or Railway.

### Single-Service Architecture
The application runs as a **single web service**. The Node.js Express backend serves the pre-compiled Vite frontend from the `dist` directory in production mode.

### Render Deployment Instructions
1. Connect your GitHub repository to Render.
2. Select **Web Service**.
3. Render will automatically detect the `render.yaml` file in the root directory.
4. **Important**: You must attach a **Persistent Disk** (mounted at `/data`) so your SQLite database isn't destroyed on every deployment.
5. Set `RESET_DB=true` as an Environment Variable on your *first* launch to initialize fresh tables. **Set it back to `false` immediately afterward.**

## 💻 Local Development

1. Clone the repository.
2. Install dependencies:
   ```bash
   npm install
   ```
3. Set your API Key in `.env`:
   ```env
   CRIC_API_KEY=your_key_here
   ```
4. Run the fullstack development server (spins up both Vite and Nodemon):
   ```bash
   npm run dev
   ```

*Built with ❤️ and advanced AI Agentic Coding.*
