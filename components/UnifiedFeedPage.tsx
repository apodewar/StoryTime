"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import StoryCard from "./StoryCard";
import { supabase } from "../lib/supabase/client";
import { fetchStoryMetrics } from "../lib/discovery-feed";
import { createUuid } from "../lib/uuid";
import { StoryRecord } from "../types/story";

type FeedMode = "following" | "feed" | "public-domain";
type FeedView = "cover" | "list";

type FeedStory = StoryRecord & {
  author_name: string;
  synopsis: string;
  likes: number;
  views: number;
};

type VisibilityRow = {
  story_id: string;
  dismissed: boolean;
  snooze_until: string | null;
};

type ShelfRow = {
  id: string;
  name: string;
};

type UnifiedFeedPageProps = {
  routeBase: "/feed" | "/personal-feed";
  title?: string;
  description?: string;
};

const getAnonSessionId = () => {
  if (typeof window === "undefined") return "";
  const key = "storytime.anonSessionId";
  const existing = window.localStorage.getItem(key);
  if (existing) return existing;
  const next = `anon_${createUuid()}`;
  window.localStorage.setItem(key, next);
  return next;
};

const firstLine = (story: StoryRecord) => {
  const preferred = story.synopsis_1?.trim();
  if (preferred) return preferred;
  const clean = story.body.replace(/\s+/g, " ").trim();
  if (!clean) return "No synopsis available.";
  const sentence = clean.match(/[^.!?]+[.!?]/)?.[0] ?? clean;
  return sentence.length > 120 ? `${sentence.slice(0, 117)}...` : sentence;
};

