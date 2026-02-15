"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { supabase } from "../../lib/supabase/client";

type ShelfRow = {
  id: string;
  name: string;
  created_at: string;
};

type ShelfStoryPreview = {
  title: string;
  slug: string;
};

const ensureDefaultShelf = async (userId: string) => {
  await supabase.from("shelves").upsert(
    {
      user_id: userId,
      name: "Read Later",
    },
    { onConflict: "user_id,name" },
  );
};

export default function ShelvesPage() {
  const [userId, setUserId] = useState<string | null>(null);
  const [shelves, setShelves] = useState<ShelfRow[]>([]);
  const [countsByShelf, setCountsByShelf] = useState<Record<string, number>>({});
  const [previewByShelf, setPreviewByShelf] = useState<
    Record<string, ShelfStoryPreview[]>
  >({});
  const [newShelf, setNewShelf] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadShelves = async (uid: string) => {
    setLoading(true);
    setError(null);

    await ensureDefaultShelf(uid);

    const { data: shelvesData, error: shelvesError } = await supabase
      .from("shelves")
      .select("id, name, created_at")
      .eq("user_id", uid)
      .order("created_at", { ascending: true });

    if (shelvesError) {
      setError("Unable to load shelves right now.");
      setShelves([]);
      setLoading(false);
      return;
    }

    const loadedShelves = (shelvesData ?? []) as ShelfRow[];
    setShelves(loadedShelves);

    if (loadedShelves.length === 0) {
      setCountsByShelf({});
      setPreviewByShelf({});
      setLoading(false);
      return;
    }

    const shelfIds = loadedShelves.map((shelf) => shelf.id);
    const { data: countData } = await supabase
      .from("shelf_items")
      .select("shelf_id, story_id")
      .in("shelf_id", shelfIds);

    const counts = ((countData ?? []) as Array<{ shelf_id: string; story_id: string }>).reduce(
      (acc, row) => {
        acc[row.shelf_id] = (acc[row.shelf_id] ?? 0) + 1;
        return acc;
      },
      {} as Record<string, number>,
    );

    const previews = ((countData ?? []) as Array<{ shelf_id: string; story_id: string }>)
      .reduce(
        (acc, row) => {
          if (!acc[row.shelf_id]) acc[row.shelf_id] = [];
          acc[row.shelf_id].push(row.story_id);
          return acc;
        },
        {} as Record<string, string[]>,
      );

    const uniqueStoryIds = Array.from(
      new Set(((countData ?? []) as Array<{ shelf_id: string; story_id: string }>).map((row) => row.story_id)),
    );

    let storyMap: Record<string, ShelfStoryPreview> = {};
    if (uniqueStoryIds.length > 0) {
      const { data: storiesData } = await supabase
        .from("stories")
        .select("id, title, slug")
        .in("id", uniqueStoryIds);

      storyMap = Object.fromEntries(
        ((storiesData ?? []) as Array<{ id: string; title: string; slug: string }>).map((story) => [
          story.id,
          { title: story.title, slug: story.slug },
        ]),
      );
    }

    const previewsByShelf = Object.fromEntries(
      Object.entries(previews).map(([shelfId, storyIds]) => [
        shelfId,
        storyIds
          .map((storyId) => storyMap[storyId])
          .filter(Boolean)
          .slice(0, 3),
      ]),
    );

    setCountsByShelf(counts);
    setPreviewByShelf(previewsByShelf);
    setLoading(false);
  };

  useEffect(() => {
    let isMounted = true;

    const loadUser = async () => {
      const { data } = await supabase.auth.getUser();
      const uid = data.user?.id ?? null;
      if (!isMounted) return;
      setUserId(uid);

      if (!uid) {
        setLoading(false);
        return;
      }

      await loadShelves(uid);
    };

    loadUser();

    return () => {
      isMounted = false;
    };
  }, []);

  const createShelf = async (event: FormEvent) => {
    event.preventDefault();
    if (!userId) return;
    const name = newShelf.trim();
    if (!name) return;

    const { error: createError } = await supabase.from("shelves").insert({
      user_id: userId,
      name,
    });

    if (createError) {
      setError(createError.message || "Unable to create shelf.");
      return;
    }

    setNewShelf("");
    await loadShelves(userId);
  };

  const renameShelf = async (shelf: ShelfRow) => {
    if (!userId) return;
    const nextName = window.prompt("Rename shelf", shelf.name)?.trim();
    if (!nextName || nextName === shelf.name) return;

    const { error: renameError } = await supabase
      .from("shelves")
      .update({ name: nextName })
      .eq("id", shelf.id)
      .eq("user_id", userId);

    if (renameError) {
      setError(renameError.message || "Unable to rename shelf.");
      return;
    }

    await loadShelves(userId);
  };

  const deleteShelf = async (shelf: ShelfRow) => {
    if (!userId) return;
    if (shelf.name === "Read Later") {
      setError("Read Later is your default shelf and cannot be deleted.");
      return;
    }

    const ok = window.confirm(`Delete shelf "${shelf.name}"?`);
    if (!ok) return;

    const { error: deleteError } = await supabase
      .from("shelves")
      .delete()
      .eq("id", shelf.id)
      .eq("user_id", userId);

    if (deleteError) {
      setError(deleteError.message || "Unable to delete shelf.");
      return;
    }

    await loadShelves(userId);
  };

  if (loading) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-5 text-sm text-slate-600">
        Loading shelves...
      </div>
    );
  }

  if (!userId) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-5 text-sm text-slate-600">
        Sign in to view your shelves.
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Shelves</h1>
        <p className="text-sm text-slate-600">
          Playlist-style collections for stories you want to read later.
        </p>
      </header>

      <form
        onSubmit={createShelf}
        className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
      >
        <div className="flex gap-2">
          <input
            value={newShelf}
            onChange={(event) => setNewShelf(event.target.value)}
            placeholder="Create a new shelf"
            className="h-10 flex-1 rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-slate-400"
          />
          <button
            type="submit"
            className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white"
          >
            Add
          </button>
        </div>
      </form>

      {error ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
          {error}
        </div>
      ) : null}

      {shelves.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-5 text-sm text-slate-600">
          No shelves yet.
        </div>
      ) : (
        <div className="space-y-3">
          {shelves.map((shelf) => (
            <article key={shelf.id} className="book-surface rounded-2xl p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-2">
                  <Link href={`/shelves/${shelf.id}`} className="no-underline hover:no-underline">
                    <h2 className="text-lg font-semibold text-slate-900">{shelf.name}</h2>
                    <p className="text-xs text-slate-500">
                      {countsByShelf[shelf.id] ?? 0} stories
                    </p>
                  </Link>
                  {(previewByShelf[shelf.id] ?? []).length > 0 ? (
                    <ul className="space-y-1">
                      {(previewByShelf[shelf.id] ?? []).map((story) => (
                        <li key={`${shelf.id}-${story.slug}`} className="text-sm text-slate-600">
                          <Link href={`/story/${story.slug}`} className="hover:underline">
                            {story.title}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-sm text-slate-500">No stories in this shelf yet.</p>
                  )}
                </div>
                <div className="flex gap-2">
                  <Link
                    href={`/shelves/${shelf.id}`}
                    className="rounded-full border border-slate-300 px-3 py-1 text-xs font-semibold text-slate-700 no-underline hover:no-underline"
                  >
                    View stories
                  </Link>
                  <button
                    type="button"
                    onClick={() => renameShelf(shelf)}
                    className="rounded-full border border-slate-300 px-3 py-1 text-xs font-semibold text-slate-700"
                  >
                    Rename
                  </button>
                  <button
                    type="button"
                    onClick={() => deleteShelf(shelf)}
                    className="rounded-full border border-rose-300 px-3 py-1 text-xs font-semibold text-rose-700"
                  >
                    Delete
                  </button>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
