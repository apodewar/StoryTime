"use client";

import { useEffect, useMemo, useState } from "react";
import { createUuid } from "../lib/uuid";

type ReaderProps = {
  storyId: string;
  storyBody: string;
  storyBodyId?: string;
  initialMode?: "scroll" | "page";
};

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

const getSessionId = () => {
  const key = "storytime.anonSessionId";
  const existing = window.localStorage.getItem(key);
  if (existing) return existing;
  const id = `anon_${createUuid()}`;
  window.localStorage.setItem(key, id);
  return id;
};

const sendEvent = async (
  storyId: string,
  eventType: "impression" | "open" | "complete",
) => {
  try {
    const anonSessionId = getSessionId();
    await fetch("/api/events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ storyId, eventType, anonSessionId }),
      keepalive: true,
    });
  } catch {
    // ignore telemetry errors
  }
};

export default function Reader({
  storyId,
  storyBody,
  storyBodyId = "story-body",
  initialMode = "scroll",
}: ReaderProps) {
  const [progress, setProgress] = useState(0);
  const [mode, setMode] = useState<"scroll" | "page">(initialMode);
  const [pageIndex, setPageIndex] = useState(0);

  const impressionStorageKey = useMemo(
    () => `storytime.impression.${storyId}`,
    [storyId],
  );
  const openStorageKey = useMemo(() => `storytime.open.${storyId}`, [storyId]);

  useEffect(() => {
    if (window.sessionStorage.getItem(impressionStorageKey) !== "1") {
      window.sessionStorage.setItem(impressionStorageKey, "1");
      sendEvent(storyId, "impression");
    }
    if (window.sessionStorage.getItem(openStorageKey) !== "1") {
      window.sessionStorage.setItem(openStorageKey, "1");
      sendEvent(storyId, "open");
    }
  }, [impressionStorageKey, openStorageKey, storyId]);

  useEffect(() => {
    setMode(initialMode);
  }, [initialMode]);

  const pages = useMemo(() => {
    const paragraphs = storyBody
      .split(/\n{2,}/)
      .map((part) => part.trim())
      .filter(Boolean);

    if (paragraphs.length === 0) {
      return [storyBody];
    }

    const chunks: string[] = [];
    const pageSize = 6;
    for (let i = 0; i < paragraphs.length; i += pageSize) {
      chunks.push(paragraphs.slice(i, i + pageSize).join("\n\n"));
    }
    return chunks;
  }, [storyBody]);

  useEffect(() => {
    if (mode !== "page") return;
    const maxIndex = Math.max(pages.length - 1, 0);
    if (pageIndex > maxIndex) {
      setPageIndex(maxIndex);
    }
    setProgress(((Math.min(pageIndex, maxIndex) + 1) / Math.max(pages.length, 1)) * 100);
  }, [mode, pageIndex, pages.length]);

  useEffect(() => {
    const computeProgress = () => {
      const bodyElement = document.getElementById(storyBodyId);
      if (!bodyElement) return;

      const rect = bodyElement.getBoundingClientRect();
      const elementStart = window.scrollY + rect.top;
      const elementEnd = elementStart + bodyElement.scrollHeight - window.innerHeight;

      if (elementEnd <= elementStart) {
        const shortProgress = rect.bottom <= window.innerHeight ? 100 : 0;
        setProgress(shortProgress);
        return;
      }

      const raw = ((window.scrollY - elementStart) / (elementEnd - elementStart)) * 100;
      const next = clamp(raw, 0, 100);
      setProgress(next);
    };

    const onScroll = () => {
      computeProgress();
    };

    computeProgress();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", computeProgress);

    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", computeProgress);
    };
  }, [storyBodyId]);

  return (
    <section className="space-y-4">
      <div className="sticky top-[68px] z-10">
        <div className="h-2 overflow-hidden rounded-full bg-slate-200">
          <div
            className="h-full rounded-full bg-slate-900 transition-[width] duration-150"
            style={{ width: `${progress}%` }}
          />
        </div>
        <p className="mt-1 text-right text-[11px] font-semibold text-slate-500">
          {Math.round(progress)}%
        </p>
      </div>

      <div className="flex items-center justify-end">
        <div className="inline-flex rounded-lg border border-slate-300 bg-white p-1 text-xs">
          <button
            type="button"
            onClick={() => setMode("scroll")}
            className={`rounded px-2 py-1 ${mode === "scroll" ? "bg-slate-900 text-white" : "text-slate-600"}`}
          >
            Scroll
          </button>
          <button
            type="button"
            onClick={() => setMode("page")}
            className={`rounded px-2 py-1 ${mode === "page" ? "bg-slate-900 text-white" : "text-slate-600"}`}
          >
            Page-turn
          </button>
        </div>
      </div>

      {mode === "scroll" ? (
        <div
          id={storyBodyId}
          className="reader whitespace-pre-wrap space-y-4 text-lg leading-7 text-slate-900"
        >
          {storyBody}
        </div>
      ) : (
        <div className="space-y-4">
          <div className="reader min-h-[45vh] whitespace-pre-wrap rounded-2xl border border-slate-200 bg-white p-5 text-lg leading-7 text-slate-900">
            {pages[pageIndex]}
          </div>
          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={() => setPageIndex((prev) => Math.max(prev - 1, 0))}
              disabled={pageIndex === 0}
              className="rounded-lg border border-slate-300 px-3 py-1 text-xs font-semibold text-slate-700 disabled:opacity-50"
            >
              Previous
            </button>
            <span className="text-xs text-slate-500">
              Page {pageIndex + 1} of {pages.length}
            </span>
            <button
              type="button"
              onClick={() => setPageIndex((prev) => Math.min(prev + 1, pages.length - 1))}
              disabled={pageIndex >= pages.length - 1}
              className="rounded-lg border border-slate-300 px-3 py-1 text-xs font-semibold text-slate-700 disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
