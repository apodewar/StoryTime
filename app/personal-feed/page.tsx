"use client";

import { useEffect, useMemo, useState } from "react";
import DiscoveryListItem from "../../components/DiscoveryListItem";
import { DiscoveryItem, fetchDiscoveryItems } from "../../lib/discovery-feed";

export default function PersonalFeedPage() {
  const [items, setItems] = useState<DiscoveryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  useEffect(() => {
    let isMounted = true;

    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await fetchDiscoveryItems();
        if (!isMounted) return;
        setItems(data);
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
    const sorted = [...withSignal].sort(
      (a, b) => b.likes + b.completions * 2 - (a.likes + a.completions * 2),
    );
    if (!query.trim()) return sorted;
    const q = query.toLowerCase();
    return sorted.filter(
      (item) =>
        item.title.toLowerCase().includes(q) ||
        item.author_name.toLowerCase().includes(q) ||
        item.genre.toLowerCase().includes(q),
    );
  }, [items, query]);

  return (
    <div className="space-y-5">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">Personal Feed</h1>
        <p className="text-sm text-slate-600">
          Followed creator posts, repost-style highlights, and occasional tailored story picks.
        </p>
      </header>

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
