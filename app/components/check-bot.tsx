"use client";

import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore, type CSSProperties, type FormEvent, type PointerEvent as ReactPointerEvent } from "react";
import { usePathname } from "next/navigation";
import { mockCheckBotReply } from "../../lib/frontend/check-bot-mock";
import { askCheckBot } from "./check-bot-actions";
import { chatPanelPosition, CHECK_BOT_SIZE as SIZE } from "../../lib/frontend/check-bot-position";

type Message = { id: string; role: "user" | "bot"; text: string };
type Pos = { x: number; y: number };

const STORAGE_KEY = "planmirror-check-bot-pos";
const GREETING_KEY = "planmirror-check-bot-greeted";
const CHAT_KEY = "planmirror-check-bot-chat-v1";
let greetedInPage = false;
const MARGIN = 16;
const emptySubscribe = () => () => {};

function readChat(): Message[] {
  if (typeof window === "undefined") return [];
  try {
    const raw: unknown = JSON.parse(window.sessionStorage.getItem(CHAT_KEY) ?? "[]");
    if (!Array.isArray(raw)) return [];
    return raw.slice(-40).filter((item): item is Message => Boolean(item)
      && typeof item.id === "string" && item.id.length <= 256 && !item.id.startsWith("route-")
      && (item.role === "user" || item.role === "bot")
      && typeof item.text === "string" && item.text.length <= 6000);
  } catch { return []; }
}

function defaultPos(): Pos {
  if (typeof window === "undefined") return { x: MARGIN, y: MARGIN };
  return clamp({
    x: window.innerWidth - SIZE - Math.min(96, Math.max(MARGIN, window.innerWidth * .06)),
    y: window.innerHeight * .85 - SIZE,
  });
}

function clamp(pos: Pos): Pos {
  if (typeof window === "undefined") return pos;
  const maxX = Math.max(MARGIN, window.innerWidth - SIZE - MARGIN);
  const maxY = Math.max(MARGIN, window.innerHeight - SIZE - MARGIN);
  return {
    x: Math.min(maxX, Math.max(MARGIN, pos.x)),
    y: Math.min(maxY, Math.max(MARGIN, pos.y)),
  };
}

// External-store snapshots must have stable identity until their value changes.
// A serialized string also avoids allocating a fresh server snapshot per read.
function readPositionSnapshot(): string {
  try { return window.sessionStorage.getItem(STORAGE_KEY) ?? ""; }
  catch { return ""; }
}

function readStoredPos(raw: string): Pos {
  try {
    if (raw) {
      const parsed = JSON.parse(raw) as Pos;
      if (Number.isFinite(parsed?.x) && Number.isFinite(parsed?.y)) return clamp(parsed);
    }
  } catch { /* ignore */ }
  return defaultPos();
}

