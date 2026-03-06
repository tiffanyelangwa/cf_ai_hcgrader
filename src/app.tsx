import { Suspense, useCallback, useState, useEffect, useRef } from "react";
import { useAgent } from "agents/react";
import { useAgentChat } from "@cloudflare/ai-chat/react";
import type { UIMessage } from "ai";
import { Streamdown } from "streamdown";
import { HC_DATA } from "./hc-content";

const COURSES = [
  {
    id: "multimodal", label: "Multimodal Communications", available: true,
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
      { id: "sourcequality", label: "#sourcequality", description: "Determine source quality (CRAAP)" },
    ]
  },
  { id: "empirical", label: "Empirical Analyses", available: false, hcs: [] },
  { id: "complex", label: "Complex Systems", available: false, hcs: [] },
  { id: "formal", label: "Formal Analyses", available: false, hcs: [] },
];

const MODES = [
  { id: "grade", label: "📊 Grade my work", description: "Get a 0–5 score with rubric feedback" },
  { id: "footnote", label: "📝 Write my footnote", description: "Generate a footnote showing HC application" },
  { id: "tips", label: "💡 Tips to improve", description: "Specific suggestions to level up" },
];

function HCGrader() {
  const [connected, setConnected] = useState(false);
  const [selectedCourse, setSelectedCourse] = useState("");
  const [selectedHCs, setSelectedHCs] = useState<string[]>([]);
  const [selectedModes, setSelectedModes] = useState<string[]>(["grade", "footnote", "tips"]);
  const [studentWork, setStudentWork] = useState("");
  const [chatInput, setChatInput] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [dark, setDark] = useState(false);
  const [courseOpen, setCourseOpen] = useState(false);
  const [gradingQueue, setGradingQueue] = useState<string[]>([]);
  const [currentHCIndex, setCurrentHCIndex] = useState(0);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const courseDropdownRef = useRef<HTMLDivElement>(null);

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
    function handleClick(e: MouseEvent) {
      if (courseDropdownRef.current && !courseDropdownRef.current.contains(e.target as Node)) {
        setCourseOpen(false);
      }
    }
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
    onOpen: useCallback(() => setConnected(true), []),
    onClose: useCallback(() => setConnected(false), []),
  });

  const { messages, sendMessage, clearHistory, status } = useAgentChat({ agent });
  const isStreaming = status === "streaming" || status === "submitted";

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Sequential HC grading — one HC per message with full HC definition embedded
  useEffect(() => {
    if (gradingQueue.length === 0) return;
    if (isStreaming) return;
    if (currentHCIndex >= gradingQueue.length) return;

    const hcId = gradingQueue[currentHCIndex];
    const course = COURSES.find(c => c.id === selectedCourse);
    const hc = course?.hcs.find(h => h.id === hcId);
    if (!hc) return;

    const includeFootnote = selectedModes.includes("footnote");
    const includeTips = selectedModes.includes("tips");
    const hcDefinition = HC_DATA[hcId] || "";

    const isFirst = currentHCIndex === 0;

    const footnoteNote = includeFootnote ? "\n\nAlso write a **Footnote** section after **What a 5 Would Look Like**." : "";
    const tipsNote = includeTips ? " After the main sections, add a **Bonus Tips** section with 2 extra specific tips." : "";

    const message = isFirst
      ? `Please grade my work for ${hc.label} (${currentHCIndex + 1} of ${gradingQueue.length}).${tipsNote}${footnoteNote}\n\n## HC DEFINITION\n${hcDefinition}\n\n## STUDENT WORK\n${studentWork.trim()}`
      : `Now grade the same student work for ${hc.label} (${currentHCIndex + 1} of ${gradingQueue.length}).${tipsNote}${footnoteNote}\n\n## HC DEFINITION\n${hcDefinition}`;

    sendMessage({ role: "user", parts: [{ type: "text", text: message }] });
    setCurrentHCIndex(i => i + 1);
  }, [gradingQueue, currentHCIndex, isStreaming, studentWork, selectedModes, selectedCourse]);

  const handleGrade = useCallback(() => {
    if (!selectedHCs.length || !studentWork.trim() || !selectedModes.length) return;
    setGradingQueue(selectedHCs);
    setCurrentHCIndex(0);
    setSubmitted(true);
  }, [selectedHCs, studentWork, selectedModes]);

  const handleChat = useCallback(() => {
    if (!chatInput.trim() || isStreaming) return;
    sendMessage({ role: "user", parts: [{ type: "text", text: chatInput.trim() }] });
    setChatInput("");
  }, [chatInput, isStreaming, sendMessage]);

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
  };

  const course = COURSES.find(c => c.id === selectedCourse);
  const toggleHC = (hcId: string) => setSelectedHCs(prev => prev.includes(hcId) ? prev.filter(h => h !== hcId) : [...prev, hcId]);
  const toggleMode = (modeId: string) => setSelectedModes(prev => prev.includes(modeId) ? prev.filter(m => m !== modeId) : [...prev, modeId]);

  const bg = dark ? "#0f1117" : "#f4f5f7";
  const surface = dark ? "#1a1d27" : "#ffffff";
  const border = dark ? "#2a2d3a" : "#e5e7eb";
  const text = dark ? "#e8eaf0" : "#111827";
  const textSecondary = dark ? "#8b8fa8" : "#6b7280";
  const accent = "#f6821f";
  const inputBg = dark ? "#0f1117" : "#f9fafb";
  const canSubmit = selectedHCs.length > 0 && studentWork.trim() && selectedModes.length > 0 && connected;

  const gradingProgress = gradingQueue.length > 0
    ? `Grading ${Math.min(currentHCIndex, gradingQueue.length)} of ${gradingQueue.length} HCs...`
    : null;

  return (
    <div style={{ minHeight: "100vh", background: bg, color: text, fontFamily: "'Inter', system-ui, sans-serif" }}>
      <header style={{ background: surface, borderBottom: `1px solid ${border}`, padding: "14px 24px", position: "sticky", top: 0, zIndex: 10 }}>
        <div style={{ maxWidth: 820, margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: accent, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 }}>📋</div>
            <div>
              <h1 style={{ margin: 0, fontSize: 17, fontWeight: 700 }}>HC Grader</h1>
              <p style={{ margin: 0, fontSize: 11, color: textSecondary }}>Minerva University · Cornerstone Courses</p>
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            {gradingProgress && <span style={{ fontSize: 12, color: accent, fontWeight: 600 }}>{gradingProgress}</span>}
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <div style={{ width: 7, height: 7, borderRadius: "50%", background: connected ? "#22c55e" : "#ef4444" }} />
              <span style={{ fontSize: 12, color: textSecondary }}>{connected ? "Connected" : "Connecting..."}</span>
            </div>
            <button onClick={toggleTheme} style={{ background: "none", border: `1px solid ${border}`, borderRadius: 8, padding: "5px 9px", cursor: "pointer", fontSize: 15 }}>{dark ? "☀️" : "🌙"}</button>
            {submitted && <button onClick={handleReset} style={{ background: "none", border: `1px solid ${border}`, borderRadius: 8, padding: "6px 14px", cursor: "pointer", color: textSecondary, fontSize: 13 }}>↺ New Submission</button>}
          </div>
        </div>
      </header>

      <div style={{ maxWidth: 820, margin: "0 auto", padding: "28px 24px" }}>
        {!submitted && (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

            {/* Step 1 */}
            <div style={{ background: surface, borderRadius: 14, border: `1px solid ${border}`, padding: 22 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: textSecondary, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 12 }}>Step 1 — Select Cornerstone Course</div>
              <div ref={courseDropdownRef} style={{ position: "relative" }}>
                <button onClick={() => setCourseOpen(!courseOpen)} style={{ width: "100%", padding: "11px 16px", borderRadius: 10, border: `1px solid ${selectedCourse ? accent : border}`, background: inputBg, color: selectedCourse ? text : textSecondary, fontSize: 14, cursor: "pointer", textAlign: "left", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <span>{selectedCourse ? course?.label : "Choose a course..."}</span>
                  <span style={{ fontSize: 11, color: textSecondary }}>{courseOpen ? "▲" : "▼"}</span>
                </button>
                {courseOpen && (
                  <div style={{ position: "absolute", top: "calc(100% + 6px)", left: 0, right: 0, background: surface, border: `1px solid ${border}`, borderRadius: 12, overflow: "hidden", zIndex: 20, boxShadow: "0 8px 24px rgba(0,0,0,0.12)" }}>
                    {COURSES.map(c => (
                      <button key={c.id} onClick={() => { if (!c.available) return; setSelectedCourse(c.id); setSelectedHCs([]); setCourseOpen(false); }} style={{ width: "100%", padding: "12px 16px", border: "none", background: selectedCourse === c.id ? (dark ? "#2d1f0e" : "#fff7ed") : "none", color: !c.available ? textSecondary : text, fontSize: 14, cursor: c.available ? "pointer" : "not-allowed", textAlign: "left", display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: `1px solid ${border}` }}>
                        <span>{c.label}</span>
                        {!c.available && <span style={{ fontSize: 11, color: textSecondary, background: dark ? "#2a2d3a" : "#f3f4f6", padding: "2px 8px", borderRadius: 20 }}>Coming soon</span>}
                        {c.available && selectedCourse === c.id && <span style={{ color: accent }}>✓</span>}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Step 2 */}
            {selectedCourse && course?.available && (
              <div style={{ background: surface, borderRadius: 14, border: `1px solid ${border}`, padding: 22 }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: textSecondary, textTransform: "uppercase", letterSpacing: "0.06em" }}>Step 2 — Select HCs <span style={{ color: accent }}>({selectedHCs.length} selected)</span></div>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button onClick={() => setSelectedHCs(course.hcs.map(h => h.id))} style={{ fontSize: 12, color: accent, background: "none", border: "none", cursor: "pointer", padding: 0 }}>Select all</button>
                    <span style={{ color: border }}>·</span>
                    <button onClick={() => setSelectedHCs([])} style={{ fontSize: 12, color: textSecondary, background: "none", border: "none", cursor: "pointer", padding: 0 }}>Clear</button>
                  </div>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(185px, 1fr))", gap: 8 }}>
                  {course.hcs.map(hc => {
                    const isSelected = selectedHCs.includes(hc.id);
                    return (
                      <button key={hc.id} onClick={() => toggleHC(hc.id)} style={{ padding: "10px 13px", borderRadius: 10, border: `2px solid ${isSelected ? accent : border}`, background: isSelected ? (dark ? "#2d1f0e" : "#fff7ed") : inputBg, cursor: "pointer", textAlign: "left", transition: "all 0.12s" }}>
                        <div style={{ fontSize: 13, fontWeight: 700, color: isSelected ? accent : text, marginBottom: 2 }}>{hc.label}</div>
                        <div style={{ fontSize: 11, color: textSecondary, lineHeight: 1.3 }}>{hc.description}</div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Step 3 */}
            {selectedHCs.length > 0 && (
              <div style={{ background: surface, borderRadius: 14, border: `1px solid ${border}`, padding: 22 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: textSecondary, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 12 }}>Step 3 — What do you want?</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {MODES.map(mode => {
                    const isSelected = selectedModes.includes(mode.id);
                    return (
                      <button key={mode.id} onClick={() => toggleMode(mode.id)} style={{ padding: "13px 16px", borderRadius: 10, border: `2px solid ${isSelected ? accent : border}`, background: isSelected ? (dark ? "#2d1f0e" : "#fff7ed") : inputBg, cursor: "pointer", textAlign: "left", display: "flex", alignItems: "center", gap: 14, transition: "all 0.12s" }}>
                        <div style={{ width: 20, height: 20, borderRadius: 6, border: `2px solid ${isSelected ? accent : border}`, background: isSelected ? accent : "none", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, fontSize: 12, color: "#fff" }}>{isSelected ? "✓" : ""}</div>
                        <div>
                          <div style={{ fontSize: 14, fontWeight: 600, color: text }}>{mode.label}</div>
                          <div style={{ fontSize: 12, color: textSecondary }}>{mode.description}</div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Step 4 */}
            {selectedHCs.length > 0 && selectedModes.length > 0 && (
              <div style={{ background: surface, borderRadius: 14, border: `1px solid ${border}`, padding: 22 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: textSecondary, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 12 }}>Step 4 — Paste Your Work</div>
                <textarea value={studentWork} onChange={e => setStudentWork(e.target.value)} placeholder="Paste your work here — essay paragraph, footnote, presentation script, or any written submission..." rows={8} style={{ width: "100%", padding: "14px 16px", borderRadius: 10, border: `1px solid ${border}`, background: inputBg, color: text, fontSize: 14, lineHeight: 1.6, resize: "vertical", outline: "none", boxSizing: "border-box", fontFamily: "inherit" }} />
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 8 }}>
                  <span style={{ fontSize: 12, color: textSecondary }}>{studentWork.length > 0 ? `${studentWork.length} characters · ${selectedHCs.length} HC${selectedHCs.length > 1 ? "s" : ""} will be graded one at a time` : ""}</span>
                  <button onClick={handleGrade} disabled={!canSubmit} style={{ padding: "12px 28px", borderRadius: 10, border: "none", background: canSubmit ? accent : (dark ? "#2a2d3a" : "#e5e7eb"), color: canSubmit ? "#fff" : textSecondary, fontSize: 14, fontWeight: 700, cursor: canSubmit ? "pointer" : "not-allowed" }}>
                    Analyze My Work →
                  </button>
                </div>
              </div>
            )}

            {!selectedCourse && (
              <div style={{ textAlign: "center", padding: "48px 20px", color: textSecondary }}>
                <div style={{ fontSize: 52, marginBottom: 16 }}>📚</div>
                <p style={{ fontSize: 16, margin: "0 0 8px", color: text, fontWeight: 600 }}>Welcome to HC Grader</p>
                <p style={{ fontSize: 14, margin: "0 auto", maxWidth: 420, lineHeight: 1.6 }}>Select your Cornerstone course, pick the HCs you're being assessed on, and get instant grading, footnotes, and improvement tips.</p>
              </div>
            )}
          </div>
        )}

        {/* Results */}
        {messages.length > 0 && (
          <div style={{ background: surface, borderRadius: 14, border: `1px solid ${border}`, padding: 24, marginBottom: 16 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: textSecondary, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 16 }}>
              Results {gradingQueue.length > 0 && currentHCIndex < gradingQueue.length && <span style={{ color: accent }}>· Grading {currentHCIndex} of {gradingQueue.length}...</span>}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              {messages.map((message: UIMessage) => {
                const isUser = message.role === "user";
                return (
                  <div key={message.id} style={{ display: "flex", justifyContent: isUser ? "flex-end" : "flex-start", alignItems: "flex-start", gap: 10 }}>
                    {!isUser && <div style={{ width: 30, height: 30, borderRadius: 8, background: accent, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, flexShrink: 0 }}>📋</div>}
                    <div style={{ maxWidth: "88%", padding: isUser ? "10px 14px" : "14px 18px", borderRadius: isUser ? "16px 16px 4px 16px" : "16px 16px 16px 4px", background: isUser ? accent : (dark ? "#1e2130" : "#f3f4f6"), color: isUser ? "#fff" : text, fontSize: 14, lineHeight: 1.6 }}>
                      {message.parts.filter(p => p.type === "text").map((part, i) => {
                        const t = (part as { type: "text"; text: string }).text;
                        if (!t) return null;
                        if (isUser) {
                          // Show a clean summary for grading messages, full text for follow-ups
                          const isGradingMsg = t.includes("Student work:") || t.includes("same student work");
                          if (isGradingMsg) {
                            const hcMatch = t.match(/#\w+/g);
                            const hcLabel = hcMatch ? hcMatch[0] : "HC";
                            const num = t.match(/\((\d+) of (\d+)\)/);
                            return <div key={i} style={{ fontSize: 13 }}>{num ? `Grading ${hcLabel} (${num[1]} of ${num[2]})` : `Grading ${hcLabel}`}</div>;
                          }
                          return <div key={i}>{t}</div>;
                        }
                        return <Streamdown key={i} className="sd-theme" controls={false} isAnimating={isStreaming}>{t}</Streamdown>;
                      })}
                    </div>
                  </div>
                );
              })}
              {isStreaming && (
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={{ width: 30, height: 30, borderRadius: 8, background: accent, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13 }}>📋</div>
                  <div style={{ display: "flex", gap: 5 }}>{[0,1,2].map(i => <div key={i} style={{ width: 7, height: 7, borderRadius: "50%", background: accent, animation: "bounce 1.2s infinite", animationDelay: `${i*0.2}s` }} />)}</div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
          </div>
        )}

        {/* Follow-up */}
        {submitted && (
          <div style={{ background: surface, borderRadius: 14, border: `1px solid ${border}`, padding: 20 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: textSecondary, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 12 }}>Follow-up</div>
            <div style={{ display: "flex", gap: 10, marginBottom: 10 }}>
              <input value={chatInput} onChange={e => setChatInput(e.target.value)} onKeyDown={e => { if (e.key === "Enter") handleChat(); }} placeholder='e.g. "Rewrite my thesis" or "Why did I lose points on #medium?"' disabled={isStreaming} style={{ flex: 1, padding: "11px 14px", borderRadius: 10, border: `1px solid ${border}`, background: inputBg, color: text, fontSize: 14, outline: "none", fontFamily: "inherit" }} />
              <button onClick={handleChat} disabled={!chatInput.trim() || isStreaming} style={{ padding: "11px 20px", borderRadius: 10, border: "none", background: chatInput.trim() && !isStreaming ? accent : (dark ? "#2a2d3a" : "#e5e7eb"), color: chatInput.trim() && !isStreaming ? "#fff" : textSecondary, fontSize: 14, fontWeight: 600, cursor: chatInput.trim() && !isStreaming ? "pointer" : "not-allowed" }}>Send</button>
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {["Rewrite a weak section", "Improve my thesis", "Why did I lose points?", "What would a 5 look like?", "Write a better footnote"].map(p => (
                <button key={p} onClick={() => setChatInput(p)} style={{ padding: "5px 12px", borderRadius: 20, border: `1px solid ${border}`, background: "none", color: textSecondary, fontSize: 12, cursor: "pointer" }}>{p}</button>
              ))}
            </div>
          </div>
        )}
      </div>
      <style>{`@keyframes bounce{0%,80%,100%{transform:translateY(0)}40%{transform:translateY(-6px)}}*{box-sizing:border-box}textarea:focus{border-color:#f6821f!important;box-shadow:0 0 0 3px #f6821f22}input:focus{border-color:#f6821f!important;box-shadow:0 0 0 3px #f6821f22}`}</style>
    </div>
  );
}

export default function App() {
  return (
    <Suspense fallback={<div style={{ display:"flex", alignItems:"center", justifyContent:"center", height:"100vh" }}>Loading...</div>}>
      <HCGrader />
    </Suspense>
  );
}
