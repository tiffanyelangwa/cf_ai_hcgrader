import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { useAgent } from "agents/react";
import { useAgentChat } from "@cloudflare/ai-chat/react";
import type { UIMessage } from "ai";
import { Streamdown } from "streamdown";
import { HC_DATA } from "./hc-content";

const MAX_WORK_CHARS = 12000;
const SESSION_KEY = "hc-grader-session-id";

const COURSES = [
  {
    id: "multimodal",
    label: "Multimodal Communications",
    available: true,
    hcs: [
      { id: "audience", label: "#audience", description: "Tailor work to your audience" },
      { id: "composition", label: "#composition", description: "Clear and precise style" },
      { id: "connotation", label: "#connotation", description: "Use connotations, tone, and style" },
      { id: "organization", label: "#organization", description: "Effectively organize communications" },
      { id: "professionalism", label: "#professionalism", description: "Present work professionally" },
      { id: "thesis", label: "#thesis", description: "Formulate a well-defined thesis (CASPER)" },
      { id: "communicationdesign", label: "#communicationdesign", description: "Apply perception & cognition principles" },
      { id: "expression", label: "#expression", description: "Utilize nonverbal communication" },
      { id: "medium", label: "#medium", description: "Analyze communicative mediums" },
      { id: "multimedia", label: "#multimedia", description: "Craft layered modality communications" },
      { id: "persuasion", label: "#persuasion", description: "Craft persuasive communications" },
      { id: "designthinking", label: "#designthinking", description: "Apply iterative design thinking" },
      { id: "context", label: "#context", description: "Situate work in relevant context" },
      { id: "critique", label: "#critique", description: "Critically engage with texts" },
      { id: "interpretivelens", label: "#interpretivelens", description: "Recognize how experience affects interpretation" },
      { id: "evidencebased", label: "#evidencebased", description: "Structure information to support arguments" },
      { id: "sourcequality", label: "#sourcequality", description: "Determine source quality (CRAAP)" }
    ]
  },
  { id: "empirical", label: "Empirical Analyses", available: false, hcs: [] },
  { id: "complex", label: "Complex Systems", available: false, hcs: [] },
  { id: "formal", label: "Formal Analyses", available: false, hcs: [] }
];

const MODES = [
  { id: "grade", label: "📊 Grade my work", description: "Get a 0–5 score with rubric feedback" },
  { id: "footnote", label: "📝 Write my footnote", description: "Generate a footnote showing HC application" },
  { id: "tips", label: "💡 Tips to improve", description: "Specific suggestions to level up" }
];

function getSessionName() {
  const existing = window.localStorage.getItem(SESSION_KEY);
  if (existing) return existing;

  const id =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `session-${Date.now()}-${Math.random().toString(36).slice(2)}`;

  window.localStorage.setItem(SESSION_KEY, id);
  return id;
}

