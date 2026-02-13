"use client";

import { useEffect, useMemo, useState } from "react";
import DiscoveryListItem from "../../components/DiscoveryListItem";
import { DiscoveryItem, fetchDiscoveryItems } from "../../lib/discovery-feed";

type WindowMode = "month" | "year";

const MIN_SAMPLE_SIZE = 5;

const computeHotScore = (item: DiscoveryItem) =>
  item.completions * 2 + item.like_ratio * 20 + item.likes - item.dislikes * 0.5;

export default function HotPage() {
  const [items, setItems] = useState<DiscoveryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [windowMode, setWindowMode] = useState<WindowMode>("month");
  const [genreFilter, setGenreFilter] = useState("All");
  const [lengthFilter, setLengthFilter] = useState("All");

  useEffect(() => {
    let isMounted = true;

    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const sinceDays = windowMode === "month" ? 30 : 365;
        const data = await fetchDiscoveryItems({
          mode: "newest",
          limit: 320,
          sinceDays,
        });
        if (!isMounted) return;
        setItems(data);
      } catch (loadError) {
        if (!isMounted) return;
        setError(loadError instanceof Error ? loadError.message : "Unable to load hot stories.");
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    load();

    return () => {
      isMounted = false;
    };
  }, [windowMode]);

  const genres = useMemo(
    () => ["All", ...Array.from(new Set(items.map((item) => item.genre))).sort()],
    [items],
  );

  const hot = useMemo(() => {
    const filtered = items.filter((item) => {
      if (genreFilter !== "All" && item.genre !== genreFilter) return false;
      if (lengthFilter !== "All" && item.length_class !== lengthFilter) return false;
      if (item.views < MIN_SAMPLE_SIZE) return false;
      return true;
    });

    return [...filtered]
      .sort((a, b) => {
        const scoreDiff = computeHotScore(b) - computeHotScore(a);
        if (scoreDiff !== 0) return scoreDiff;
        return new Date(b.published_at ?? 0).getTime() - new Date(a.published_at ?? 0).getTime();
      })
      .slice(0, 10);
  }, [genreFilter, items, lengthFilter]);

  return (
    <div className="space-y-5">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">Hot</h1>
        <p className="text-sm text-slate-600">
          Top 10 stories by length and genre. Score uses finishes, like/dislike ratio, and a minimum sample of {MIN_SAMPLE_SIZE} opens.
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
          Loading hot stories...
        </div>
      ) : error ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-5 text-rose-700">
          {error}
        </div>
      ) : hot.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-5 text-slate-600">
          No stories match this ranking filter.
        </div>
      ) : (
        <div className="space-y-3">
          {hot.map((item) => (
            <DiscoveryListItem key={item.id} item={item} />
          ))}
        </div>
      )}
    </div>
  );
}
