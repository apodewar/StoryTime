"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { supabase } from "../../../lib/supabase/client";

type StoryRow = {
  id: string;
  title: string;
  slug: string;
  body: string;
  reading_time: number;
  genre: string;
  tags?: string | null;
  original_author?: string | null;
  is_public_domain?: boolean | null;
  cover_url?: string | null;
  author_id: string | null;
};

const splitIntoPages = (text: string, wordsPerPage: number) => {
  const words = text.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return [""];
  const pages: string[] = [];
  for (let i = 0; i < words.length; i += wordsPerPage) {
    pages.push(words.slice(i, i + wordsPerPage).join(" "));
  }
  return pages;
};

export default function SwipeFeedPage() {
  const [stories, setStories] = useState<StoryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [pageIndex, setPageIndex] = useState(0);
  const [animating, setAnimating] = useState(false);
  const [storyTransition, setStoryTransition] = useState<"up" | "down" | null>(
    null,
  );
  const [pageTransition, setPageTransition] = useState<"next" | "prev" | null>(
    null,
  );
  const [touchStart, setTouchStart] = useState<{ x: number; y: number } | null>(
    null,
  );
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let isMounted = true;

    const loadStories = async () => {
      setLoading(true);
      setError(null);

      const { data, error: queryError } = await supabase
        .from("stories")
        .select(
          "id, title, slug, body, reading_time, genre, tags, original_author, is_public_domain, cover_url, author_id"
        )
        .eq("status", "published")
        .order("published_at", { ascending: false })
        .limit(50);

      if (!isMounted) return;

      if (queryError) {
        setError("Unable to load stories right now.");
        setStories([]);
      } else {
        setStories((data ?? []) as StoryRow[]);
      }

      setLoading(false);
    };

    loadStories();

    return () => {
      isMounted = false;
    };
  }, []);

  const activeStory = stories[activeIndex];

  const pages = useMemo(() => {
    if (!activeStory?.body) return [""];
    return splitIntoPages(activeStory.body, 140);
  }, [activeStory]);

  useEffect(() => {
    setPageIndex(0);
  }, [activeIndex]);

  const goNextStory = useCallback(() => {
    if (animating) return;
    setAnimating(true);
    setStoryTransition("down");
    setTimeout(() => {
      setActiveIndex((prev) => Math.min(prev + 1, stories.length - 1));
      setStoryTransition(null);
      setAnimating(false);
    }, 260);
  }, [animating, stories.length]);

  const goPrevStory = useCallback(() => {
    if (animating) return;
    setAnimating(true);
    setStoryTransition("up");
    setTimeout(() => {
      setActiveIndex((prev) => Math.max(prev - 1, 0));
      setStoryTransition(null);
      setAnimating(false);
    }, 260);
  }, [animating]);

  const goNextPage = useCallback(() => {
    if (animating) return;
    setAnimating(true);
    setPageTransition("next");
    setTimeout(() => {
      setPageIndex((prev) => Math.min(prev + 1, pages.length - 1));
      setPageTransition(null);
      setAnimating(false);
    }, 200);
  }, [animating, pages.length]);

  const goPrevPage = useCallback(() => {
    if (animating) return;
    setAnimating(true);
    setPageTransition("prev");
    setTimeout(() => {
      setPageIndex((prev) => Math.max(prev - 1, 0));
      setPageTransition(null);
      setAnimating(false);
    }, 200);
  }, [animating]);

  const handleTouchStart = (event: React.TouchEvent) => {
    const touch = event.touches[0];
    if (!touch) return;
    setTouchStart({ x: touch.clientX, y: touch.clientY });
  };

  const handleTouchEnd = (event: React.TouchEvent) => {
    if (!touchStart) return;
    const touch = event.changedTouches[0];
    if (!touch) return;

    const deltaX = touch.clientX - touchStart.x;
    const deltaY = touch.clientY - touchStart.y;
    const absX = Math.abs(deltaX);
    const absY = Math.abs(deltaY);
    const threshold = 40;

    setTouchStart(null);

    if (absX < threshold && absY < threshold) return;

    if (absX > absY) {
      if (deltaX < 0) {
        goNextPage();
      } else {
        goPrevPage();
      }
    } else {
      if (deltaY < 0) {
        goNextStory();
      } else {
        goPrevStory();
      }
    }
  };

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === "ArrowDown") goNextStory();
    if (event.key === "ArrowUp") goPrevStory();
    if (event.key === "ArrowRight") goNextPage();
    if (event.key === "ArrowLeft") goPrevPage();
  };

  if (loading) {
    return (
      <div className="rounded-lg border border-slate-200 bg-white p-6 text-slate-600">
        Loading stories...
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border border-rose-200 bg-rose-50 p-6 text-rose-700">
        {error}
      </div>
    );
  }

  if (!activeStory) {
    return (
      <div className="rounded-lg border border-slate-200 bg-white p-6 text-slate-600">
        No stories available.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Swipe mode</h1>
          <p className="text-sm text-slate-600">
            Swipe down for next story, swipe right for next page.
          </p>
        </div>
        <Link
          href="/feed"
          className="rounded-full border border-slate-300 px-3 py-1 text-xs font-semibold text-slate-700 transition hover:border-slate-400"
        >
          Back to feed
        </Link>
      </div>

      <div
        ref={containerRef}
        role="application"
        tabIndex={0}
        onKeyDown={handleKeyDown}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        className={`book-surface flex min-h-[70vh] flex-col justify-between rounded-3xl p-6 transition-transform duration-300 ease-out ${
          storyTransition === "down"
            ? "-translate-y-6 opacity-0"
            : storyTransition === "up"
              ? "translate-y-6 opacity-0"
              : "translate-y-0 opacity-100"
        }`}
      >
        {activeStory.cover_url ? (
          <div className="mb-4 overflow-hidden rounded-2xl border border-amber-100">
            <img
              src={activeStory.cover_url}
              alt=""
              className="h-48 w-full object-cover"
            />
          </div>
        ) : null}

        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600">
            <span className="rounded-full bg-slate-100 px-3 py-1 font-medium text-slate-700">
              {activeStory.genre}
            </span>
            {activeStory.is_public_domain ? (
              <span className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1 font-semibold text-amber-700">
                Public domain
              </span>
            ) : null}
            {activeStory.original_author ? (
              <span>Original: {activeStory.original_author}</span>
            ) : null}
            <span>{activeStory.reading_time} min</span>
          </div>
          <h2 className="text-2xl font-semibold text-slate-900">
            {activeStory.title}
          </h2>
          <div
            className={`reader relative whitespace-pre-wrap transition-transform duration-200 ease-out ${
              pageTransition === "next"
                ? "-translate-x-4 opacity-0"
                : pageTransition === "prev"
                  ? "translate-x-4 opacity-0"
                  : "translate-x-0 opacity-100"
            }`}
          >
            <div
              className={`page-curl ${
                pageTransition === "next"
                  ? "page-curl-next"
                  : pageTransition === "prev"
                    ? "page-curl-prev"
                    : ""
              }`}
            />
            {pages[pageIndex]}
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-500">
          <span>
            Story {activeIndex + 1} of {stories.length}
          </span>
          <span>
            Page {pageIndex + 1} of {pages.length}
          </span>
          <Link href={`/story/${activeStory.slug}`} className="font-semibold">
            Open full story
          </Link>
        </div>
      </div>
    </div>
  );
}
