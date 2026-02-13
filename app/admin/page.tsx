"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabase } from "../../lib/supabase/client";

type ReportRow = {
  id: string;
  story_id: string;
  reason: string | null;
  created_at: string;
};

type AdminStory = {
  id: string;
  title: string;
  slug: string;
  author_id: string | null;
  created_at: string;
  status: "draft" | "pending" | "published" | "hidden";
};

export default function AdminPage() {
  const [reports, setReports] = useState<ReportRow[]>([]);
  const [stories, setStories] = useState<AdminStory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = async () => {
    setLoading(true);
    setError(null);

    const [reportsResult, storiesResult] = await Promise.all([
      supabase
        .from("reports")
        .select("id, story_id, reason, created_at")
        .order("created_at", { ascending: false })
        .limit(100),
      supabase
        .from("stories")
        .select("id, title, slug, author_id, created_at, status")
        .in("status", ["pending", "published", "hidden"])
        .order("created_at", { ascending: false })
        .limit(200),
    ]);

    if (reportsResult.error || storiesResult.error) {
      setError("Unable to load admin data.");
      setReports([]);
      setStories([]);
    } else {
      setReports((reportsResult.data ?? []) as ReportRow[]);
      setStories((storiesResult.data ?? []) as AdminStory[]);
    }

    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, []);

  const storiesById = useMemo(
    () => Object.fromEntries(stories.map((story) => [story.id, story])),
    [stories],
  );

  const pendingStories = stories.filter((story) => story.status === "pending");
  const hiddenStories = stories.filter((story) => story.status === "hidden");

  const setStoryStatus = async (
    storyId: string,
    nextStatus: "hidden" | "published",
  ) => {
    await supabase.from("stories").update({ status: nextStatus }).eq("id", storyId);
    loadData();
  };

  if (loading) {
    return (
      <div className="rounded-lg border border-slate-200 bg-white p-6 text-slate-600">
        Loading admin data...
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border border-rose-200 bg-rose-50 p-6 text-rose-700">
        {error}
      </div>
    );
  }

  return (
    <div className="space-y-10">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Admin moderation</h1>
        <p className="text-slate-600">Review reports and hide/unhide stories quickly.</p>
      </div>

      <section className="space-y-4">
        <h2 className="text-lg font-semibold">Reports</h2>
        {reports.length === 0 ? (
          <div className="rounded-lg border border-slate-200 bg-white p-6 text-slate-600">
            No reports.
          </div>
        ) : (
          <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-slate-600">
                <tr>
                  <th className="px-4 py-3 font-medium">Story</th>
                  <th className="px-4 py-3 font-medium">Reason</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Reported</th>
                  <th className="px-4 py-3 font-medium">Action</th>
                </tr>
              </thead>
              <tbody>
                {reports.map((report) => {
                  const story = storiesById[report.story_id];
                  return (
                    <tr key={report.id} className="border-t border-slate-200">
                      <td className="px-4 py-3">
                        {story ? (
                          <Link href={`/story/${story.slug}`} className="text-slate-900 hover:underline">
                            {story.title}
                          </Link>
                        ) : (
                          report.story_id
                        )}
                      </td>
                      <td className="px-4 py-3 text-slate-600">{report.reason ?? "-"}</td>
                      <td className="px-4 py-3 text-slate-600">{story?.status ?? "unknown"}</td>
                      <td className="px-4 py-3 text-slate-600">
                        {new Date(report.created_at).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-3">
                        {story?.status === "hidden" ? (
                          <button
                            onClick={() => setStoryStatus(report.story_id, "published")}
                            className="rounded-lg border border-emerald-200 px-3 py-1 text-xs font-semibold text-emerald-700 hover:border-emerald-300"
                          >
                            Unhide
                          </button>
                        ) : (
                          <button
                            onClick={() => setStoryStatus(report.story_id, "hidden")}
                            className="rounded-lg border border-rose-200 px-3 py-1 text-xs font-semibold text-rose-700 hover:border-rose-300"
                          >
                            Hide
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="space-y-4">
        <h2 className="text-lg font-semibold">Hidden stories</h2>
        {hiddenStories.length === 0 ? (
          <div className="rounded-lg border border-slate-200 bg-white p-6 text-slate-600">
            No hidden stories.
          </div>
        ) : (
          <div className="space-y-2 rounded-lg border border-slate-200 bg-white p-4">
            {hiddenStories.map((story) => (
              <div key={story.id} className="flex items-center justify-between gap-4 rounded-lg border border-slate-200 p-3">
                <div>
                  <Link href={`/story/${story.slug}`} className="font-medium text-slate-900 hover:underline">
                    {story.title}
                  </Link>
                  <p className="text-xs text-slate-500">Author: {story.author_id ?? "unknown"}</p>
                </div>
                <button
                  onClick={() => setStoryStatus(story.id, "published")}
                  className="rounded-lg border border-emerald-200 px-3 py-1 text-xs font-semibold text-emerald-700 hover:border-emerald-300"
                >
                  Unhide
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="space-y-4">
        <h2 className="text-lg font-semibold">Pending approval</h2>
        {pendingStories.length === 0 ? (
          <div className="rounded-lg border border-slate-200 bg-white p-6 text-slate-600">
            No pending stories.
          </div>
        ) : (
          <div className="space-y-2 rounded-lg border border-slate-200 bg-white p-4">
            {pendingStories.map((story) => (
              <div key={story.id} className="flex items-center justify-between gap-4 rounded-lg border border-slate-200 p-3">
                <div>
                  <Link href={`/story/${story.slug}`} className="font-medium text-slate-900 hover:underline">
                    {story.title}
                  </Link>
                  <p className="text-xs text-slate-500">Submitted: {new Date(story.created_at).toLocaleDateString()}</p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setStoryStatus(story.id, "published")}
                    className="rounded-lg border border-emerald-200 px-3 py-1 text-xs font-semibold text-emerald-700 hover:border-emerald-300"
                  >
                    Approve
                  </button>
                  <button
                    onClick={() => setStoryStatus(story.id, "hidden")}
                    className="rounded-lg border border-rose-200 px-3 py-1 text-xs font-semibold text-rose-700 hover:border-rose-300"
                  >
                    Hide
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

