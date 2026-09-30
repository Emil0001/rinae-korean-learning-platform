"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import styled from "styled-components";

type ParsedCustomUi = { html: string };

export function parseCustomUiContent(content: string): ParsedCustomUi | null {
  const trimmed = content.trim();
  if (!trimmed.startsWith("{")) return null;

  try {
    const parsed = JSON.parse(trimmed) as {
      customUi?: { version?: number; html?: string };
    };
    const html = parsed.customUi?.html?.trim();
    return html ? { html } : null;
  } catch {
    return null;
  }
}

export function SandboxedLessonUi({
  title,
  html,
  frameId,
}: {
  title: string;
  html: string;
  frameId: string;
}) {
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const [height, setHeight] = useState(680);
  const srcDoc = useMemo(() => buildCustomUiDocument(html, frameId), [html, frameId]);

  useEffect(() => {
    const receiveFrameMessage = (event: MessageEvent) => {
      if (event.source !== iframeRef.current?.contentWindow) return;
      const payload = event.data as { type?: string; frameId?: string; height?: number };
      if (payload.type !== "lesson-ui-height" || payload.frameId !== frameId) return;
      if (typeof payload.height !== "number" || !Number.isFinite(payload.height)) return;
      setHeight(Math.max(320, Math.min(2400, Math.ceil(payload.height))));
    };

    window.addEventListener("message", receiveFrameMessage);
    return () => window.removeEventListener("message", receiveFrameMessage);
  }, [frameId]);

  return (
    <CustomUiFrameShell>
      <CustomUiFrame
        ref={iframeRef}
        title={title}
        sandbox="allow-scripts"
        srcDoc={srcDoc}
        style={{ height }}
      />
    </CustomUiFrameShell>
  );
}

function buildCustomUiDocument(html: string, frameId: string) {
  const safeFrameId = JSON.stringify(frameId);
  return `<!doctype html>
<html lang="ru">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data:; media-src data: blob:; style-src 'unsafe-inline'; script-src 'unsafe-inline'; connect-src 'none'; font-src 'none'; form-action 'none'; base-uri 'none'" />
  <style>
    * { box-sizing: border-box; }
    html, body { margin: 0; min-height: 100%; background: transparent; color: #111a36; font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
    body { padding: 2px; }
    button, input { font: inherit; }
    button { cursor: pointer; }
    [data-screen][hidden] { display: none !important; }
    .is-correct { border-color: #20b26b !important; background: #eafff2 !important; color: #08743f !important; }
    .is-wrong { border-color: #ff6b7d !important; background: #fff0f2 !important; color: #bf2444 !important; }
  </style>
</head>
<body>
${html}
<style>
  /*
   * The lesson card already provides the page surface. Generated UI should use
   * that surface instead of nesting another centered page/card inside it.
   * This trusted style is intentionally placed after generated CSS.
   */
  html, body {
    width: 100% !important;
    background: transparent !important;
  }
  body {
    padding: 0 !important;
  }
  .lesson-ai-ui {
    display: block !important;
    width: 100% !important;
    max-width: none !important;
    min-width: 0 !important;
    margin: 0 !important;
    border: 0 !important;
    border-radius: 0 !important;
    background: transparent !important;
    box-shadow: none !important;
    padding: 0 !important;
  }
</style>
<script>
(() => {
  const frameId = ${safeFrameId};
  const sendHeight = () => parent.postMessage({ type: "lesson-ui-height", frameId, height: document.documentElement.scrollHeight + 4 }, "*");
  const normalize = (value) => String(value || "").trim().toLowerCase().replace(/[.,!?！？。\\s]/g, "");

  document.addEventListener("click", (event) => {
    const target = event.target instanceof Element ? event.target.closest("button, [role='button']") : null;
    if (!target) return;

    if (target.hasAttribute("data-speak")) {
      const utterance = new SpeechSynthesisUtterance(target.getAttribute("data-speak") || "");
      utterance.lang = "ko-KR";
      speechSynthesis.cancel();
      speechSynthesis.speak(utterance);
    }

    if (target.hasAttribute("data-answer")) {
      const question = target.closest("[data-question]");
      if (question) {
        const correct = target.getAttribute("data-correct") === "true";
        question.querySelectorAll("[data-answer]").forEach((answer) => {
          answer.classList.remove("is-correct", "is-wrong");
          if (answer.getAttribute("data-correct") === "true") answer.classList.add("is-correct");
        });
        if (!correct) target.classList.add("is-wrong");
        const feedback = question.querySelector("[data-feedback]");
        if (feedback) feedback.textContent = correct ? "Верно! Отличная работа ✓" : "Почти! Правильный ответ подсвечен.";
      }
    }

    if (target.hasAttribute("data-check-input")) {
      const question = target.closest("[data-question]");
      const input = question && question.querySelector("[data-answer-input]");
      const feedback = question && question.querySelector("[data-feedback]");
      const correctAnswer = question && question.getAttribute("data-correct-answer");
      const correct = input && normalize(input.value) === normalize(correctAnswer);
      if (input) input.classList.toggle("is-correct", Boolean(correct));
      if (input) input.classList.toggle("is-wrong", !correct);
      if (feedback) feedback.textContent = correct ? "Верно! Отличная работа ✓" : "Проверьте ответ ещё раз.";
    }

    const screenButton = target.closest("[data-next], [data-previous]");
    if (screenButton) {
      const screens = Array.from(document.querySelectorAll("[data-screen]"));
      const current = screens.findIndex((screen) => !screen.hasAttribute("hidden"));
      const direction = screenButton.hasAttribute("data-next") ? 1 : -1;
      const next = Math.max(0, Math.min(screens.length - 1, current + direction));
      screens.forEach((screen, index) => index === next ? screen.removeAttribute("hidden") : screen.setAttribute("hidden", ""));
    }

    requestAnimationFrame(sendHeight);
  });

  const screens = Array.from(document.querySelectorAll("[data-screen]"));
  screens.forEach((screen, index) => index === 0 ? screen.removeAttribute("hidden") : screen.setAttribute("hidden", ""));
  new ResizeObserver(sendHeight).observe(document.body);
  addEventListener("load", sendHeight);
  sendHeight();
})();
</script>
</body>
</html>`;
}

const CustomUiFrameShell = styled.div`
  width: 100%;
  overflow: hidden;
  border: 0;
  border-radius: 0;
  background: transparent;
  box-shadow: none;
`;

const CustomUiFrame = styled.iframe`
  display: block;
  width: 100%;
  min-height: 320px;
  border: 0;
  background: transparent;
  transition: height 260ms ease;
`;