export default function CheckBot({ getPageContext, aiEnabled = false }: { getPageContext: () => { pathname: string; markdown: string }; aiEnabled?: boolean }) {
  const pathname = usePathname();
  const panelId = useId();
  const isClient = useSyncExternalStore(emptySubscribe, () => true, () => false);
  const positionSnapshot = useSyncExternalStore(emptySubscribe, readPositionSnapshot, () => "");
  const storedPos = useMemo(() => readStoredPos(positionSnapshot), [positionSnapshot]);
  const [dragPos, setDragPos] = useState<Pos | null>(null);
  const [dragShape, setDragShape] = useState({ stretch: 0, angle: 0 });
  const [gaze, setGaze] = useState<Pos>({ x: 0, y: 0 });
  const [open, setOpen] = useState(false);
  const [showGreeting, setShowGreeting] = useState(() => {
    if (typeof window === "undefined") return false;
    try { return !greetedInPage && window.sessionStorage.getItem(GREETING_KEY) !== "true"; }
    catch { return !greetedInPage; }
  });
  const [startupGreeting] = useState(() => {
    if (typeof window === "undefined") return "";
    const hour = new window.Date().getHours();
    return hour < 12 ? "Good morning!" : hour < 18 ? "Good afternoon!" : "Good evening!";
  });
  const [panelSize, setPanelSize] = useState({ width: 320, height: 360 });
  const panelRef = useRef<HTMLElement>(null);
  const launcherRef = useRef<HTMLButtonElement>(null);
  const [input, setInput] = useState("");
  const [pending, setPending] = useState(false);
  const [messages, setMessages] = useState<Message[]>(() => [{
    id: "welcome",
    role: "bot",
    text: aiEnabled ? "Hey! Ask me about this page or how to use PlanMirror. I'll read the page when you send a question." : "Hey! I'm in scripted preview mode until AI chat is configured. Ask me about this page.",
  }, ...readChat()]);
  const drag = useRef<{ pointerId: number; originX: number; originY: number; start: Pos; moved: boolean } | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const suppressClick = useRef(false);
  const replyTimer = useRef<number | undefined>(undefined);
  const dragFrame = useRef<number | undefined>(undefined);
  const nextDragPos = useRef<Pos | null>(null);
  const lastDragPos = useRef<Pos | null>(null);
  const pos = dragPos ?? storedPos;

  useEffect(() => {
    try {
      window.sessionStorage.setItem(CHAT_KEY, JSON.stringify(messages.filter(item => item.id !== "welcome" && !item.id.startsWith("route-")).slice(-40)));
    } catch { /* Chat remains usable when session storage is full or unavailable. */ }
  }, [messages]);

  useEffect(() => {
    if (!showGreeting) return;
    greetedInPage = true;
    try { window.sessionStorage.setItem(GREETING_KEY, "true"); }
    catch { /* Keep the in-page fallback when storage is unavailable. */ }
    const timer = window.setTimeout(() => setShowGreeting(false), 6000);
    return () => window.clearTimeout(timer);
  }, [showGreeting]);

  useLayoutEffect(() => {
    if (!open || !panelRef.current) return;
    const panel = panelRef.current;
    function measure() {
      const { width, height } = panel.getBoundingClientRect();
      if (width && height) setPanelSize(current => current.width === width && current.height === height ? current : { width, height });
    }
    measure();
    panel.querySelector("input")?.focus();
    const observer = typeof ResizeObserver === "undefined" ? undefined : new ResizeObserver(measure);
    observer?.observe(panel);
    return () => observer?.disconnect();
  }, [open]);

  useEffect(() => {
    if (!isClient) return;
    let frame: number | undefined;
    function look(event: PointerEvent) {
      if (event.pointerType === "touch" || drag.current) return;
      if (frame !== undefined) window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(() => {
        frame = undefined;
        const dx = event.clientX - (pos.x + SIZE / 2);
        const dy = event.clientY - (pos.y + SIZE / 2);
        const distance = Math.hypot(dx, dy);
        // Ease out at the edge of his attention range, with a stronger look nearby.
        const attention = Math.max(0, Math.min(1, (280 - distance) / 100));
        const strength = Math.min(distance / 35, 1) * 7 * attention;
        const next = distance > 0 ? { x: dx / distance * strength, y: dy / distance * strength } : { x: 0, y: 0 };
        setGaze(current => current.x === next.x && current.y === next.y ? current : next);
      });
    }
    function reset() {
      if (frame !== undefined) window.cancelAnimationFrame(frame);
      frame = undefined;
      setGaze(current => current.x || current.y ? { x: 0, y: 0 } : current);
    }
    function leave(event: PointerEvent) { if (!event.relatedTarget) reset(); }
    window.addEventListener("pointermove", look, { passive: true });
    window.addEventListener("pointerout", leave);
    window.addEventListener("blur", reset);
    return () => {
      if (frame !== undefined) window.cancelAnimationFrame(frame);
      window.removeEventListener("pointermove", look);
      window.removeEventListener("pointerout", leave);
      window.removeEventListener("blur", reset);
    };
  }, [isClient, pos.x, pos.y]);

  useEffect(() => {
    function onResize() {
      setDragPos((current) => clamp(current ?? readStoredPos(readPositionSnapshot())));
    }
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  useEffect(() => {
    listRef.current?.scrollTo?.({ top: listRef.current.scrollHeight, behavior: "instant" });
  }, [messages, open]);

  useEffect(() => () => {
    window.clearTimeout(replyTimer.current);
    if (dragFrame.current !== undefined) window.cancelAnimationFrame(dragFrame.current);
  }, []);

  function persist(next: Pos) {
    const value = clamp(next);
    setDragPos(value);
    try { window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(value)); } catch { /* ignore */ }
  }

  function onPointerDown(event: ReactPointerEvent<HTMLButtonElement>) {
    if (event.button !== 0) return;
    suppressClick.current = false;
    nextDragPos.current = null;
    lastDragPos.current = pos;
    event.currentTarget.setPointerCapture(event.pointerId);
    drag.current = {
      pointerId: event.pointerId,
      originX: event.clientX,
      originY: event.clientY,
      start: pos,
      moved: false,
    };
  }

  function onPointerMove(event: ReactPointerEvent<HTMLButtonElement>) {
    const state = drag.current;
    if (!state || state.pointerId !== event.pointerId) return;
    const dx = event.clientX - state.originX;
    const dy = event.clientY - state.originY;
    if (Math.hypot(dx, dy) > 4) state.moved = true;
    if (state.moved) {
      nextDragPos.current = clamp({ x: state.start.x + dx, y: state.start.y + dy });
      if (dragFrame.current === undefined) {
        dragFrame.current = window.requestAnimationFrame(() => {
          dragFrame.current = undefined;
          if (nextDragPos.current) {
            const previous = lastDragPos.current ?? nextDragPos.current;
            const vx = nextDragPos.current.x - previous.x;
            const vy = nextDragPos.current.y - previous.y;
            const speed = Math.hypot(vx, vy);
            setDragShape({ stretch: Math.min(speed / 100, .28), angle: speed > 1 ? Math.atan2(vy, vx) * 180 / Math.PI : 0 });
            lastDragPos.current = nextDragPos.current;
            setDragPos(nextDragPos.current);
          }
        });
      }
    }
  }

  function onPointerUp(event: ReactPointerEvent<HTMLButtonElement>) {
    const state = drag.current;
    if (!state || state.pointerId !== event.pointerId) return;
    drag.current = null;
    if (dragFrame.current !== undefined) window.cancelAnimationFrame(dragFrame.current);
    dragFrame.current = undefined;
    if (state.moved && nextDragPos.current) persist(nextDragPos.current);
    setDragShape({ stretch: 0, angle: 0 });
    try { event.currentTarget.releasePointerCapture(event.pointerId); } catch { /* ignore */ }
    suppressClick.current = state.moved;
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    const text = input.trim();
    if (!text || pending) return;
    setMessages((current) => [...current, { id: `user-${Date.now()}`, role: "user", text }]);
    setInput("");
    setPending(true);

    const context = getPageContext();
    if (aiEnabled) {
      try {
        const markdown = context.markdown.length > 24_000 ? `${context.markdown.slice(0, 24_000)}\n[Page snapshot truncated]` : context.markdown;
        const result = await askCheckBot({ pathname: context.pathname || pathname, markdown, message: text,
          history: messages.filter(item => item.id !== "welcome" && !item.id.startsWith("error-") && !item.id.startsWith("route-")).slice(-6).map(item => ({ role: item.role === "bot" ? "assistant" : "user", text: item.text.slice(0, 3000) })),
        });
        setMessages(current => [...current, { id: `${result.ok ? "bot" : "error"}-${Date.now()}`, role: "bot", text: result.ok ? result.reply : result.error }]);
      } catch {
        setMessages(current => [...current, { id: `error-${Date.now()}`, role: "bot", text: "The connection was interrupted. Please try again." }]);
      } finally { setPending(false); }
      return;
    }
    replyTimer.current = window.setTimeout(() => {
      const reply = mockCheckBotReply({ pathname: context.pathname || pathname, message: text, pageMarkdown: context.markdown });
      setMessages((current) => [...current, { id: `bot-${Date.now()}`, role: "bot", text: reply }]);
      setPending(false);
    }, 280);
  }

  const viewport = isClient ? { width: window.innerWidth, height: window.innerHeight } : { width: 1024, height: 768 };
  const panelPosition = chatPanelPosition(pos, {
    width: Math.min(panelSize.width, viewport.width - MARGIN * 2),
    height: Math.min(panelSize.height, viewport.height - MARGIN * 2),
  }, viewport, SIZE);

  return (
    <div className="pm-check-bot" data-markdown-exclude data-testid="check-bot" style={{ ...(isClient ? { top: 0, left: 0, right: "auto", bottom: "auto", transform: `translate3d(${pos.x}px, ${pos.y}px, 0)` } : {}), "--bot-stretch": dragShape.stretch, "--bot-angle": `${dragShape.angle}deg`, "--bot-gaze-x": `${gaze.x}px`, "--bot-gaze-y": `${gaze.y}px` } as CSSProperties}>
      {isClient && showGreeting && !open && <span className="pm-check-bot-greeting" style={{ left: Math.max(-112, MARGIN - pos.x) }} data-below={pos.y < 80}>{startupGreeting}</span>}
      {open && (
        <section ref={panelRef} className="pm-check-bot-panel" style={panelPosition} id={panelId} aria-label="PlanMirror check bot chat" onKeyDown={event => {
          if (event.key === "Escape") { setOpen(false); launcherRef.current?.focus(); }
        }}>
          <header className="pm-check-bot-header">
            <div>
              <p className="pm-check-bot-kicker">{aiEnabled ? "AI guide · Current page context" : "Scripted preview · No AI connected"}</p>
              <h2>Check bot</h2>
            </div>
            <button type="button" className="pm-check-bot-close" onClick={() => { setOpen(false); launcherRef.current?.focus(); }} aria-label="Close check bot chat">×</button>
          </header>
          <div className="pm-check-bot-messages" ref={listRef} role="log" aria-live="polite">
            {messages.filter(message => !message.id.startsWith("route-")).map((message) => (
              <p key={message.id} className={`pm-check-bot-bubble pm-check-bot-${message.role}`}>{message.text}</p>
            ))}
            {pending && <p className="pm-check-bot-bubble pm-check-bot-bot" role="status">Reading the page…</p>}
          </div>
          <form className="pm-check-bot-form" onSubmit={onSubmit}>
            <label className="sr-only" htmlFor={`${panelId}-input`}>Message</label>
            <input
              id={`${panelId}-input`}
              value={input}
              onChange={(event) => setInput(event.target.value)}
              placeholder="Ask about this page…"
              autoComplete="off"
              maxLength={1500}
              disabled={pending}
            />
            <button type="submit" className="pm-primary-action" disabled={pending || !input.trim()}>Send</button>
          </form>
        </section>
      )}

      <button
        ref={launcherRef}
        disabled={!isClient}
        aria-busy={!isClient}
        type="button"
        className="pm-check-bot-fab"
        aria-label={open ? "Close check bot" : "Open check bot"}
        aria-expanded={open}
        aria-controls={panelId}
        title="Click to chat · Drag or use arrow keys to move"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onClick={event => {
          setShowGreeting(false);
          if (event.detail === 0 || !suppressClick.current) setOpen((value) => !value);
          suppressClick.current = false;
        }}
        onKeyDown={(event) => {
          const directions: Record<string, Pos> = { ArrowLeft: { x: -16, y: 0 }, ArrowRight: { x: 16, y: 0 }, ArrowUp: { x: 0, y: -16 }, ArrowDown: { x: 0, y: 16 } };
          const delta = directions[event.key];
          if (delta) { event.preventDefault(); persist({ x: pos.x + delta.x, y: pos.y + delta.y }); }
          if (event.key === "Escape") setOpen(false);
        }}
      >
        <span className="pm-check-bot-character" aria-hidden="true">
          <span className="pm-check-bot-eye" />
          <span className="pm-check-bot-eye" />
          <span className="pm-check-bot-cheek pm-check-bot-cheek-left" />
          <span className="pm-check-bot-cheek pm-check-bot-cheek-right" />
          <span className="pm-check-bot-smile" />
        </span>
      </button>
    </div>
  );
}
