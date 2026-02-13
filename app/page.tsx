import { createServerSupabaseClient } from "../lib/supabase/server";

export default async function HomePage() {
  let publishedStoryCount: number | null = null;

  try {
    const supabase = createServerSupabaseClient();
    const { count } = await supabase
      .from("stories")
      .select("id", { count: "exact", head: true })
      .eq("status", "published");
    publishedStoryCount = count ?? null;
  } catch {
    publishedStoryCount = null;
  }

  return (
    <div className="space-y-8">
      <section className="space-y-3">
        <h1 className="text-3xl font-semibold tracking-tight">
          Short fiction you can finish
        </h1>
        <p className="text-slate-600">
          Browse StoryTime by tab: Personal Feed, Algo, Suggestions, Hot, Featured, Authors, Shelves, and more.
        </p>
        <p className="text-sm text-slate-500">
          {publishedStoryCount === null
            ? "Connect Supabase to display live totals."
            : `${publishedStoryCount} published stories available.`}
        </p>
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        <a
          href="/feed"
          className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
        >
          <h2 className="text-lg font-semibold">Feed</h2>
          <p className="text-sm text-slate-600">
            Card/list discovery with search, filters, and swipe actions.
          </p>
        </a>
        <a
          href="/personal-feed"
          className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
        >
          <h2 className="text-lg font-semibold">Personal Feed</h2>
          <p className="text-sm text-slate-600">
            Follow stream, repost-style discovery, and tailored story picks.
          </p>
        </a>
        <a
          href="/algo"
          className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
        >
          <h2 className="text-lg font-semibold">Storytime Algo</h2>
          <p className="text-sm text-slate-600">
            Completion-driven ranking tuned to genres and lengths you prefer.
          </p>
        </a>
        <a
          href="/hot"
          className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
        >
          <h2 className="text-lg font-semibold">Hot</h2>
          <p className="text-sm text-slate-600">
            Top 10 stories by month/year, length, and genre.
          </p>
        </a>
        <a
          href="/featured"
          className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
        >
          <h2 className="text-lg font-semibold">Featured</h2>
          <p className="text-sm text-slate-600">
            Editorial picks, competitions, and campaigns.
          </p>
        </a>
        <a
          href="/suggestions"
          className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
        >
          <h2 className="text-lg font-semibold">Suggestions</h2>
          <p className="text-sm text-slate-600">
            Monthly refreshed stories from the last three months.
          </p>
        </a>
        <a
          href="/authors"
          className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
        >
          <h2 className="text-lg font-semibold">Authors</h2>
          <p className="text-sm text-slate-600">
            Author rankings by timeframe and genre.
          </p>
        </a>
        <a
          href="/shelves"
          className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
        >
          <h2 className="text-lg font-semibold">Shelves</h2>
          <p className="text-sm text-slate-600">
            Organize saved stories into playlist-style bookshelves.
          </p>
        </a>
        <a
          href="/write"
          className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
        >
          <h2 className="text-lg font-semibold">Write</h2>
          <p className="text-sm text-slate-600">
            Draft a story and share it with readers.
          </p>
        </a>
      </section>
    </div>
  );
}