function HCGrader() {
  const [sessionName] = useState(getSessionName);
  const [connected, setConnected] = useState(false);
  const [selectedCourse, setSelectedCourse] = useState("");
  const [selectedHCs, setSelectedHCs] = useState<string[]>([]);
  const [selectedModes, setSelectedModes] = useState<string[]>([
    "grade",
    "footnote",
    "tips"
  ]);
  const [studentWork, setStudentWork] = useState("");
  const [chatInput, setChatInput] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [dark, setDark] = useState(false);
  const [courseOpen, setCourseOpen] = useState(false);
  const [gradingQueue, setGradingQueue] = useState<string[]>([]);
  const [currentHCIndex, setCurrentHCIndex] = useState(0);
  const [awaitingResponse, setAwaitingResponse] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const courseDropdownRef = useRef<HTMLDivElement>(null);
  const assistantCountBeforeSendRef = useRef(0);

  useEffect(() => {
    const saved = localStorage.getItem("theme");
    if (saved === "dark") {
      setDark(true);
      document.documentElement.setAttribute("data-mode", "dark");
      document.documentElement.style.colorScheme = "dark";
    }
  }, []);

  useEffect(() => {
    if (!courseOpen) return;
    const handleClick = (event: MouseEvent) => {
      if (
        courseDropdownRef.current &&
        !courseDropdownRef.current.contains(event.target as Node)
      ) {
        setCourseOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [courseOpen]);

  const toggleTheme = () => {
    const next = !dark;
    setDark(next);
    const mode = next ? "dark" : "light";
    document.documentElement.setAttribute("data-mode", mode);
    document.documentElement.style.colorScheme = mode;
    localStorage.setItem("theme", mode);
  };

  const agent = useAgent({
    agent: "ChatAgent",
    name: sessionName,
    onOpen: useCallback(() => setConnected(true), []),
    onClose: useCallback(() => setConnected(false), [])
  });

  const { messages, sendMessage, clearHistory, status } = useAgentChat({ agent });
  const isStreaming = status === "streaming" || status === "submitted";

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (!awaitingResponse || isStreaming) return;

    const assistantCount = messages.filter(
      (message: UIMessage) => message.role === "assistant"
    ).length;

    if (assistantCount > assistantCountBeforeSendRef.current) {
      setAwaitingResponse(false);
      setCurrentHCIndex(index => index + 1);
    }
  }, [awaitingResponse, isStreaming, messages]);

  useEffect(() => {
    if (!submitted) return;
    if (gradingQueue.length === 0) return;
    if (currentHCIndex >= gradingQueue.length) return;
    if (awaitingResponse || isStreaming) return;

    const hcId = gradingQueue[currentHCIndex];
    const course = COURSES.find(item => item.id === selectedCourse);
    const hc = course?.hcs.find(item => item.id === hcId);
    if (!hc) return;

    const includeGrade = selectedModes.includes("grade");
    const includeFootnote = selectedModes.includes("footnote");
    const includeTips = selectedModes.includes("tips");
    const hcDefinition = HC_DATA[hcId] || "";

    const requestedOutput = [
      `Grade report: ${includeGrade ? "yes" : "no"}`,
      `Improvement tips: ${includeTips ? "yes" : "no"}`,
      `Footnote: ${includeFootnote ? "yes" : "no"}`
    ].join("\n");

    const message = `## HC GRADING REQUEST
HC: ${hc.label}
Item: ${currentHCIndex + 1} of ${gradingQueue.length}

## REQUESTED OUTPUT
${requestedOutput}

## HC DEFINITION
${hcDefinition}

## STUDENT WORK
${studentWork.trim()}`;

    assistantCountBeforeSendRef.current = messages.filter(
      (item: UIMessage) => item.role === "assistant"
    ).length;
    setAwaitingResponse(true);
    sendMessage({ role: "user", parts: [{ type: "text", text: message }] });
  }, [
    awaitingResponse,
    currentHCIndex,
    gradingQueue,
    isStreaming,
    messages,
    selectedCourse,
    selectedModes,
    sendMessage,
    studentWork,
    submitted
  ]);

  const handleGrade = useCallback(() => {
    if (
      !selectedHCs.length ||
      !studentWork.trim() ||
      !selectedModes.length ||
      !connected
    ) {
      return;
    }

    clearHistory();
    setGradingQueue([...selectedHCs]);
    setCurrentHCIndex(0);
    setAwaitingResponse(false);
    setSubmitted(true);
  }, [
    clearHistory,
    connected,
    selectedHCs,
    selectedModes,
    studentWork
  ]);

  const handleChat = useCallback(() => {
    if (!chatInput.trim() || isStreaming || awaitingResponse) return;
    sendMessage({
      role: "user",
      parts: [{ type: "text", text: chatInput.trim() }]
    });
    setChatInput("");
  }, [awaitingResponse, chatInput, isStreaming, sendMessage]);

  const handleReset = () => {
    clearHistory();
    setSelectedCourse("");
    setSelectedHCs([]);
    setStudentWork("");
    setChatInput("");
    setSubmitted(false);
    setSelectedModes(["grade", "footnote", "tips"]);
    setGradingQueue([]);
    setCurrentHCIndex(0);
    setAwaitingResponse(false);
  };

  const course = COURSES.find(item => item.id === selectedCourse);
  const toggleHC = (hcId: string) =>
    setSelectedHCs(previous =>
      previous.includes(hcId)
        ? previous.filter(item => item !== hcId)
        : [...previous, hcId]
    );
  const toggleMode = (modeId: string) =>
    setSelectedModes(previous =>
      previous.includes(modeId)
        ? previous.filter(item => item !== modeId)
        : [...previous, modeId]
    );

  const bg = dark ? "#0f1117" : "#f4f5f7";
  const surface = dark ? "#1a1d27" : "#ffffff";
  const border = dark ? "#2a2d3a" : "#e5e7eb";
  const text = dark ? "#e8eaf0" : "#111827";
  const textSecondary = dark ? "#8b8fa8" : "#6b7280";
  const accent = "#f6821f";
  const inputBg = dark ? "#0f1117" : "#f9fafb";

  const canSubmit =
    selectedHCs.length > 0 &&
    studentWork.trim().length > 0 &&
    selectedModes.length > 0 &&
    connected;

  const completedCount = Math.min(currentHCIndex, gradingQueue.length);
  const gradingProgress =
    submitted && gradingQueue.length > 0 && completedCount < gradingQueue.length
      ? `Grading ${completedCount + 1} of ${gradingQueue.length} HCs...`
      : null;

  return (
    <div
      style={{
        minHeight: "100vh",
        background: bg,
        color: text,
        fontFamily: "'Inter', system-ui, sans-serif"
      }}
    >
      <header
        style={{
          background: surface,
          borderBottom: `1px solid ${border}`,
          padding: "14px 24px",
          position: "sticky",
          top: 0,
          zIndex: 10
        }}
      >
        <div
          style={{
            maxWidth: 820,
            margin: "0 auto",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
            flexWrap: "wrap"
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: 10,
                background: accent,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 18
              }}
            >
              📋
            </div>
            <div>
              <h1 style={{ margin: 0, fontSize: 17, fontWeight: 700 }}>
                HC Grader
              </h1>
              <p style={{ margin: 0, fontSize: 11, color: textSecondary }}>
                Minerva University · Cornerstone Courses
              </p>
            </div>
          </div>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              flexWrap: "wrap"
            }}
          >
            {gradingProgress && (
              <span style={{ fontSize: 12, color: accent, fontWeight: 600 }}>
                {gradingProgress}
              </span>
            )}
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <div
                style={{
                  width: 7,
                  height: 7,
                  borderRadius: "50%",
                  background: connected ? "#22c55e" : "#ef4444"
                }}
              />
              <span style={{ fontSize: 12, color: textSecondary }}>
                {connected ? "Connected" : "Connecting..."}
              </span>
            </div>
            <button
              onClick={toggleTheme}
              style={{
                background: "none",
                border: `1px solid ${border}`,
                borderRadius: 8,
                padding: "5px 9px",
                cursor: "pointer",
                fontSize: 15
              }}
            >
              {dark ? "☀️" : "🌙"}
            </button>
            {submitted && (
              <button
                onClick={handleReset}
                style={{
                  background: "none",
                  border: `1px solid ${border}`,
                  borderRadius: 8,
                  padding: "6px 14px",
                  cursor: "pointer",
                  color: textSecondary,
                  fontSize: 13
                }}
              >
                ↺ New Submission
              </button>
            )}
          </div>
        </div>
      </header>

      <main style={{ maxWidth: 820, margin: "0 auto", padding: "28px 24px" }}>
        {!submitted && (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <section
              style={{
                background: surface,
                borderRadius: 14,
                border: `1px solid ${border}`,
                padding: 22
              }}
            >
              <div
                style={{
                  fontSize: 12,
                  fontWeight: 700,
                  color: textSecondary,
                  textTransform: "uppercase",
                  letterSpacing: "0.06em",
                  marginBottom: 12
                }}
              >
                Step 1 — Select Cornerstone Course
              </div>
              <div ref={courseDropdownRef} style={{ position: "relative" }}>
                <button
                  onClick={() => setCourseOpen(open => !open)}
                  style={{
                    width: "100%",
                    padding: "11px 16px",
                    borderRadius: 10,
                    border: `1px solid ${selectedCourse ? accent : border}`,
                    background: inputBg,
                    color: selectedCourse ? text : textSecondary,
                    fontSize: 14,
                    cursor: "pointer",
                    textAlign: "left",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between"
                  }}
                >
                  <span>
                    {selectedCourse ? course?.label : "Choose a course..."}
                  </span>
                  <span style={{ fontSize: 11, color: textSecondary }}>
                    {courseOpen ? "▲" : "▼"}
                  </span>
                </button>

                {courseOpen && (
                  <div
                    style={{
                      position: "absolute",
                      top: "calc(100% + 6px)",
                      left: 0,
                      right: 0,
                      background: surface,
                      border: `1px solid ${border}`,
                      borderRadius: 12,
                      overflow: "hidden",
                      zIndex: 20,
                      boxShadow: "0 8px 24px rgba(0,0,0,0.12)"
                    }}
                  >
                    {COURSES.map(item => (
                      <button
                        key={item.id}
                        onClick={() => {
                          if (!item.available) return;
                          setSelectedCourse(item.id);
                          setSelectedHCs([]);
                          setCourseOpen(false);
                        }}
                        style={{
                          width: "100%",
                          padding: "12px 16px",
                          border: "none",
                          borderBottom: `1px solid ${border}`,
                          background:
                            selectedCourse === item.id
                              ? dark
                                ? "#2d1f0e"
                                : "#fff7ed"
                              : "none",
                          color: !item.available ? textSecondary : text,
                          fontSize: 14,
                          cursor: item.available ? "pointer" : "not-allowed",
                          textAlign: "left",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between"
                        }}
                      >
                        <span>{item.label}</span>
                        {!item.available && (
                          <span
                            style={{
                              fontSize: 11,
                              background: dark ? "#2a2d3a" : "#f3f4f6",
                              padding: "2px 8px",
                              borderRadius: 20
                            }}
                          >
                            Coming soon
                          </span>
                        )}
                        {item.available && selectedCourse === item.id && (
                          <span style={{ color: accent }}>✓</span>
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </section>

            {selectedCourse && course?.available && (
              <section
                style={{
                  background: surface,
                  borderRadius: 14,
                  border: `1px solid ${border}`,
                  padding: 22
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    marginBottom: 12
                  }}
                >
                  <div
                    style={{
                      fontSize: 12,
                      fontWeight: 700,
                      color: textSecondary,
                      textTransform: "uppercase",
                      letterSpacing: "0.06em"
                    }}
                  >
                    Step 2 — Select HCs{" "}
                    <span style={{ color: accent }}>
                      ({selectedHCs.length} selected)
                    </span>
                  </div>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button
                      onClick={() =>
                        setSelectedHCs(course.hcs.map(item => item.id))
                      }
                      style={{
                        fontSize: 12,
                        color: accent,
                        background: "none",
                        border: "none",
                        cursor: "pointer"
                      }}
                    >
                      Select all
                    </button>
                    <button
                      onClick={() => setSelectedHCs([])}
                      style={{
                        fontSize: 12,
                        color: textSecondary,
                        background: "none",
                        border: "none",
                        cursor: "pointer"
                      }}
                    >
                      Clear
                    </button>
                  </div>
                </div>

                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns:
                      "repeat(auto-fill, minmax(185px, 1fr))",
                    gap: 8
                  }}
                >
                  {course.hcs.map(hc => {
                    const selected = selectedHCs.includes(hc.id);
                    return (
                      <button
                        key={hc.id}
                        onClick={() => toggleHC(hc.id)}
                        style={{
                          padding: "10px 13px",
                          borderRadius: 10,
                          border: `2px solid ${selected ? accent : border}`,
                          background: selected
                            ? dark
                              ? "#2d1f0e"
                              : "#fff7ed"
                            : inputBg,
                          cursor: "pointer",
                          textAlign: "left"
                        }}
                      >
                        <div
                          style={{
                            fontSize: 13,
                            fontWeight: 700,
                            color: selected ? accent : text,
                            marginBottom: 2
                          }}
                        >
                          {hc.label}
                        </div>
                        <div
                          style={{
                            fontSize: 11,
                            color: textSecondary,
                            lineHeight: 1.3
                          }}
                        >
                          {hc.description}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </section>
            )}

            {selectedHCs.length > 0 && (
              <section
                style={{
                  background: surface,
                  borderRadius: 14,
                  border: `1px solid ${border}`,
                  padding: 22
                }}
              >
                <div
                  style={{
                    fontSize: 12,
                    fontWeight: 700,
                    color: textSecondary,
                    textTransform: "uppercase",
                    letterSpacing: "0.06em",
                    marginBottom: 12
                  }}
                >
                  Step 3 — What do you want?
                </div>
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: 10
                  }}
                >
                  {MODES.map(mode => {
                    const selected = selectedModes.includes(mode.id);
                    return (
                      <button
                        key={mode.id}
                        onClick={() => toggleMode(mode.id)}
                        style={{
                          padding: "13px 16px",
                          borderRadius: 10,
                          border: `2px solid ${selected ? accent : border}`,
                          background: selected
                            ? dark
                              ? "#2d1f0e"
                              : "#fff7ed"
                            : inputBg,
                          cursor: "pointer",
                          textAlign: "left"
                        }}
                      >
                        <div
                          style={{
                            fontSize: 14,
                            fontWeight: 600,
                            color: text
                          }}
                        >
                          {selected ? "✓ " : ""}
                          {mode.label}
                        </div>
                        <div style={{ fontSize: 12, color: textSecondary }}>
                          {mode.description}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </section>
            )}

            {selectedHCs.length > 0 && selectedModes.length > 0 && (
              <section
                style={{
                  background: surface,
                  borderRadius: 14,
                  border: `1px solid ${border}`,
                  padding: 22
                }}
              >
                <div
                  style={{
                    fontSize: 12,
                    fontWeight: 700,
                    color: textSecondary,
                    textTransform: "uppercase",
                    letterSpacing: "0.06em",
                    marginBottom: 12
                  }}
                >
                  Step 4 — Paste Your Work
                </div>
                <textarea
                  value={studentWork}
                  onChange={event => setStudentWork(event.target.value)}
                  maxLength={MAX_WORK_CHARS}
                  placeholder="Paste your work here — essay paragraph, footnote, presentation script, or any written submission..."
                  rows={8}
                  style={{
                    width: "100%",
                    padding: "14px 16px",
                    borderRadius: 10,
                    border: `1px solid ${border}`,
                    background: inputBg,
                    color: text,
                    fontSize: 14,
                    lineHeight: 1.6,
                    resize: "vertical",
                    outline: "none",
                    fontFamily: "inherit"
                  }}
                />
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    gap: 12,
                    marginTop: 8,
                    flexWrap: "wrap"
                  }}
                >
                  <span style={{ fontSize: 12, color: textSecondary }}>
                    {studentWork.length}/{MAX_WORK_CHARS} characters
                  </span>
                  <button
                    onClick={handleGrade}
                    disabled={!canSubmit}
                    style={{
                      padding: "12px 28px",
                      borderRadius: 10,
                      border: "none",
                      background: canSubmit
                        ? accent
                        : dark
                          ? "#2a2d3a"
                          : "#e5e7eb",
                      color: canSubmit ? "#fff" : textSecondary,
                      fontSize: 14,
                      fontWeight: 700,
                      cursor: canSubmit ? "pointer" : "not-allowed"
                    }}
                  >
                    Analyze My Work →
                  </button>
                </div>
              </section>
            )}

            {!selectedCourse && (
              <div
                style={{
                  textAlign: "center",
                  padding: "48px 20px",
                  color: textSecondary
                }}
              >
                <div style={{ fontSize: 52, marginBottom: 16 }}>📚</div>
                <p
                  style={{
                    fontSize: 16,
                    margin: "0 0 8px",
                    color: text,
                    fontWeight: 600
                  }}
                >
                  Welcome to HC Grader
                </p>
                <p
                  style={{
                    fontSize: 14,
                    margin: "0 auto",
                    maxWidth: 420,
                    lineHeight: 1.6
                  }}
                >
                  Select your Cornerstone course, pick the HCs you're being
                  assessed on, and get focused feedback.
                </p>
              </div>
            )}
          </div>
        )}

        {messages.length > 0 && (
          <section
            style={{
              background: surface,
              borderRadius: 14,
              border: `1px solid ${border}`,
              padding: 24,
              marginBottom: 16
            }}
          >
            <div
              style={{
                fontSize: 12,
                fontWeight: 700,
                color: textSecondary,
                textTransform: "uppercase",
                letterSpacing: "0.06em",
                marginBottom: 16
              }}
            >
              Results
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              {messages.map((message: UIMessage, messageIndex: number) => {
                const isUser = message.role === "user";
                const isLiveAssistantMessage =
                  !isUser &&
                  isStreaming &&
                  messageIndex === messages.length - 1;

                return (
                  <div
                    key={message.id}
                    style={{
                      display: "flex",
                      justifyContent: isUser ? "flex-end" : "flex-start",
                      alignItems: "flex-start",
                      gap: 10
                    }}
                  >
                    {!isUser && (
                      <div
                        style={{
                          width: 30,
                          height: 30,
                          borderRadius: 8,
                          background: accent,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontSize: 13,
                          flexShrink: 0
                        }}
                      >
                        📋
                      </div>
                    )}

                    <div
                      style={{
                        maxWidth: "88%",
                        padding: isUser ? "10px 14px" : "14px 18px",
                        borderRadius: isUser
                          ? "16px 16px 4px 16px"
                          : "16px 16px 16px 4px",
                        background: isUser
                          ? accent
                          : dark
                            ? "#1e2130"
                            : "#f3f4f6",
                        color: isUser ? "#fff" : text,
                        fontSize: 14,
                        lineHeight: 1.6
                      }}
                    >
                      {message.parts
                        .filter(part => part.type === "text")
                        .map((part, index) => {
                          const value = (
                            part as { type: "text"; text: string }
                          ).text;
                          if (!value) return null;

                          if (isUser) {
                            const gradingRequest = value.includes(
                              "## HC GRADING REQUEST"
                            );
                            if (gradingRequest) {
                              const hc = value.match(/^HC:\s+(#\w+)/m)?.[1] ?? "HC";
                              const item = value.match(
                                /^Item:\s+(\d+)\s+of\s+(\d+)/m
                              );
                              return (
                                <div key={index} style={{ fontSize: 13 }}>
                                  {item
                                    ? `Grading ${hc} (${item[1]} of ${item[2]})`
                                    : `Grading ${hc}`}
                                </div>
                              );
                            }

                            return <div key={index}>{value}</div>;
                          }

                          if (isLiveAssistantMessage) {
                            return (
                              <div key={index} style={{ whiteSpace: "pre-wrap" }}>
                                {value}
                              </div>
                            );
                          }

                          return (
                            <Streamdown
                              key={index}
                              className="sd-theme"
                              controls={false}
                              isAnimating={false}
                            >
                              {value}
                            </Streamdown>
                          );
                        })}
                    </div>
                  </div>
                );
              })}

              {(isStreaming || awaitingResponse) && (
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div
                    style={{
                      width: 30,
                      height: 30,
                      borderRadius: 8,
                      background: accent,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 13
                    }}
                  >
                    📋
                  </div>
                  <div style={{ display: "flex", gap: 5 }}>
                    {[0, 1, 2].map(index => (
                      <div
                        key={index}
                        style={{
                          width: 7,
                          height: 7,
                          borderRadius: "50%",
                          background: accent,
                          animation: "bounce 1.2s infinite",
                          animationDelay: `${index * 0.2}s`
                        }}
                      />
                    ))}
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
          </section>
        )}

        {submitted && (
          <section
            style={{
              background: surface,
              borderRadius: 14,
              border: `1px solid ${border}`,
              padding: 20
            }}
          >
            <div
              style={{
                fontSize: 12,
                fontWeight: 700,
                color: textSecondary,
                textTransform: "uppercase",
                letterSpacing: "0.06em",
                marginBottom: 12
              }}
            >
              Follow-up
            </div>
            <div style={{ display: "flex", gap: 10, marginBottom: 10 }}>
              <input
                value={chatInput}
                onChange={event => setChatInput(event.target.value)}
                onKeyDown={event => {
                  if (event.key === "Enter") handleChat();
                }}
                placeholder='e.g. "Rewrite my thesis" or "Why did I lose points on #medium?"'
                disabled={isStreaming || awaitingResponse}
                style={{
                  flex: 1,
                  padding: "11px 14px",
                  borderRadius: 10,
                  border: `1px solid ${border}`,
                  background: inputBg,
                  color: text,
                  fontSize: 14,
                  outline: "none",
                  fontFamily: "inherit"
                }}
              />
              <button
                onClick={handleChat}
                disabled={
                  !chatInput.trim() || isStreaming || awaitingResponse
                }
                style={{
                  padding: "11px 20px",
                  borderRadius: 10,
                  border: "none",
                  background:
                    chatInput.trim() && !isStreaming && !awaitingResponse
                      ? accent
                      : dark
                        ? "#2a2d3a"
                        : "#e5e7eb",
                  color:
                    chatInput.trim() && !isStreaming && !awaitingResponse
                      ? "#fff"
                      : textSecondary,
                  fontSize: 14,
                  fontWeight: 600,
                  cursor:
                    chatInput.trim() && !isStreaming && !awaitingResponse
                      ? "pointer"
                      : "not-allowed"
                }}
              >
                Send
              </button>
            </div>
          </section>
        )}
      </main>

      <style>{`
        @keyframes bounce {
          0%, 80%, 100% { transform: translateY(0); }
          40% { transform: translateY(-6px); }
        }
        * { box-sizing: border-box; }
        textarea:focus, input:focus {
          border-color: #f6821f !important;
          box-shadow: 0 0 0 3px #f6821f22;
        }
      `}</style>
    </div>
  );
}

export default function App() {
  return (
    <Suspense
      fallback={
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            height: "100vh"
          }}
        >
          Loading...
        </div>
      }
    >
      <HCGrader />
    </Suspense>
  );
}
