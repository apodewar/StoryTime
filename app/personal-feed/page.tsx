"use client";

import { useEffect, useMemo, useState } from "react";
import DiscoveryListItem from "../../components/DiscoveryListItem";
import { supabase } from "../../lib/supabase/client";
import { DiscoveryItem, fetchDiscoveryItems } from "../../lib/discovery-feed";

type FeedFilter = "all" | "following" | "public-domain";

type FollowRow = {
  following_id: string;
};

export default function PersonalFeedPage() {
  const [items, setItems] = useState<DiscoveryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<FeedFilter>("all");
  const [userId, setUserId] = useState<string | null>(null);
  const [followingIds, setFollowingIds] = useState<string[]>([]);

  useEffect(() => {
    let isMounted = true;

    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const [{ data: authData }, data] = await Promise.all([
          supabase.auth.getUser(),
          fetchDiscoveryItems(),
        ]);
        if (!isMounted) return;
        setItems(data);

        const sessionUserId = authData?.user?.id ?? null;
        setUserId(sessionUserId);

        if (!sessionUserId) {
          setFollowingIds([]);
          return;
        }

        const { data: followData } = await supabase
          .from("follows")
          .select("following_id")
          .eq("follower_id", sessionUserId);
        if (!isMounted) return;
        const ids = ((followData ?? []) as FollowRow[]).map((row) => row.following_id);
        setFollowingIds(ids);
      } catch (loadError) {
        if (!isMounted) return;
        setError(loadError instanceof Error ? loadError.message : "Unable to load feed.");
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    load();

    return () => {
      isMounted = false;
    };
  }, []);

  const filtered = useMemo(() => {
    const withSignal = items.filter((item) => item.likes > 0 || item.completions > 0);
    const byFeedMode = withSignal.filter((item) => {
      if (filter === "public-domain") return item.is_public_domain === true;
      if (filter === "following") {
        return !!item.author_id && followingIds.includes(item.author_id);
      }
      return true;
    });
    const sorted = [...byFeedMode].sort((a, b) => b.likes + b.completions * 2 - (a.likes + a.completions * 2));
    if (!query.trim()) return sorted;
    const q = query.toLowerCase();
    return sorted.filter(
      (item) =>
        item.title.toLowerCase().includes(q) ||
        item.author_name.toLowerCase().includes(q) ||
        item.genre.toLowerCase().includes(q),
    );
  }, [filter, followingIds, items, query]);

  return (
    <div className="space-y-5">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">Personal Feed</h1>
        <p className="text-sm text-slate-600">
          Followed creator posts, public domain reads, and tailored story picks in one place.
        </p>
      </header>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setFilter("all")}
          className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
            filter === "all"
              ? "bg-slate-900 text-white"
              : "border border-slate-300 text-slate-700 hover:border-slate-400"
          }`}
        >
          All
        </button>
        <button
          type="button"
          onClick={() => setFilter("following")}
          className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
            filter === "following"
              ? "bg-slate-900 text-white"
              : "border border-slate-300 text-slate-700 hover:border-slate-400"
          }`}
        >
          Following only
        </button>
        <button
          type="button"
          onClick={() => setFilter("public-domain")}
          className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
            filter === "public-domain"
              ? "bg-slate-900 text-white"
              : "border border-slate-300 text-slate-700 hover:border-slate-400"
          }`}
        >
          Public domain only
        </button>
      </div>

      {filter === "following" && !userId ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          Sign in to use Following only.
        </div>
      ) : null}

      <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search your personal feed..."
          className="h-9 w-full rounded-full border border-slate-200 px-3 text-sm outline-none focus:border-slate-400"
        />
      </div>

      {loading ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-5 text-slate-600">
          Loading personal feed...
        </div>
      ) : error ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-5 text-rose-700">
          {error}
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-5 text-slate-600">
          No stories yet. Follow more authors or engage with stories to personalize this tab.
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((item) => (
            <DiscoveryListItem key={item.id} item={item} />
          ))}
        </div>
      )}
    </div>
  );
}
