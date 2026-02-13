"use client";

import { useEffect, useState } from "react";
import DiscoveryListItem from "../../components/DiscoveryListItem";
import { DiscoveryItem, fetchDiscoveryItemsByStoryIds } from "../../lib/discovery-feed";
import { supabase } from "../../lib/supabase/client";

type FeaturedRow = {
  story_id: string;
  sort_order: number;
  title_override: string | null;
  subtitle: string | null;
  starts_at: string | null;
  ends_at: string | null;
};

export default function FeaturedPage() {
  const [items, setItems] = useState<
    Array<{
      item: DiscoveryItem;
      titleOverride: string | null;
      subtitle: string | null;
    }>
  >([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const { data: featuredRows, error: featuredError } = await supabase
          .from("featured_items")
          .select("story_id, sort_order, title_override, subtitle, starts_at, ends_at")
          .eq("is_active", true)
          .order("sort_order", { ascending: true })
          .order("created_at", { ascending: false });

        if (featuredError) {
          throw new Error(featuredError.message);
        }

        const now = Date.now();
        const rows = ((featuredRows ?? []) as FeaturedRow[]).filter((row) => {
          const startsAt = row.starts_at ? new Date(row.starts_at).getTime() : null;
          const endsAt = row.ends_at ? new Date(row.ends_at).getTime() : null;
          const startsOk = startsAt === null || !Number.isNaN(startsAt) && startsAt <= now;
          const endsOk = endsAt === null || !Number.isNaN(endsAt) && endsAt >= now;
          return startsOk && endsOk;
        });
        const storyIds = rows.map((row) => row.story_id);
        const discoveryItems = await fetchDiscoveryItemsByStoryIds(storyIds);
        const rowByStoryId = Object.fromEntries(rows.map((row) => [row.story_id, row]));

        if (!isMounted) return;
        setItems(
          discoveryItems.map((item) => ({
            item,
            titleOverride: rowByStoryId[item.id]?.title_override ?? null,
            subtitle: rowByStoryId[item.id]?.subtitle ?? null,
          })),
        );
      } catch (loadError) {
        if (!isMounted) return;
        setError(loadError instanceof Error ? loadError.message : "Unable to load featured stories.");
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    load();

    return () => {
      isMounted = false;
    };
  }, []);

  return (
    <div className="space-y-5">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">Featured</h1>
        <p className="text-sm text-slate-600">
          Editorial and competition highlights curated from `featured_items` rows.
        </p>
      </header>

      {loading ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-5 text-slate-600">
          Loading featured stories...
        </div>
      ) : error ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-5 text-rose-700">
          {error}
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-5 text-slate-600">
          No featured stories available yet.
        </div>
      ) : (
        <div className="space-y-3">
          {items.map(({ item, titleOverride, subtitle }) => (
            <div key={item.id} className="space-y-2">
              {titleOverride || subtitle ? (
                <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                  {titleOverride ? <p className="font-semibold">{titleOverride}</p> : null}
                  {subtitle ? <p>{subtitle}</p> : null}
                </div>
              ) : null}
              <DiscoveryListItem item={item} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
