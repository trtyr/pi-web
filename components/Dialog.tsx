"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import { useI18n } from "@/hooks/useI18n";

export type DialogTone = "default" | "danger";

export interface DialogConfirmOptions {
  title?: string;
  message: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: DialogTone;
}

export interface DialogAlertOptions {
  title?: string;
  message: ReactNode;
  confirmLabel?: string;
  tone?: DialogTone;
}

export interface DialogPromptOptions {
  title?: string;
  message?: ReactNode;
  defaultValue?: string;
  placeholder?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: DialogTone;
}

export interface DialogsApi {
  confirm: (options: DialogConfirmOptions) => Promise<boolean>;
  alert: (options: DialogAlertOptions) => Promise<void>;
  prompt: (options: DialogPromptOptions) => Promise<string | null>;
}

type DialogRequest =
  | { id: number; kind: "confirm"; options: DialogConfirmOptions; settled: boolean; resolve: (value: boolean) => void }
  | { id: number; kind: "alert"; options: DialogAlertOptions; settled: boolean; resolve: (value: undefined) => void }
  | {
      id: number;
      kind: "prompt";
      options: DialogPromptOptions;
      settled: boolean;
      resolve: (value: string | null) => void;
    };

const DialogsContext = createContext<DialogsApi | null>(null);

export function useDialogs(): DialogsApi {
  const api = useContext(DialogsContext);
  if (!api) throw new Error("useDialogs must be used within <DialogsProvider>");
  return api;
}

export function DialogsProvider({ children }: { children: ReactNode }) {
  const [queue, setQueue] = useState<DialogRequest[]>([]);
  const queueRef = useRef<DialogRequest[]>([]);
  queueRef.current = queue;
  const nextIdRef = useRef(1);

  const push = useCallback((kind: DialogRequest["kind"], options: unknown) => {
    return new Promise<unknown>((resolve) => {
      setQueue((current) => [
        ...current,
        { id: nextIdRef.current++, kind, options, settled: false, resolve } as DialogRequest,
      ]);
    });
  }, []);

  const settle = useCallback((value: unknown) => {
    const head = queueRef.current[0];
    if (!head || head.settled) return;
    head.settled = true;
    setQueue((current) => current.slice(1));
    (head.resolve as (value: unknown) => void)(value);
  }, []);

  const api = useMemo<DialogsApi>(
    () => ({
      confirm: (options) => push("confirm", options) as Promise<boolean>,
      alert: (options) => push("alert", options).then(() => undefined),
      prompt: (options) => push("prompt", options) as Promise<string | null>,
    }),
    [push],
  );

  return (
    <DialogsContext.Provider value={api}>
      {children}
      {queue.length > 0 && <DialogCard key={queue[0].id} request={queue[0]} onSettle={settle} />}
    </DialogsContext.Provider>
  );
}

const backdropStyle: CSSProperties = {
  position: "fixed",
  inset: 0,
  zIndex: 1100,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: 16,
  background: "rgba(0,0,0,0.4)",
};

const cardStyle: CSSProperties = {
  width: 440,
  maxWidth: "100%",
  border: "1px solid var(--border)",
  borderRadius: 8,
  background: "var(--bg-panel)",
  boxShadow: "0 12px 36px rgba(0,0,0,0.24)",
  overflow: "hidden",
};

const footerStyle: CSSProperties = {
  display: "flex",
  justifyContent: "flex-end",
  gap: 8,
  padding: "10px 18px",
  borderTop: "1px solid var(--border)",
};

function secondaryButtonStyle(disabled: boolean): CSSProperties {
  return {
    height: 32,
    padding: "0 12px",
    border: "1px solid var(--border)",
    borderRadius: 5,
    background: "transparent",
    color: "var(--text-muted)",
    cursor: disabled ? "not-allowed" : "pointer",
    fontSize: 12,
  };
}

function primaryButtonStyle(tone: DialogTone): CSSProperties {
  const danger = tone === "danger";
  return {
    height: 32,
    padding: "0 12px",
    border: `1px solid ${danger ? "#ef4444" : "var(--accent)"}`,
    borderRadius: 5,
    background: danger ? "#ef4444" : "var(--accent)",
    color: danger ? "#ffffff" : "var(--accent-contrast)",
    cursor: "pointer",
    fontSize: 12,
    fontWeight: 600,
  };
}

function DangerIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="#ef4444"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      style={{ flexShrink: 0, marginTop: 1 }}
    >
      <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
      <path d="M12 9v4" />
      <path d="M12 17h.01" />
    </svg>
  );
}

function DialogCard({ request, onSettle }: { request: DialogRequest; onSettle: (value: unknown) => void }) {
  const { t } = useI18n();
  // The queue only ever shows one request per card instance (keyed by id), so the
  // options union collapses to the concrete kind here.
  const options = request.options as DialogConfirmOptions & DialogAlertOptions & DialogPromptOptions;
  const [value, setValue] = useState(options.defaultValue ?? "");
  const inputRef = useRef<HTMLInputElement | null>(null);
  const confirmRef = useRef<HTMLButtonElement | null>(null);
  const cancelRef = useRef<HTMLButtonElement | null>(null);

  const tone: DialogTone = options.tone ?? "default";
  const confirmLabel = options.confirmLabel ?? t("common.ok");
  const cancelLabel = options.cancelLabel ?? t("common.cancel");

  const handleCancel = useCallback(() => {
    if (request.kind === "confirm") onSettle(false);
    else if (request.kind === "prompt") onSettle(null);
    else onSettle(undefined);
  }, [request.kind, onSettle]);

  const handleConfirm = useCallback(() => {
    if (request.kind === "confirm") onSettle(true);
    else if (request.kind === "prompt") onSettle(value);
    else onSettle(undefined);
  }, [request.kind, onSettle, value]);

  useEffect(() => {
    if (request.kind === "prompt") {
      inputRef.current?.focus();
      inputRef.current?.select();
      return;
    }
    // For destructive actions the safe action gets focus, so a stray Enter or
    // Space cannot trigger it.
    const target = request.kind === "confirm" && tone === "danger" ? cancelRef.current : confirmRef.current;
    target?.focus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      // Capture phase: the dialog owns Escape while it is open, so app-level
      // hotkeys behind it do not react at the same time.
      event.stopPropagation();
      handleCancel();
    };
    document.addEventListener("keydown", onKeyDown, true);
    return () => document.removeEventListener("keydown", onKeyDown, true);
  }, [handleCancel]);

  const titleId = `pi-dialog-title-${request.id}`;

  return (
    <div
      role="presentation"
      style={backdropStyle}
      onClick={(event) => {
        if (event.target === event.currentTarget) handleCancel();
      }}
    >
      <form
        role="dialog"
        aria-modal="true"
        aria-labelledby={options.title ? titleId : undefined}
        aria-label={options.title ? undefined : "Dialog"}
        style={cardStyle}
        onSubmit={(event) => {
          event.preventDefault();
          handleConfirm();
        }}
      >
        <div style={{ display: "flex", gap: 12, padding: "18px 18px 14px" }}>
          {tone === "danger" && <DangerIcon />}
          <div style={{ minWidth: 0 }}>
            {options.title && (
              <div id={titleId} style={{ fontSize: 15, fontWeight: 700, color: "var(--text)" }}>
                {options.title}
              </div>
            )}
            {options.message != null && (
              <div
                style={{
                  marginTop: options.title ? 7 : 0,
                  fontSize: 12,
                  lineHeight: 1.6,
                  color: "var(--text-muted)",
                  overflowWrap: "anywhere",
                }}
              >
                {options.message}
              </div>
            )}
            {request.kind === "prompt" && (
              <input
                ref={inputRef}
                type="text"
                value={value}
                placeholder={options.placeholder}
                onChange={(event) => setValue(event.target.value)}
                style={{
                  display: "block",
                  width: "100%",
                  marginTop: options.title || options.message ? 10 : 0,
                  padding: "8px 10px",
                  border: "1px solid var(--border)",
                  borderRadius: 5,
                  background: "var(--bg)",
                  color: "var(--text)",
                  fontSize: 12,
                }}
              />
            )}
          </div>
        </div>
        <div style={footerStyle}>
          {request.kind !== "alert" && (
            <button ref={cancelRef} type="button" onClick={handleCancel} style={secondaryButtonStyle(false)}>
              {cancelLabel}
            </button>
          )}
          <button ref={confirmRef} type="submit" style={primaryButtonStyle(tone)}>
            {confirmLabel}
          </button>
        </div>
      </form>
    </div>
  );
}
