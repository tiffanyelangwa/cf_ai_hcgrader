# HC Grader — AI-Powered Habit of Mind Grading Agent

HC Grader is a full-stack AI grading assistant built on Cloudflare for rubric-based feedback on written work. It supports structured grading, guided-reflection checks, improvement suggestions, generated footnotes, and follow-up chat across all 17 Multimodal Communications Habits of Mind.

## Live Demo

🚀 [Open HC Grader](https://agent-starter.tiffany-elangwa.workers.dev)

## What It Does

Students paste their work, select one or more Habits of Mind, and receive structured feedback including:

- **0–5 rubric score** with performance label
- **Guided Reflection Checklist** with met/missed criteria
- **Pitfalls Flagged** only when relevant to the submitted work
- **Actionable improvement steps** tied to the student's response
- **"What a 5 Looks Like"** guidance
- **Optional footnote generation** written in the student's voice
- **Follow-up chat** for questions, revisions, and clarification

## Architecture

```text
React UI
   ↓
Cloudflare Agents SDK / WebSocket
   ↓
Durable Object session (ChatAgent)
   ↓
Workers AI — Llama 3.3 70B
   ↓
Streamed structured feedback
```

| Layer | Technology |
| --- | --- |
| Frontend | React 19, TypeScript, Vite |
| AI inference | Cloudflare Workers AI — Llama 3.3 70B |
| Backend | Cloudflare Workers |
| Stateful sessions | Durable Objects |
| Real-time communication | WebSockets via Cloudflare Agents SDK |
| Validation / tooling | Zod, Wrangler, Oxlint, TypeScript |

## Engineering Highlights

### Sequential grading orchestration

Grading multiple HCs in a single model request originally exceeded the model's context window and produced truncated responses. The frontend now queues selected HCs and grades them **one at a time**, injecting only the relevant HC definition for each request. This keeps each grading pass focused while still automating a multi-HC workflow.

### Context management

Follow-up conversations retain only the most recent messages before inference, preventing chat history from growing indefinitely and reducing the risk of context-window overflow.

### Stateful session isolation

Each grading session runs through a Cloudflare Durable Object-backed `ChatAgent`, keeping conversational state isolated by session rather than sharing mutable state across users.

### Structured rubric grounding

HC definitions, guided-reflection questions, and common pitfalls are stored separately from the application logic and injected only when needed, keeping grading prompts scoped to the selected criterion.

## How to Use

1. Select **Multimodal Communications**.
2. Choose one or more HCs.
3. Select the outputs you want: grading, footnote, and/or improvement tips.
4. Paste your work.
5. Click **Analyze My Work**.
6. Use follow-up chat to ask questions or request revisions.

## Run Locally

### Prerequisites

- Node.js 18+
- Cloudflare account
- Wrangler CLI

```bash
git clone https://github.com/tiffanyelangwa/cf_ai_hcgrader.git
cd cf_ai_hcgrader
npm install
wrangler login
npm run dev
```

Open `http://localhost:5173`.

### Deploy

```bash
npm run deploy
```

## Project Structure

```text
src/
  server.ts        # Worker, ChatAgent, model inference, context management
  app.tsx          # React UI and sequential grading orchestration
  hc-content.ts    # HC definitions, guided reflections, and pitfalls
  client.tsx       # Client bootstrap / agent connection
  styles.css       # Global styles
```

## Current Scope

- ✅ Multimodal Communications — 17 HCs
- 🔜 Empirical Analyses
- 🔜 Complex Systems
- 🔜 Formal Analyses

## Project Status

HC Grader is deployed and functional. Current development focuses on expanding course coverage and refining the grading experience while preserving session isolation and bounded model context.
