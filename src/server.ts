import { createWorkersAI } from "workers-ai-provider";
import { routeAgentRequest } from "agents";
import { AIChatAgent, type OnChatMessageOptions } from "@cloudflare/ai-chat";
import { convertToModelMessages, generateText, streamText } from "ai";

const SYSTEM_PROMPT = `You are HC Grader, a concise rubric-based feedback assistant for Minerva University coursework.

Use this exact scoring rubric whenever a grade is requested:
0 = No Evidence
1 = Not Assessable
2 = Review Needed
3 = On Target
4 = Excellent
5 = Profound

Never invent or substitute different rubric labels.

For grading requests:
- Use only the supplied HC definition and student work.
- Follow the REQUESTED OUTPUT section exactly.
- Never include a section that is marked "no".
- Do not invent evidence that is not present in the student's work.
- Keep feedback specific to the selected HC.
- Keep each section concise enough to complete without truncation.

When "Grade report: yes", return:
## #[hcname] — [X]/5 — [Label]

**Reflection Check**
Evaluate every guided reflection question in the supplied HC definition.
Use ✅ for met and ❌ for not met.
For each ❌, add one short, concrete fix tied to the student's work.

**Pitfalls**
List only relevant pitfalls from the supplied HC definition, or "None".

When "Improvement tips: yes", return:
**3 Steps to Improve**
1. [specific action]
2. [specific action]
3. [specific action]

**What a 5 Looks Like**
Give at most two sentences describing what would materially improve this exact work.

When "Footnote: yes", return:
**Footnote**
Write a concise first-person footnote in the student's voice. It must defend the HC application using specific evidence from the supplied work and must not claim choices the student did not make.

If only one output type is requested, return only that output type.

For follow-up questions, answer directly and briefly using the existing conversation context. Do not repeat the full grading report unless the user explicitly asks for it.`;

export class ChatAgent extends AIChatAgent<Env> {
  async onChatMessage(_onFinish: unknown, options?: OnChatMessageOptions) {
    const workersai = createWorkersAI({ binding: this.env.AI });

    // Bound follow-up context growth while each grading request remains self-contained.
    const allMessages = await convertToModelMessages(this.messages);
    const trimmed =
      allMessages.length > 6 ? allMessages.slice(-6) : allMessages;
    const body = options?.body;
    const gradingContext =
      body && typeof body === "object" && "gradingContext" in body
        ? String((body as { gradingContext?: string }).gradingContext || "")
        : "";

    const result = streamText({
      model: workersai("@cf/meta/llama-3.3-70b-instruct-fp8-fast"),
      system: gradingContext
        ? `${SYSTEM_PROMPT}\n\nCompleted grading context:\n${gradingContext}`
        : SYSTEM_PROMPT,
      messages: trimmed,
      abortSignal: options?.abortSignal
    });

    return result.toUIMessageStreamResponse();
  }
}

type GradeRequest = {
  hcLabel: string;
  hcDefinition: string;
  studentWork: string;
  includeGrade: boolean;
  includeFootnote: boolean;
  includeTips: boolean;
};

async function handleGradeRequest(request: Request, env: Env) {
  let body: GradeRequest;

  try {
    body = (await request.json()) as GradeRequest;
  } catch {
    return Response.json({ error: "Invalid grading request." }, { status: 400 });
  }

  if (
    !body.hcLabel ||
    !body.hcDefinition ||
    !body.studentWork?.trim() ||
    (!body.includeGrade && !body.includeFootnote && !body.includeTips)
  ) {
    return Response.json({ error: "Incomplete grading request." }, { status: 400 });
  }

  const requestedOutput = [
    `Grade report: ${body.includeGrade ? "yes" : "no"}`,
    `Improvement tips: ${body.includeTips ? "yes" : "no"}`,
    `Footnote: ${body.includeFootnote ? "yes" : "no"}`
  ].join("\n");

  const prompt = `## HC GRADING REQUEST
HC: ${body.hcLabel}

## REQUESTED OUTPUT
${requestedOutput}

## HC DEFINITION
${body.hcDefinition}

## STUDENT WORK
${body.studentWork.trim()}`;

  const workersai = createWorkersAI({ binding: env.AI });
  const result = await generateText({
    model: workersai("@cf/meta/llama-3.3-70b-instruct-fp8-fast"),
    system: SYSTEM_PROMPT,
    prompt
  });

  return Response.json({ text: result.text });
}

export default {
  async fetch(request: Request, env: Env) {
    if (new URL(request.url).pathname === "/api/grade" && request.method === "POST") {
      try {
        return await handleGradeRequest(request, env);
      } catch (error) {
        console.error("Grading request failed", error);
        return Response.json({ error: "The grading request failed." }, { status: 500 });
      }
    }

    return (
      (await routeAgentRequest(request, env)) ||
      new Response("Not found", { status: 404 })
    );
  }
} satisfies ExportedHandler<Env>;
