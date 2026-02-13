"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabase/client";

type StoryRow = {
  id: string;
  title: string;
  slug: string;
  genre: string;
  published_at: string | null;
  author_id: string | null;
};

type ProfileRow = {
  id: string;
  username: string | null;
  display_name: string | null;
};

type StoryEventRow = {
  story_id: string;
  created_at: string;
  event_type: string;
};

type AuthorRow = {
  id: string;
  username: string | null;
  name: string;
  storiesInWindow: number;
  viewers: number;
  latestStory?: { title: string; slug: string; published_at: string | null } | null;
};

type WindowMode = "month" | "year";

const inDays = (isoDate: string | null | undefined, days: number) => {
  if (!isoDate) return false;
  const value = new Date(isoDate).getTime();
  if (Number.isNaN(value)) return false;
  return value >= Date.now() - days * 24 * 60 * 60 * 1000;
};

export default function AuthorsPage() {
  const [stories, setStories] = useState<StoryRow[]>([]);
  const [profilesById, setProfilesById] = useState<Record<string, ProfileRow>>({});
  const [eventsByStory, setEventsByStory] = useState<Record<string, StoryEventRow[]>>({});
  const [windowMode, setWindowMode] = useState<WindowMode>("month");
  const [genreFilter, setGenreFilter] = useState("All");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    const load = async () => {
      setLoading(true);
      setError(null);

      const { data: storyData, error: storyError } = await supabase
        .from("stories")
        .select("id, title, slug, genre, published_at, author_id")
        .eq("status", "published")
        .not("author_id", "is", null)
        .order("published_at", { ascending: false })
        .limit(500);

      if (!isMounted) return;

      if (storyError) {
        setError("Unable to load author rankings right now.");
        setLoading(false);
        return;
      }

      const loadedStories = (storyData ?? []) as StoryRow[];
      setStories(loadedStories);

      const authorIds = Array.from(
        new Set(loadedStories.map((story) => story.author_id).filter(Boolean)),
      ) as string[];
      const storyIds = loadedStories.map((story) => story.id);

      const [profilesResult, eventsResult] = await Promise.all([
        authorIds.length > 0
          ? supabase.from("profiles").select("id, username, display_name").in("id", authorIds)
          : Promise.resolve({ data: [] as ProfileRow[] }),
        storyIds.length > 0
          ? supabase
              .from("story_events")
              .select("story_id, created_at, event_type")
              .in("story_id", storyIds)
              .in("event_type", ["open", "impression"])
              .gte("created_at", new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString())
          : Promise.resolve({ data: [] as StoryEventRow[] }),
      ]);

      if (!isMounted) return;

      const profileMap = Object.fromEntries(
        ((profilesResult.data ?? []) as ProfileRow[]).map((profile) => [profile.id, profile]),
      );
      setProfilesById(profileMap);

      const groupedEvents = ((eventsResult.data ?? []) as StoryEventRow[]).reduce(
        (acc, event) => {
          acc[event.story_id] = [...(acc[event.story_id] ?? []), event];
          return acc;
        },
        {} as Record<string, StoryEventRow[]>,
      );
      setEventsByStory(groupedEvents);
      setLoading(false);
    };

    load();

    return () => {
      isMounted = false;
    };
  }, []);

  const genres = useMemo(
    () => ["All", ...Array.from(new Set(stories.map((story) => story.genre))).sort()],
    [stories],
  );

  const rankedAuthors = useMemo(() => {
    const days = windowMode === "month" ? 30 : 365;
    const filteredStories = stories.filter((story) => {
      if (genreFilter !== "All" && story.genre !== genreFilter) return false;
      return true;
    });

    const grouped = filteredStories.reduce((acc, story) => {
      if (!story.author_id) return acc;
      const key = story.author_id;
      const viewers = (eventsByStory[story.id] ?? []).filter((event) =>
        inDays(event.created_at, days),
      ).length;
      const activeStory = inDays(story.published_at, days) ? 1 : 0;

      if (!acc[key]) {
        const profile = profilesById[key];
        acc[key] = {
          id: key,
          username: profile?.username ?? null,
          name: profile?.display_name ?? "Unknown author",
          storiesInWindow: activeStory,
          viewers,
          latestStory: {
            title: story.title,
            slug: story.slug,
            published_at: story.published_at,
          },
        };
      } else {
        acc[key].storiesInWindow += activeStory;
        acc[key].viewers += viewers;
      }

      return acc;
    }, {} as Record<string, AuthorRow>);

    return Object.values(grouped)
      .sort((a, b) => b.viewers - a.viewers || b.storiesInWindow - a.storiesInWindow)
      .slice(0, 50);
  }, [eventsByStory, genreFilter, profilesById, stories, windowMode]);

  const newReleases = useMemo(() => {
    const filtered = stories.filter((story) => {
      if (!inDays(story.published_at, 14)) return false;
      if (genreFilter !== "All" && story.genre !== genreFilter) return false;
      return true;
    });
    return filtered.slice(0, 12);
  }, [genreFilter, stories]);

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Authors</h1>
        <p className="text-sm text-slate-600">
          Ranked by viewer events in monthly/yearly windows, with genre filters and new releases.
        </p>
      </header>

      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setWindowMode("month")}
            className={`rounded-full px-3 py-1 text-xs font-semibold ${
              windowMode === "month"
                ? "bg-slate-900 text-white"
                : "border border-slate-300 text-slate-700"
            }`}
          >
            Monthly
          </button>
          <button
            type="button"
            onClick={() => setWindowMode("year")}
            className={`rounded-full px-3 py-1 text-xs font-semibold ${
              windowMode === "year"
                ? "bg-slate-900 text-white"
                : "border border-slate-300 text-slate-700"
            }`}
          >
            Yearly
          </button>
          <select
            value={genreFilter}
            onChange={(event) => setGenreFilter(event.target.value)}
            className="h-8 rounded-full border border-slate-300 px-3 text-xs font-semibold text-slate-700"
          >
            {genres.map((genre) => (
              <option key={genre} value={genre}>
                {genre}
              </option>
            ))}
          </select>
        </div>
      </section>

      {loading ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-5 text-slate-600">
          Loading authors...
        </div>
      ) : error ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-5 text-rose-700">
          {error}
        </div>
      ) : (
        <>
          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-slate-900">Leaderboard</h2>
            {rankedAuthors.length === 0 ? (
              <div className="rounded-2xl border border-slate-200 bg-white p-5 text-slate-600">
                No author data for this filter yet.
              </div>
            ) : (
              rankedAuthors.map((row, index) => (
                <article
                  key={row.id}
                  className="book-surface flex items-center justify-between gap-3 rounded-2xl p-4"
                >
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-slate-500">#{index + 1}</p>
                    <Link
                      href={`/profile/${row.username ?? row.id}`}
                      className="no-underline hover:no-underline"
                    >
                      <h3 className="truncate text-lg font-semibold text-slate-900">
                        {row.name}
                      </h3>
                    </Link>
                    <p className="text-xs text-slate-600">
                      {row.viewers} viewers . {row.storiesInWindow} stories in window
                    </p>
                    {row.latestStory ? (
                      <Link
                        href={`/story/${row.latestStory.slug}`}
                        className="text-xs font-semibold text-amber-700"
                      >
                        Latest: {row.latestStory.title}
                      </Link>
                    ) : null}
                  </div>
                  <div className="rounded-full bg-slate-900 px-3 py-1 text-xs font-semibold text-white">
                    {row.viewers}
                  </div>
                </article>
              ))
            )}
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-slate-900">New Releases</h2>
            {newReleases.length === 0 ? (
              <div className="rounded-2xl border border-slate-200 bg-white p-5 text-slate-600">
                No new releases in the last 14 days.
              </div>
            ) : (
              <div className="space-y-2">
                {newReleases.map((story) => {
                  const profile = story.author_id ? profilesById[story.author_id] : null;
                  return (
                    <article
                      key={story.id}
                      className="rounded-xl border border-slate-200 bg-white p-3"
                    >
                      <Link href={`/story/${story.slug}`} className="font-semibold text-slate-900">
                        {story.title}
                      </Link>
                      <p className="text-xs text-slate-600">
                        {story.genre} . by {profile?.display_name ?? "Unknown author"}
                        {profile ? (
                          <>
                            {" "}
                            (
                            <Link
                              href={`/profile/${profile.username ?? profile.id}`}
                              className="font-semibold"
                            >
                              @{profile.username ?? profile.id}
                            </Link>
                            )
                          </>
                        ) : null}
                      </p>
                    </article>
                  );
                })}
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}
