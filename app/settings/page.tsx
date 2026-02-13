"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase/client";

type FeedViewMode = "cover" | "list";
type ReaderMode = "scroll" | "page";

export default function SettingsPage() {
  const [feedViewMode, setFeedViewMode] = useState<FeedViewMode>("cover");
  const [readerMode, setReaderMode] = useState<ReaderMode>("scroll");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    const load = async () => {
      setLoading(true);
      const { data: authData } = await supabase.auth.getUser();
      const userId = authData.user?.id ?? null;

      if (!userId) {
        if (!isMounted) return;
        setMessage("Sign in to save settings.");
        setLoading(false);
        return;
      }

      const { data } = await supabase
        .from("user_settings")
        .select("feed_view_mode, reader_mode")
        .eq("user_id", userId)
        .maybeSingle();

      if (!isMounted) return;

      if (data?.feed_view_mode === "list" || data?.feed_view_mode === "cover") {
        setFeedViewMode(data.feed_view_mode);
      }
      if (data?.reader_mode === "page" || data?.reader_mode === "scroll") {
        setReaderMode(data.reader_mode);
      }

      setLoading(false);
    };

    load();

    return () => {
      isMounted = false;
    };
  }, []);

  const persist = async (nextFeed: FeedViewMode, nextReader: ReaderMode) => {
    setSaving(true);
    setMessage(null);

    const { data: authData } = await supabase.auth.getUser();
    const userId = authData.user?.id ?? null;

    if (!userId) {
      setSaving(false);
      setMessage("Sign in to save settings.");
      return;
    }

    const { error } = await supabase.from("user_settings").upsert(
      {
        user_id: userId,
        feed_view_mode: nextFeed,
        reader_mode: nextReader,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" },
    );

    if (error) {
      setMessage("Unable to save settings right now.");
    } else {
      setMessage("Settings saved.");
    }

    setSaving(false);
  };

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="text-sm text-slate-600">Choose your default feed and reader experience.</p>
      </header>

      {loading ? (
        <div className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-600">Loading settings...</div>
      ) : (
        <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="space-y-2">
            <label htmlFor="feed-mode" className="text-sm font-semibold text-slate-800">
              Feed default mode
            </label>
            <select
              id="feed-mode"
              value={feedViewMode}
              onChange={(event) => {
                const next = event.target.value as FeedViewMode;
                setFeedViewMode(next);
                persist(next, readerMode);
              }}
              className="h-10 w-full rounded-lg border border-slate-300 px-3 text-sm"
              disabled={saving}
            >
              <option value="cover">Swipe Mode (Cover)</option>
              <option value="list">List Mode</option>
            </select>
          </div>

          <div className="space-y-2">
            <label htmlFor="reader-mode" className="text-sm font-semibold text-slate-800">
              Reader default mode
            </label>
            <select
              id="reader-mode"
              value={readerMode}
              onChange={(event) => {
                const next = event.target.value as ReaderMode;
                setReaderMode(next);
                persist(feedViewMode, next);
              }}
              className="h-10 w-full rounded-lg border border-slate-300 px-3 text-sm"
              disabled={saving}
            >
              <option value="scroll">Scroll</option>
              <option value="page">Page-turn</option>
            </select>
          </div>

          {message ? <p className="text-xs text-slate-600">{message}</p> : null}
        </section>
      )}
    </div>
  );
}