export default function UnifiedFeedPage({
  routeBase,
  title = "Personal Feed",
  description = "Followed creator posts, public domain reads, and tailored story picks in one place.",
}: UnifiedFeedPageProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [stories, setStories] = useState<FeedStory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actioningId, setActioningId] = useState<string | null>(null);
  const [searchInput, setSearchInput] = useState(searchParams.get("q") ?? "");
  const [shelves, setShelves] = useState<ShelfRow[]>([]);
  const [selectedShelfByStory, setSelectedShelfByStory] = useState<Record<string, string>>({});
  const [activeIndex, setActiveIndex] = useState(0);
  const [touchStart, setTouchStart] = useState<{ x: number; y: number } | null>(null);
  const [feedViewDefault, setFeedViewDefault] = useState<FeedView>("cover");

  const mode = useMemo<FeedMode>(() => {
    const raw = searchParams.get("mode");
    if (raw === "following" || raw === "public-domain" || raw === "feed") return raw;
    return "feed";
  }, [searchParams]);

  const query = useMemo(() => (searchParams.get("q") ?? "").trim(), [searchParams]);
  const genreFilter = useMemo(() => searchParams.get("genre") ?? "All", [searchParams]);
  const lengthFilter = useMemo(() => searchParams.get("length") ?? "All", [searchParams]);
  const view = useMemo<FeedView>(() => {
    const raw = searchParams.get("view");
    if (raw === "list" || raw === "cover") return raw;
    return feedViewDefault;
  }, [feedViewDefault, searchParams]);

  const lengthLabelMap: Record<FeedStory["length_class"], string> = {
    flash: "Flash",
    short: "Short",
    storytime: "Storytime",
  };
  const genres = useMemo(
    () => ["All", ...Array.from(new Set(stories.map((item) => item.genre))).sort()],
    [stories],
  );
  const filteredStories = useMemo(() => {
    return stories.filter((item) => {
      if (genreFilter !== "All" && item.genre !== genreFilter) return false;
      if (lengthFilter !== "All" && item.length_class !== lengthFilter) return false;
      return true;
    });
  }, [genreFilter, lengthFilter, stories]);

  useEffect(() => {
    setSearchInput(query);
  }, [query]);

  useEffect(() => {
    if (activeIndex > filteredStories.length - 1) {
      setActiveIndex(Math.max(filteredStories.length - 1, 0));
    }
  }, [activeIndex, filteredStories.length]);

  useEffect(() => {
    let isMounted = true;

    const loadShelves = async () => {
      const { data: authData } = await supabase.auth.getUser();
      const userId = authData.user?.id ?? null;
      if (!isMounted) return;
      if (!userId) {
        setShelves([]);
        return;
      }

      await supabase.from("shelves").upsert(
        { user_id: userId, name: "Read Later" },
        { onConflict: "user_id,name" },
      );

      const { data: settingsData } = await supabase
        .from("user_settings")
        .select("feed_view_mode")
        .eq("user_id", userId)
        .maybeSingle();
      if (!isMounted) return;
      if (settingsData?.feed_view_mode === "cover" || settingsData?.feed_view_mode === "list") {
        setFeedViewDefault(settingsData.feed_view_mode);
      }

      const { data } = await supabase
        .from("shelves")
        .select("id, name")
        .eq("user_id", userId)
        .order("created_at", { ascending: true });

      if (!isMounted) return;
      setShelves((data ?? []) as ShelfRow[]);
    };

    loadShelves();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    let isMounted = true;

    const loadStories = async () => {
      setLoading(true);
      setError(null);

      const { data: authData } = await supabase.auth.getUser();
      const userId = authData.user?.id ?? null;
      const anonSessionId = getAnonSessionId();

      let hiddenStoryIds: string[] = [];
      if (userId) {
        const { data: visibilityData } = await supabase
          .from("story_visibility")
          .select("story_id, dismissed, snooze_until")
          .eq("user_id", userId);

        const now = Date.now();
        hiddenStoryIds = ((visibilityData ?? []) as VisibilityRow[])
          .filter((row) => {
            if (row.dismissed) return true;
            if (!row.snooze_until) return false;
            const snoozeTime = new Date(row.snooze_until).getTime();
            return !Number.isNaN(snoozeTime) && snoozeTime > now;
          })
          .map((row) => row.story_id);
      } else {
        const { data: visibilityData } = await supabase
          .from("story_visibility")
          .select("story_id, dismissed, snooze_until")
          .eq("anon_session_id", anonSessionId);

        const now = Date.now();
        hiddenStoryIds = ((visibilityData ?? []) as VisibilityRow[])
          .filter((row) => {
            if (row.dismissed) return true;
            if (!row.snooze_until) return false;
            const snoozeTime = new Date(row.snooze_until).getTime();
            return !Number.isNaN(snoozeTime) && snoozeTime > now;
          })
          .map((row) => row.story_id);
      }

      let storyQuery = supabase
        .from("stories")
        .select(
          "id, title, slug, synopsis_1, body, length_class, reading_time, genre, tags, cover_url, cover_image_url, author_id, original_author, is_public_domain, published_at",
        )
        .eq("status", "published")
        .order("published_at", { ascending: false })
        .limit(20);

      if (mode === "public-domain") {
        storyQuery = storyQuery.eq("is_public_domain", true);
      }

      if (query) {
        const clean = query.replace(/[%_]/g, "");
        storyQuery = storyQuery.or(
          `title.ilike.%${clean}%,synopsis_1.ilike.%${clean}%,genre.ilike.%${clean}%`,
        );
      }

      if (hiddenStoryIds.length > 0) {
        storyQuery = storyQuery.not("id", "in", `(${hiddenStoryIds.join(",")})`);
      }

      const { data, error: storiesError } = await storyQuery;

      if (!isMounted) return;
      if (storiesError) {
        setError("Unable to load stories right now.");
        setStories([]);
        setLoading(false);
        return;
      }

      let baseStories = (data ?? []) as StoryRecord[];

      if (mode === "following") {
        if (!userId) {
          baseStories = [];
        } else {
          const { data: followsData } = await supabase
            .from("follows")
            .select("following_id")
            .eq("follower_id", userId);
          const followingIds = new Set(
            (followsData ?? [])
              .map((row) => row.following_id as string | null)
              .filter(Boolean) as string[],
          );
          baseStories = baseStories.filter(
            (story) => !!story.author_id && followingIds.has(story.author_id),
          );
        }
      }

      const authorIds = Array.from(
        new Set(baseStories.map((story) => story.author_id).filter(Boolean)),
      ) as string[];
      const storyIds = baseStories.map((story) => story.id);

      const [{ data: profilesData }, metricsByStory] = await Promise.all([
        authorIds.length > 0
          ? supabase.from("profiles").select("id, display_name").in("id", authorIds)
          : Promise.resolve({ data: [] as Array<{ id: string; display_name: string | null }> }),
        fetchStoryMetrics(storyIds),
      ]);

      const profileMap = Object.fromEntries(
        (profilesData ?? []).map((profile) => [
          profile.id,
          profile.display_name ?? "Unknown author",
        ]),
      );

      const enriched: FeedStory[] = baseStories.map((story) => ({
        ...story,
        author_name: story.is_public_domain
          ? story.original_author ?? "Unknown author"
          : story.author_id
            ? profileMap[story.author_id] ?? "Unknown author"
            : "Unknown author",
        synopsis: firstLine(story),
        likes: metricsByStory[story.id]?.likes ?? 0,
        views: metricsByStory[story.id]?.views ?? 0,
      }));

      if (!isMounted) return;
      setStories(enriched);
      setSelectedShelfByStory((prev) => {
        const next = { ...prev };
        const defaultShelfId =
          shelves.find((shelf) => shelf.name.toLowerCase() === "read later")?.id ??
          shelves[0]?.id ??
          "";
        for (const story of enriched) {
          if (!next[story.id] && defaultShelfId) {
            next[story.id] = defaultShelfId;
          }
        }
        return next;
      });
      setLoading(false);
    };

    loadStories();

    return () => {
      isMounted = false;
    };
  }, [mode, query, shelves]);

  const updateQueryParams = (next: {
    q?: string;
    mode?: FeedMode;
    view?: FeedView;
    genre?: string;
    length?: string;
  }) => {
    const params = new URLSearchParams(searchParams.toString());
    if (typeof next.q !== "undefined") {
      if (next.q.trim()) params.set("q", next.q.trim());
      else params.delete("q");
    }
    if (typeof next.mode !== "undefined") {
      params.set("mode", next.mode);
    }
    if (typeof next.view !== "undefined") {
      params.set("view", next.view);
    }
    if (typeof next.genre !== "undefined") {
      if (next.genre === "All") params.delete("genre");
      else params.set("genre", next.genre);
    }
    if (typeof next.length !== "undefined") {
      if (next.length === "All") params.delete("length");
      else params.set("length", next.length);
    }
    const finalQuery = params.toString();
    router.push(finalQuery ? `${routeBase}?${finalQuery}` : routeBase);
  };

  const persistFeedViewPreference = async (nextView: FeedView) => {
    const { data: authData } = await supabase.auth.getUser();
    const userId = authData.user?.id ?? null;
    if (!userId) return;

    await supabase.from("user_settings").upsert(
      {
        user_id: userId,
        feed_view_mode: nextView,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" },
    );
    setFeedViewDefault(nextView);
  };

  const handleSearchSubmit = (event: FormEvent) => {
    event.preventDefault();
    updateQueryParams({ q: searchInput });
  };

  const sendAction = async (action: "save" | "dismiss" | "snooze" | "open", story: FeedStory) => {
    setActioningId(story.id);
    try {
      const session = await supabase.auth.getSession();
      const token = session.data.session?.access_token ?? "";
      const headers: HeadersInit = {
        "Content-Type": "application/json",
      };
      if (token) headers.Authorization = `Bearer ${token}`;

      const payload: Record<string, unknown> = {
        action,
        storyId: story.id,
        anonSessionId: getAnonSessionId(),
      };

      if (action === "save") {
        payload.shelfName = "Read Later";
        const selectedShelf = selectedShelfByStory[story.id];
        if (selectedShelf) {
          payload.shelfId = selectedShelf;
        }
      }

      if (action === "snooze") {
        payload.snoozeUntil = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
      }

      const response = await fetch("/api/feed/actions", {
        method: "POST",
        headers,
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.error ?? "Action failed");
      }

      if (action === "dismiss" || action === "snooze") {
        setStories((prev) => prev.filter((item) => item.id !== story.id));
      }

      if (action === "open") {
        router.push(`/story/${story.slug}`);
      }
    } catch (actionError) {
      setError(
        actionError instanceof Error ? actionError.message : "Unable to complete that action.",
      );
    } finally {
      setActioningId(null);
    }
  };

  const reportStory = async (story: FeedStory) => {
    setActioningId(story.id);
    try {
      const session = await supabase.auth.getSession();
      const token = session.data.session?.access_token ?? "";
      if (!token) {
        throw new Error("Sign in to report stories.");
      }

      const response = await fetch("/api/reports", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ storyId: story.id, reason: "Feed report" }),
      });

      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.error ?? "Report failed");
      }
    } catch (actionError) {
      setError(
        actionError instanceof Error ? actionError.message : "Unable to complete that action.",
      );
    } finally {
      setActioningId(null);
    }
  };

  const applySwipeAction = async (action: "save" | "dismiss" | "snooze", story: FeedStory) => {
    await sendAction(action, story);
    if (action === "save") {
      setActiveIndex((prev) => Math.min(prev + 1, Math.max(filteredStories.length - 1, 0)));
    }
  };

  const handleCoverTouchStart = (event: React.TouchEvent<HTMLDivElement>) => {
    const touch = event.touches[0];
    if (!touch) return;
    setTouchStart({ x: touch.clientX, y: touch.clientY });
  };

  const handleCoverTouchEnd = async (event: React.TouchEvent<HTMLDivElement>, story: FeedStory) => {
    if (!touchStart) return;
    const touch = event.changedTouches[0];
    if (!touch) return;

    const deltaX = touch.clientX - touchStart.x;
    const deltaY = touch.clientY - touchStart.y;
    const absX = Math.abs(deltaX);
    const absY = Math.abs(deltaY);
    const threshold = 45;
    setTouchStart(null);

    if (absX < threshold && absY < threshold) return;

    if (absX > absY) {
      if (deltaX > 0) {
        await applySwipeAction("save", story);
      } else {
        await applySwipeAction("dismiss", story);
      }
      return;
    }

    if (deltaY < 0) {
      await applySwipeAction("snooze", story);
    }
  };

  const activeStory = filteredStories[activeIndex];

  return (
    <div className="space-y-5">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        <p className="text-sm text-slate-600">{description}</p>
      </header>

      <section className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
        <form onSubmit={handleSearchSubmit}>
          <input
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
            placeholder="Search stories..."
            className="h-9 w-full rounded-full border border-slate-200 px-3 text-sm outline-none focus:border-slate-400"
          />
        </form>
        <div className="mt-3 flex flex-wrap gap-2">
          {(["feed", "following", "public-domain"] as const).map((modeOption) => (
            <button
              key={modeOption}
              type="button"
              onClick={() => updateQueryParams({ mode: modeOption })}
              className={`rounded-full px-3 py-1 text-xs font-semibold ${
                mode === modeOption
                  ? "bg-slate-900 text-white"
                  : "border border-slate-300 text-slate-700"
              }`}
            >
              {modeOption === "feed"
                ? "All"
                : modeOption === "following"
                  ? "Following only"
                  : "Public domain only"}
            </button>
          ))}
          <button
            type="button"
            onClick={() => {
              updateQueryParams({ view: "cover" });
              persistFeedViewPreference("cover");
            }}
            className={`rounded-full px-3 py-1 text-xs font-semibold ${
              view === "cover"
                ? "bg-amber-700 text-white"
                : "border border-amber-300 text-amber-800"
            }`}
          >
            Cover Mode
          </button>
          <button
            type="button"
            onClick={() => {
              updateQueryParams({ view: "list" });
              persistFeedViewPreference("list");
            }}
            className={`rounded-full px-3 py-1 text-xs font-semibold ${
              view === "list"
                ? "bg-amber-700 text-white"
                : "border border-amber-300 text-amber-800"
            }`}
          >
            List Mode
          </button>
          <select
            value={genreFilter}
            onChange={(event) => updateQueryParams({ genre: event.target.value })}
            className="h-8 rounded-full border border-slate-300 px-3 text-xs font-semibold text-slate-700"
          >
            {genres.map((genre) => (
              <option key={genre} value={genre}>
                {genre}
              </option>
            ))}
          </select>
          <select
            value={lengthFilter}
            onChange={(event) => updateQueryParams({ length: event.target.value })}
            className="h-8 rounded-full border border-slate-300 px-3 text-xs font-semibold text-slate-700"
          >
            <option value="All">All lengths</option>
            <option value="flash">Flash</option>
            <option value="short">Short</option>
            <option value="storytime">Storytime</option>
          </select>
        </div>
      </section>

      {loading ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-5 text-slate-600">
          Loading stories...
        </div>
      ) : error ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-5 text-rose-700">
          {error}
        </div>
      ) : filteredStories.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-5 text-slate-600">
          No stories found for this filter.
        </div>
      ) : view === "cover" ? (
        <section className="space-y-3">
          {activeStory ? (
            <>
              <div
                onTouchStart={handleCoverTouchStart}
                onTouchEnd={(event) => handleCoverTouchEnd(event, activeStory)}
                className="book-surface overflow-hidden rounded-3xl"
              >
                <Link href={`/story/${activeStory.slug}`} className="block">
                  {activeStory.cover_url || activeStory.cover_image_url ? (
                    <img
                      src={activeStory.cover_url ?? activeStory.cover_image_url ?? ""}
                      alt=""
                      className="h-[62vh] w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-[62vh] items-center justify-center bg-amber-50 p-6 text-center">
                      <div>
                        <p className="text-xs uppercase tracking-widest text-amber-700">StoryTime</p>
                        <h2 className="mt-2 text-3xl font-semibold text-slate-900">
                          {activeStory.title}
                        </h2>
                      </div>
                    </div>
                  )}
                </Link>
                <div className="min-h-[16vh] space-y-2 border-t border-slate-200 p-4 text-sm">
                  <h2 className="line-clamp-1 text-lg font-semibold text-slate-900">
                    {activeStory.title}
                  </h2>
                  <p className="line-clamp-1 text-slate-600">{activeStory.synopsis}</p>
                  <div className="flex flex-wrap gap-2 text-xs text-slate-600">
                    <span>{lengthLabelMap[activeStory.length_class]}</span>
                    <span>{activeStory.reading_time} min</span>
                    <span>{activeStory.author_name}</span>
                    <span>{activeStory.genre}</span>
                    {activeStory.is_public_domain ? (
                      <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-amber-700">
                        Public domain
                      </span>
                    ) : null}
                    <span>{activeStory.views} views</span>
                    <span>{activeStory.likes} likes</span>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-5 gap-2">
                <button
                  type="button"
                  onClick={() => applySwipeAction("save", activeStory)}
                  className="rounded-lg border border-emerald-300 bg-emerald-50 px-2 py-1.5 text-xs font-semibold text-emerald-700"
                >
                  Save
                </button>
                <button
                  type="button"
                  onClick={() => applySwipeAction("dismiss", activeStory)}
                  className="rounded-lg border border-rose-300 bg-rose-50 px-2 py-1.5 text-xs font-semibold text-rose-700"
                >
                  Dismiss
                </button>
                <button
                  type="button"
                  onClick={() => applySwipeAction("snooze", activeStory)}
                  className="rounded-lg border border-amber-300 bg-amber-50 px-2 py-1.5 text-xs font-semibold text-amber-700"
                >
                  Snooze
                </button>
                <button
                  type="button"
                  onClick={() => sendAction("open", activeStory)}
                  className="rounded-lg bg-slate-900 px-2 py-1.5 text-xs font-semibold text-white"
                >
                  Open
                </button>
                <button
                  type="button"
                  onClick={() => reportStory(activeStory)}
                  className="rounded-lg border border-rose-300 bg-white px-2 py-1.5 text-xs font-semibold text-rose-700"
                >
                  Report
                </button>
              </div>
              <p className="text-xs text-slate-500">
                Story {activeIndex + 1} of {filteredStories.length}. Swipe right to save, left to dismiss, up for not today.
              </p>
            </>
          ) : null}
        </section>
      ) : (
        <section className="space-y-3">
          {filteredStories.map((story) => (
            <StoryCard
              key={story.id}
              id={story.id}
              title={story.title}
              slug={story.slug}
              length_class={story.length_class}
              reading_time={story.reading_time}
              genre={story.genre}
              tags={story.tags}
              synopsis={story.synopsis}
              cover_url={story.cover_url ?? story.cover_image_url}
              author_name={story.author_name}
              author_label={story.is_public_domain ? "Original author" : "By"}
              origin_label={story.is_public_domain ? "Public domain" : undefined}
              likes={story.likes}
              views={story.views}
              showActions
              onSave={() => sendAction("save", story)}
              onDismiss={() => sendAction("dismiss", story)}
              onSnooze={() => sendAction("snooze", story)}
              onOpen={() => sendAction("open", story)}
              onReport={() => reportStory(story)}
              shelfOptions={shelves}
              selectedShelfId={selectedShelfByStory[story.id]}
              onShelfChange={(shelfId) =>
                setSelectedShelfByStory((prev) => ({ ...prev, [story.id]: shelfId }))
              }
            />
          ))}
          {actioningId ? (
            <p className="text-xs text-slate-500">Applying action...</p>
          ) : null}
        </section>
      )}
    </div>
  );
}
