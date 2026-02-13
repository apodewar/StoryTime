"use client";

import { useEffect, useState } from "react";
import StoryCard from "../../components/StoryCard";
import { DiscoveryItem, fetchDiscoveryItems } from "../../lib/discovery-feed";

export default function PublicDomainPage() {
  const [stories, setStories] = useState<DiscoveryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    const loadStories = async () => {
      setLoading(true);
      setError(null);

      try {
        const data = await fetchDiscoveryItems({
          onlyPublicDomain: true,
          mode: "newest",
          limit: 50,
        });

        if (!isMounted) return;
        setStories(data);
      } catch (loadError) {
        if (!isMounted) return;
        setError(loadError instanceof Error ? loadError.message : "Unable to load public domain stories right now.");
        setStories([]);
      }

      setLoading(false);
    };

    loadStories();

    return () => {
      isMounted = false;
    };
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Public domain</h1>
        <p className="text-slate-600">
          Classic stories from the public domain, clearly labeled and mixed into discovery modes.
        </p>
      </div>

      {loading ? (
        <div className="rounded-lg border border-slate-200 bg-white p-6 text-slate-600">
          Loading stories...
        </div>
      ) : error ? (
        <div className="rounded-lg border border-rose-200 bg-rose-50 p-6 text-rose-700">
          {error}
        </div>
      ) : stories.length === 0 ? (
        <div className="rounded-lg border border-slate-200 bg-white p-6 text-slate-600">
          No public domain stories yet.
        </div>
      ) : (
        <div className="space-y-4">
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
              author_label="Original author"
              origin_label="Public domain"
              likes={story.likes}
              views={story.views}
            />
          ))}
        </div>
      )}
    </div>
  );
}
