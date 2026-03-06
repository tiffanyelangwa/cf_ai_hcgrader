# HC Grader — AI-Powered Habit of Mind Grading Agent

A full-stack AI agent built on Cloudflare that grades student work for Minerva University's Multimodal Communications course using the Habits of Mind (HC) framework.

## Live Demo

🚀 [https://agent-starter.tiffany-elangwa.workers.dev](https://agent-starter.tiffany-elangwa.workers.dev)

## What It Does

Students paste their written work, select which HCs they are being assessed on, and get instant structured feedback including:

- **0–5 score** with rubric label (No Evidence → Profound)
- **Guided Reflection Checklist** — each reflection question marked ✅ met or ❌ missed, with specific advice on how to fix gaps
- **Pitfalls Flagged** — only the pitfalls the student actually fell into, with how to avoid them
- **3 Steps to Improve** — concrete, actionable next steps
- **What a 5 Looks Like** — a description of a Profound response for their specific work
- **Footnote** (optional) — written in the student's voice defending how they met the HC
- **Follow-up chat** — ask questions like "why did I lose points?" or "rewrite my thesis"

## Cloudflare Architecture

| Component | Cloudflare Tool |
|---|---|
| LLM inference | Workers AI (Llama 3.3 70B) |
| Stateful sessions | Durable Objects |
| Backend logic | Cloudflare Workers |
| Frontend hosting | Cloudflare Pages |
| Real-time streaming | WebSockets via Agents SDK |

## How to Run Locally

### Prerequisites
- Node.js v18+
- Cloudflare account
- Wrangler CLI

### Setup

```bash
# Clone the repo
git clone https://github.com/YOUR_USERNAME/cf_ai_hcgrader
cd cf_ai_hcgrader

# Install dependencies
npm install

# Login to Cloudflare
wrangler login

# Run locally (use phone hotspot if on university WiFi)
npm run dev
```

Open [http://localhost:5173](http://localhost:5173)

### Deploy to Cloudflare

```bash
npm run deploy
```

## How to Use

1. Select **Multimodal Communications** from the course dropdown
2. Select one or more HCs to be graded on
3. Choose what you want: Grade / Footnote / Tips
4. Paste your written work
5. Click **Analyze My Work**
6. Use the follow-up chat to ask questions or request rewrites

## Project Structure

```
src/
  server.ts        # Cloudflare Worker — AI agent logic, grading system prompt
  app.tsx          # React frontend — UI, sequential grading orchestration  
  hc-content.ts    # HC definitions lookup (guided reflections, pitfalls, etc.)
  client.tsx       # WebSocket client connection
  style.css        # Styling
```

## Courses Supported

- ✅ Multimodal Communications (17 HCs)
- 🔜 Empirical Analyses (coming soon)
- 🔜 Complex Systems (coming soon)
- 🔜 Formal Analyses (coming soon)
