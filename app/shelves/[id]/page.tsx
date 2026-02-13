"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { supabase } from "../../../lib/supabase/client";

type ShelfRow = {
  id: string;
  name: string;
  user_id: string;
};

type StoryRow = {
  id: string;
  slug: string;
  title: string;
  genre: string;
  reading_time: number;
  cover_url?: string | null;
};

type ShelfItemRow = {
  story_id: string;
};

export default function ShelfDetailPage() {
  const params = useParams<{ id: string }>();
  const shelfId = params?.id;
  const [userId, setUserId] = useState<string | null>(null);
  const [shelf, setShelf] = useState<ShelfRow | null>(null);
  const [stories, setStories] = useState<StoryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadShelf = async (uid: string, id: string) => {
    setLoading(true);
    setError(null);

    const { data: shelfData, error: shelfError } = await supabase
      .from("shelves")
      .select("id, name, user_id")
      .eq("id", id)
      .eq("user_id", uid)
      .maybeSingle();

    if (shelfError || !shelfData) {
      setError("Shelf not found.");
      setShelf(null);
      setStories([]);
      setLoading(false);
      return;
    }

    setShelf(shelfData as ShelfRow);

    const { data: itemData } = await supabase
      .from("shelf_items")
      .select("story_id")
      .eq("shelf_id", id);

    const storyIds = ((itemData ?? []) as ShelfItemRow[]).map((item) => item.story_id);
    if (storyIds.length === 0) {
      setStories([]);
      setLoading(false);
      return;
    }

    const { data: storiesData } = await supabase
      .from("stories")
      .select("id, slug, title, genre, reading_time, cover_url")
      .in("id", storyIds);

    setStories((storiesData ?? []) as StoryRow[]);
    setLoading(false);
  };

  useEffect(() => {
    let isMounted = true;

    const run = async () => {
      const { data } = await supabase.auth.getUser();
      const uid = data.user?.id ?? null;
      if (!isMounted) return;
      setUserId(uid);

      if (!uid || !shelfId) {
        setLoading(false);
        return;
      }

      await loadShelf(uid, shelfId);
    };

    run();

    return () => {
      isMounted = false;
    };
  }, [shelfId]);

  const removeStory = async (storyId: string) => {
    if (!shelfId || !userId) return;
    await supabase
      .from("shelf_items")
      .delete()
      .eq("shelf_id", shelfId)
      .eq("story_id", storyId);
    await loadShelf(userId, shelfId);
  };

  if (loading) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-5 text-sm text-slate-600">
        Loading shelf...
      </div>
    );
  }

  if (!userId) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-5 text-sm text-slate-600">
        Sign in to view shelf details.
      </div>
    );
  }

  if (error || !shelf) {
    return (
      <div className="rounded-2xl border border-rose-200 bg-rose-50 p-5 text-sm text-rose-700">
        {error ?? "Shelf not found."}
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <header className="space-y-1">
        <Link href="/shelves" className="text-xs font-semibold text-slate-500">
          Back to shelves
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight">{shelf.name}</h1>
        <p className="text-sm text-slate-600">{stories.length} stories</p>
      </header>

      {stories.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-5 text-sm text-slate-600">
          Shelf is empty.
        </div>
      ) : (
        <div className="space-y-3">
          {stories.map((story) => (
            <article key={story.id} className="book-surface rounded-2xl p-3">
              <div className="flex items-center justify-between gap-2">
                <Link href={`/story/${story.slug}`} className="min-w-0 no-underline hover:no-underline">
                  <p className="truncate text-sm font-semibold text-slate-900">{story.title}</p>
                  <p className="text-xs text-slate-500">
                    {story.genre} . {story.reading_time} min
                  </p>
                </Link>
                <button
                  type="button"
                  onClick={() => removeStory(story.id)}
                  className="rounded-full border border-slate-300 px-3 py-1 text-xs font-semibold text-slate-700"
                >
                  Remove
                </button>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
