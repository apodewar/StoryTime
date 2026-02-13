"use client";

import { useEffect, useMemo, useState } from "react";
import DiscoveryListItem from "../../components/DiscoveryListItem";
import { DiscoveryItem, fetchDiscoveryItems } from "../../lib/discovery-feed";

export default function AlgoPage() {
  const [items, setItems] = useState<DiscoveryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [genreFilter, setGenreFilter] = useState("All");
  const [lengthFilter, setLengthFilter] = useState("All");

  useEffect(() => {
    let isMounted = true;

    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const rankedData = await fetchDiscoveryItems({ mode: "algo", sinceDays: 180 });
        if (!isMounted) return;
        setItems(rankedData);
      } catch (loadError) {
        if (!isMounted) return;
        setError(loadError instanceof Error ? loadError.message : "Unable to load algorithm feed.");
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    load();

    return () => {
      isMounted = false;
    };
  }, []);

  const genres = useMemo(
    () => ["All", ...Array.from(new Set(items.map((item) => item.genre))).sort()],
    [items],
  );

  const ranked = useMemo(() => {
    const filtered = items.filter((item) => {
      if (genreFilter !== "All" && item.genre !== genreFilter) return false;
      if (lengthFilter !== "All" && item.length_class !== lengthFilter) return false;
      return true;
    });
    return [...filtered].sort((a, b) => b.score - a.score);
  }, [genreFilter, items, lengthFilter]);

  return (
    <div className="space-y-5">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">Storytime Algo</h1>
        <p className="text-sm text-slate-600">
          Completion-first ranking tailored by preferred genres and lengths, while still promoting new uploads.
        </p>
      </header>

      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap gap-2">
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
          <select
            value={lengthFilter}
            onChange={(event) => setLengthFilter(event.target.value)}
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
          Loading algorithm feed...
        </div>
      ) : error ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-5 text-rose-700">
          {error}
        </div>
      ) : ranked.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-5 text-slate-600">
          No stories match this filter yet.
        </div>
      ) : (
        <div className="space-y-3">
          {ranked.map((item) => (
            <DiscoveryListItem key={item.id} item={item} />
          ))}
        </div>
      )}
    </div>
  );
}
