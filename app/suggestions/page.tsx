"use client";

import { useEffect, useMemo, useState } from "react";
import DiscoveryListItem from "../../components/DiscoveryListItem";
import { DiscoveryItem, fetchDiscoveryItemsByStoryIds } from "../../lib/discovery-feed";
import { supabase } from "../../lib/supabase/client";

type PickRow = {
  story_id: string;
  month_label: string;
  sort_order: number;
};

export default function SuggestionsPage() {
  const [items, setItems] = useState<DiscoveryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lengthFilter, setLengthFilter] = useState("All");

  useEffect(() => {
    let isMounted = true;

    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const now = new Date();
        const rollingStart = new Date(now.getFullYear(), now.getMonth() - 2, 1);
        const nextMonthStart = new Date(now.getFullYear(), now.getMonth() + 1, 1);

        const { data: picksData, error: picksError } = await supabase
          .from("editorial_picks")
          .select("story_id, month_label, sort_order")
          .gte("month_label", rollingStart.toISOString().slice(0, 10))
          .lt("month_label", nextMonthStart.toISOString().slice(0, 10))
          .order("month_label", { ascending: false })
          .order("sort_order", { ascending: true });

        if (picksError) {
          throw new Error(picksError.message);
        }

        const picks = (picksData ?? []) as PickRow[];
        const storyIds = picks.map((row) => row.story_id);
        const discoveryItems = await fetchDiscoveryItemsByStoryIds(storyIds);
        if (!isMounted) return;
        setItems(discoveryItems);
      } catch (loadError) {
        if (!isMounted) return;
        setError(loadError instanceof Error ? loadError.message : "Unable to load suggestions.");
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    load();

    return () => {
      isMounted = false;
    };
  }, []);

  const suggestions = useMemo(() => {
    const sorted = [...items].sort((a, b) => a.reading_time - b.reading_time);
    if (lengthFilter === "All") return sorted;
    return sorted.filter((item) => item.length_class === lengthFilter);
  }, [items, lengthFilter]);

  return (
    <div className="space-y-5">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">Suggestions</h1>
        <p className="text-sm text-slate-600">
          Editorial picks from the current month plus the previous two months, sorted by length.
        </p>
      </header>

      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
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
      </section>

      {loading ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-5 text-slate-600">
          Loading suggestions...
        </div>
      ) : error ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-5 text-rose-700">
          {error}
        </div>
      ) : suggestions.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-5 text-slate-600">
          No editorial picks for this rolling window.
        </div>
      ) : (
        <div className="space-y-3">
          {suggestions.map((item) => (
            <DiscoveryListItem key={item.id} item={item} />
          ))}
        </div>
      )}
    </div>
  );
}
