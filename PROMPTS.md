# Development Notes

This document summarizes the main engineering decisions and debugging lessons from building HC Grader.

## Architecture

The application combines a React frontend with Cloudflare Workers AI, Durable Objects, and the Cloudflare Agents SDK. Grading requests are streamed back to the client over an agent connection while each session keeps its own conversational state.

## Prompt and rubric design

The grader is grounded in per-HC rubric content, including guided reflection questions and common pitfalls. HC definitions are stored separately from the core application logic and injected only for the criterion currently being graded.

The response format is intentionally structured so students receive:

- a rubric score and label
- guided-reflection checks
- relevant pitfalls
- concrete improvement steps
- an optional first-person footnote
- follow-up chat support

## Context-window debugging

An early multi-HC implementation exceeded the model context limit (29,230 estimated tokens against a 24,000-token window) and could also truncate long outputs.

The grading flow was redesigned to process selected HCs sequentially. Each grading pass receives only the relevant HC definition, which keeps requests smaller and allows every selected criterion to receive a complete response.

Follow-up chat also keeps only the most recent conversation messages before inference to prevent unbounded context growth.

## Session isolation

Each conversation is handled through a Durable Object-backed `ChatAgent`, keeping state scoped to an individual grading session rather than sharing mutable chat state across users.

## UI orchestration

The interface supports course selection, multi-select HC grading, optional grading/footnote/tips outputs, streamed responses, dark mode, progress state, and follow-up questions after the initial analysis.

## Deployment notes

The app is deployed on Cloudflare and can also be run locally with Vite and Wrangler. The current deployed scope supports all 17 Multimodal Communications HCs, with additional course coverage planned.
