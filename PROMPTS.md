# AI Prompts Used

This project was built with significant assistance from Claude (Anthropic). Below are the key prompts used during development.

## Architecture & Planning

> "I have to do a Cloudflare AI app assignment. The requirements are: LLM, Workflow/coordination, User input via chat or voice, Memory or state. I want to build an HC grader for Minerva University — someone selects the HC, pastes in their work, and the chatbot grades it with the rubric (0-5) and tells them what to improve."

> "What fancy tech tools will we use that I can put on my resume?"

> "Can the HC content be in a separate file instead of hardcoded in server.ts?"

## System Prompt Engineering

> "I want the grading feedback to focus on guided reflection questions and common pitfalls. Show all reflection questions with ✅ pass / ❌ miss, and if they missed one tell them what to do to improve. Only flag the pitfalls they fell into and say how to avoid it."

> "Footnotes are written in the student's voice (first person) defending that the work applied the HC properly — explicitly referencing examples from their work to show they met each guided reflection question."

## Bug Fixes

> "It only graded one HC instead of all selected ones. In the follow-up I asked why and it just repeated the same answer."

> "The estimated number of input and maximum output tokens (29,230) exceeded this model context window limit (24,000)."

> "It still stopped midway — the model is hitting a token limit on the output side."

> "Program sequential grading — grade one HC at a time automatically so each gets a complete response."

## UI Design

> "Allow multiple HC selection. Since the end design is to have 4 cornerstones, put a dropdown for course selection, multi-select for HCs, and checkboxes for what they want: footnotes, grading with rubric, tips on what to improve."

> "I can't see what I typed — user messages show 'Submitted X for analysis' instead of my actual text."

## Deployment

> "University WiFi is blocking Cloudflare SSL connections — ssl/tls alert handshake failure."
> Fixed by switching to phone hotspot for development.
