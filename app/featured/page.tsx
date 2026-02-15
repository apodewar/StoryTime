"use client";

import { FormEvent, useEffect, useState } from "react";
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

type CompetitionCategory = "under-5" | "under-10" | "under-30";

type SubmissionFormState = {
  storyTitle: string;
  submitterName: string;
  submitterEmail: string;
  file: File | null;
  submitting: boolean;
  success: string | null;
  error: string | null;
};

const COMPETITION_DEADLINE_ISO = "2026-09-01T23:59:59Z";

const CATEGORY_CARDS: Array<{
  category: CompetitionCategory;
  title: string;
  readingTarget: string;
  wordEstimate: string;
}> = [
  {
    category: "under-5",
    title: "Short Sprint",
    readingTarget: "Stories under 5 minutes",
    wordEstimate: "Estimated max: ~1,000 words",
  },
  {
    category: "under-10",
    title: "Reader Favorite",
    readingTarget: "Stories under 10 minutes",
    wordEstimate: "Estimated max: ~2,000 words",
  },
  {
    category: "under-30",
    title: "StoryTime Showcase",
    readingTarget: "Stories 30 minutes or under",
    wordEstimate: "Estimated max: ~6,000 words",
  },
];

const emptyForm = (): SubmissionFormState => ({
  storyTitle: "",
  submitterName: "",
  submitterEmail: "",
  file: null,
  submitting: false,
  success: null,
  error: null,
});

const initialForms = (): Record<CompetitionCategory, SubmissionFormState> => ({
  "under-5": emptyForm(),
  "under-10": emptyForm(),
  "under-30": emptyForm(),
});

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
  const [forms, setForms] = useState<Record<CompetitionCategory, SubmissionFormState>>(
    initialForms(),
  );

  const deadline = new Date(COMPETITION_DEADLINE_ISO);
  const isCompetitionOpen = Date.now() <= deadline.getTime();

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
          const startsOk = startsAt === null || (!Number.isNaN(startsAt) && startsAt <= now);
          const endsOk = endsAt === null || (!Number.isNaN(endsAt) && endsAt >= now);
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

  const updateForm = (
    category: CompetitionCategory,
    patch: Partial<SubmissionFormState>,
  ) => {
    setForms((prev) => ({
      ...prev,
      [category]: {
        ...prev[category],
        ...patch,
      },
    }));
  };

  const handleSubmit = async (event: FormEvent, category: CompetitionCategory) => {
    event.preventDefault();

    const form = forms[category];
    if (!form.storyTitle.trim() || !form.submitterEmail.trim() || !form.file) {
      updateForm(category, {
        error: "Story title, submitter email, and PDF are required.",
        success: null,
      });
      return;
    }

    updateForm(category, { submitting: true, error: null, success: null });

    try {
      const payload = new FormData();
      payload.append("category", category);
      payload.append("storyTitle", form.storyTitle.trim());
      payload.append("submitterName", form.submitterName.trim());
      payload.append("submitterEmail", form.submitterEmail.trim());
      payload.append("file", form.file);

      const response = await fetch("/api/competition/submit", {
        method: "POST",
        body: payload,
      });

      const body = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(body?.error ?? "Unable to submit right now.");
      }

      updateForm(category, {
        submitting: false,
        success: "Submission sent successfully.",
        error: null,
        storyTitle: "",
        submitterName: "",
        submitterEmail: "",
        file: null,
      });
    } catch (submitError) {
      updateForm(category, {
        submitting: false,
        success: null,
        error:
          submitError instanceof Error
            ? submitError.message
            : "Unable to submit right now.",
      });
    }
  };

  return (
    <div className="space-y-5">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">Featured</h1>
        <p className="text-sm text-slate-600">
          Editorial and competition highlights curated from `featured_items` rows.
        </p>
      </header>

      <section className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-amber-900">
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide">
            StoryTime Launch Competition {isCompetitionOpen ? "Open" : "Closed"}
          </p>
          <h2 className="text-lg font-semibold">Competition Categories</h2>
          <p className="text-sm">
            Deadline:{" "}
            {deadline.toLocaleDateString(undefined, {
              month: "long",
              day: "numeric",
              year: "numeric",
            })}
            .
          </p>
          <p className="text-sm">
            Winners receive a reward, a personalized piece of art, and placement on
            the StoryTime Featured Page.
          </p>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        {CATEGORY_CARDS.map((card) => {
          const form = forms[card.category];
          return (
            <article
              key={card.category}
              className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
            >
              <div className="space-y-1">
                <h3 className="text-base font-semibold text-slate-900">{card.title}</h3>
                <p className="text-sm text-slate-600">{card.readingTarget}</p>
                <p className="text-xs text-slate-500">{card.wordEstimate}</p>
              </div>

              <form
                onSubmit={(event) => handleSubmit(event, card.category)}
                className="mt-3 space-y-2"
              >
                <input
                  value={form.storyTitle}
                  onChange={(event) =>
                    updateForm(card.category, { storyTitle: event.target.value })
                  }
                  placeholder="Story title"
                  className="h-9 w-full rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-slate-400"
                  disabled={!isCompetitionOpen || form.submitting}
                  required
                />
                <input
                  value={form.submitterName}
                  onChange={(event) =>
                    updateForm(card.category, { submitterName: event.target.value })
                  }
                  placeholder="Your name (optional)"
                  className="h-9 w-full rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-slate-400"
                  disabled={!isCompetitionOpen || form.submitting}
                />
                <input
                  type="email"
                  value={form.submitterEmail}
                  onChange={(event) =>
                    updateForm(card.category, { submitterEmail: event.target.value })
                  }
                  placeholder="Your email"
                  className="h-9 w-full rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-slate-400"
                  disabled={!isCompetitionOpen || form.submitting}
                  required
                />
                <input
                  type="file"
                  accept="application/pdf,.pdf"
                  onChange={(event) =>
                    updateForm(card.category, {
                      file: event.target.files?.[0] ?? null,
                    })
                  }
                  className="block w-full rounded-lg border border-slate-200 px-2 py-2 text-xs text-slate-600"
                  disabled={!isCompetitionOpen || form.submitting}
                  required
                />
                <button
                  type="submit"
                  className="w-full rounded-lg bg-slate-900 px-3 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
                  disabled={!isCompetitionOpen || form.submitting}
                >
                  {form.submitting ? "Submitting..." : "Submit Story PDF"}
                </button>
              </form>

              {form.error ? (
                <p className="mt-2 text-xs text-rose-700">{form.error}</p>
              ) : null}
              {form.success ? (
                <p className="mt-2 text-xs text-emerald-700">{form.success}</p>
              ) : null}
              {!isCompetitionOpen ? (
                <p className="mt-2 text-xs text-slate-500">
                  Competition submissions are closed.
                </p>
              ) : null}
            </article>
          );
        })}
      </section>

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
