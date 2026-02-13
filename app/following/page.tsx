"use client";

import { useEffect, useState } from "react";
import StoryCard from "../../components/StoryCard";
import { supabase } from "../../lib/supabase/client";
import { StoryRecord } from "../../types/story";

type StoryRow = StoryRecord;

type ProfileRow = {
  id: string;
  display_name: string | null;
};

type FollowRow = {
  following_id: string;
};

export default function FollowingPage() {
  const [stories, setStories] = useState<
    Array<
      StoryRow & {
        author_name: string;
        synopsis: string;
      }
    >
  >([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    const load = async () => {
      setLoading(true);
      setError(null);

      const { data: authData } = await supabase.auth.getUser();
      const userId = authData.user?.id ?? null;
      if (!isMounted) return;

      if (!userId) {
        setStories([]);
        setLoading(false);
        return;
      }

      const { data: followingData } = await supabase
        .from("follows")
        .select("following_id")
        .eq("follower_id", userId);

      const followingIds = ((followingData ?? []) as FollowRow[]).map(
        (row) => row.following_id,
      );

      if (followingIds.length === 0) {
        setStories([]);
        setLoading(false);
        return;
      }

      const { data: storyData, error: storyError } = await supabase
        .from("stories")
        .select(
          "id, title, slug, synopsis_1, body, length_class, reading_time, genre, tags, cover_url, cover_image_url, author_id, original_author, is_public_domain, published_at",
        )
        .eq("status", "published")
        .in("author_id", followingIds)
        .order("published_at", { ascending: false })
        .limit(50);

      if (!isMounted) return;

      if (storyError) {
        setError("Unable to load following feed right now.");
        setStories([]);
        setLoading(false);
        return;
      }

      const loadedStories = (storyData ?? []) as StoryRow[];

      const { data: profileData } = await supabase
        .from("profiles")
        .select("id, display_name")
        .in("id", followingIds);

      const profiles = Object.fromEntries(
        ((profileData ?? []) as ProfileRow[]).map((profile) => [
          profile.id,
          profile.display_name ?? "Unknown author",
        ]),
      );

      const enriched = loadedStories.map((story) => ({
        ...story,
        author_name: story.author_id ? profiles[story.author_id] ?? "Unknown author" : "Unknown author",
        synopsis:
          story.synopsis_1?.trim() ||
          (story.body.replace(/\s+/g, " ").trim().match(/[^.!?]+[.!?]/)?.[0] ??
            "No synopsis available."),
      }));

      setStories(enriched);
      setLoading(false);
    };

    load();

    return () => {
      isMounted = false;
    };
  }, []);

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Following Feed</h1>
        <p className="text-sm text-slate-600">
          Stories from authors you follow. This differs from Algo feed by using only your social graph.
        </p>
      </header>

      {loading ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-5 text-slate-600">
          Loading following feed...
        </div>
      ) : error ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-5 text-rose-700">
          {error}
        </div>
      ) : stories.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-5 text-slate-600">
          No stories from followed authors yet.
        </div>
      ) : (
        <section className="space-y-3">
          {stories.map((story) => (
            <StoryCard
              key={story.id}
              id={story.id}
              title={story.title}
              slug={story.slug}
              length_class={story.length_class}
              reading_time={story.reading_time}
              genre={story.genre}
              tags={story.tags}
              synopsis={story.synopsis}
              cover_url={story.cover_url ?? story.cover_image_url}
              author_name={story.author_name}
              author_label="By"
              showActions={false}
            />
          ))}
        </section>
      )}
    </div>
  );
}
