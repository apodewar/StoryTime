"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "../../../../lib/supabase/client";

type LengthClass = "flash" | "short" | "storytime";

type StoryRow = {
  id: string;
  title: string;
  slug: string;
  body: string;
  length_class: LengthClass;
  genre: string;
  tags?: string | null;
  content_warnings?: string | null;
  original_author?: string | null;
  is_public_domain?: boolean | null;
  cover_url?: string | null;
  cover_path?: string | null;
  author_id: string | null;
};

export default function EditStoryPage() {
  const router = useRouter();
  const params = useParams<{ slug: string }>();
  const slug = params?.slug;
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [story, setStory] = useState<StoryRow | null>(null);

  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [lengthClass, setLengthClass] = useState<LengthClass>("flash");
  const [genre, setGenre] = useState("");
  const [tags, setTags] = useState("");
  const [contentWarnings, setContentWarnings] = useState("");
  const [originalAuthor, setOriginalAuthor] = useState("");
  const [isPublicDomain, setIsPublicDomain] = useState(false);
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [coverPreview, setCoverPreview] = useState<string | null>(null);

  const estimateReadingTime = (text: string) => {
    const words = text.trim().split(/\s+/).filter(Boolean).length;
    const minutes = Math.max(1, Math.ceil(words / 200));
    return minutes;
  };

  useEffect(() => {
    const loadUser = async () => {
      const { data } = await supabase.auth.getUser();
      setUserId(data?.user?.id ?? null);
    };

    loadUser();
  }, []);

  useEffect(() => {
    return () => {
      if (coverPreview) {
        URL.revokeObjectURL(coverPreview);
      }
    };
  }, [coverPreview]);

  useEffect(() => {
    let isMounted = true;

    const loadStory = async () => {
      if (!slug) return;
      setLoading(true);
      setError(null);

      const { data, error: storyError } = await supabase
        .from("stories")
        .select(
          "id, title, slug, body, length_class, genre, tags, content_warnings, original_author, is_public_domain, cover_url, cover_path, author_id"
        )
        .eq("slug", slug)
        .single();

      if (!isMounted) return;

      if (storyError || !data) {
        setError("Unable to load this story right now.");
        setStory(null);
        setLoading(false);
        return;
      }

      const row = data as StoryRow;
      setStory(row);
      setTitle(row.title ?? "");
      setBody(row.body ?? "");
      setLengthClass(row.length_class ?? "flash");
      setGenre(row.genre ?? "");
      setTags(row.tags ?? "");
      setContentWarnings(row.content_warnings ?? "");
      setOriginalAuthor(row.original_author ?? "");
      setIsPublicDomain(!!row.is_public_domain);
      setCoverPreview(row.cover_url ?? null);
      setLoading(false);
    };

    loadStory();

    return () => {
      isMounted = false;
    };
  }, [slug]);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);

    if (!story) {
      setError("Story not loaded.");
      return;
    }

    if (!userId || story.author_id !== userId) {
      setError("You can only edit your own stories.");
      return;
    }

    if (!title.trim() || !body.trim() || !genre.trim()) {
      setError("Title, body, and genre are required.");
      return;
    }

    setSaving(true);

    const readingTime = estimateReadingTime(body);
    let coverUrl = story.cover_url ?? null;
    let coverPath = story.cover_path ?? null;

    if (coverFile) {
      const extension =
        coverFile.name.split(".").pop()?.toLowerCase() ?? "jpg";
      coverPath = `${userId}/${story.slug}-${Date.now()}.${extension}`;
      const { error: uploadError } = await supabase.storage
        .from("story-covers")
        .upload(coverPath, coverFile, {
          upsert: true,
          contentType: coverFile.type,
        });

      if (uploadError) {
        setError(`Cover upload failed: ${uploadError.message}`);
        setSaving(false);
        return;
      }

      const { data: publicData } = supabase.storage
        .from("story-covers")
        .getPublicUrl(coverPath);
      coverUrl = publicData.publicUrl;
    }

    const { error: updateError } = await supabase
      .from("stories")
      .update({
        title: title.trim(),
        body: body.trim(),
        length_class: lengthClass,
        genre: genre.trim(),
        tags: tags.trim() || null,
        content_warnings: contentWarnings.trim() || null,
        original_author: originalAuthor.trim() || null,
        is_public_domain: isPublicDomain,
        reading_time: readingTime,
        cover_url: coverUrl,
        cover_path: coverPath,
      })
      .eq("id", story.id);

    if (updateError) {
      setError(updateError.message);
      setSaving(false);
      return;
    }

    setSaving(false);
    router.push(`/story/${story.slug}`);
  };

  if (loading) {
    return (
      <div className="rounded-lg border border-slate-200 bg-white p-6 text-slate-600">
        Loading story...
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-4 rounded-lg border border-rose-200 bg-rose-50 p-6 text-rose-700">
        <div>{error}</div>
        <Link href="/feed" className="inline-flex text-sm font-semibold text-rose-700">
          Back to feed
        </Link>
      </div>
    );
  }

  if (!story) {
    return (
      <div className="rounded-lg border border-slate-200 bg-white p-6 text-slate-600">
        Story not found.
      </div>
    );
  }

  if (!userId || story.author_id !== userId) {
    return (
      <div className="rounded-lg border border-slate-200 bg-white p-6 text-slate-600">
        You can only edit your own stories.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Edit story</h1>
        <p className="text-slate-600">Update your story details.</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="space-y-2">
          <label className="text-sm font-medium text-slate-700" htmlFor="title">
            Title
          </label>
          <input
            id="title"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-slate-400"
            required
          />
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium text-slate-700" htmlFor="body">
            Story
          </label>
          <textarea
            id="body"
            value={body}
            onChange={(event) => setBody(event.target.value)}
            className="min-h-[260px] w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-slate-400"
            required
          />
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <label
              className="text-sm font-medium text-slate-700"
              htmlFor="lengthClass"
            >
              Length class
            </label>
            <select
              id="lengthClass"
              value={lengthClass}
              onChange={(event) =>
                setLengthClass(event.target.value as LengthClass)
              }
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-slate-400"
            >
              <option value="flash">Flash (3 min)</option>
              <option value="short">Short (5 min)</option>
              <option value="storytime">Storytime (10-15 min)</option>
            </select>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700" htmlFor="genre">
              Genre
            </label>
            <input
              id="genre"
              value={genre}
              onChange={(event) => setGenre(event.target.value)}
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-slate-400"
              required
            />
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700" htmlFor="tags">
              Tags
            </label>
            <input
              id="tags"
              value={tags}
              onChange={(event) => setTags(event.target.value)}
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-slate-400"
              placeholder="magic, slow burn, cozy"
            />
          </div>

          <div className="space-y-2">
            <label
              className="text-sm font-medium text-slate-700"
              htmlFor="contentWarnings"
            >
              Content warnings
            </label>
            <input
              id="contentWarnings"
              value={contentWarnings}
              onChange={(event) => setContentWarnings(event.target.value)}
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-slate-400"
              placeholder="violence, grief"
            />
          </div>
        </div>

        <div className="space-y-2">
          <label
            className="text-sm font-medium text-slate-700"
            htmlFor="originalAuthor"
          >
            Original author (optional)
          </label>
          <input
            id="originalAuthor"
            value={originalAuthor}
            onChange={(event) => setOriginalAuthor(event.target.value)}
            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-slate-400"
            placeholder="Brothers Grimm"
          />
        </div>

        <label className="flex items-center gap-3 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={isPublicDomain}
            onChange={(event) => setIsPublicDomain(event.target.checked)}
            className="h-4 w-4 rounded border-slate-300 text-slate-900"
          />
          Public domain story (e.g., Brothers Grimm, Aesop)
        </label>

        <div className="space-y-2">
          <label className="text-sm font-medium text-slate-700" htmlFor="cover">
            Cover image (optional)
          </label>
          <input
            id="cover"
            type="file"
            accept="image/*"
            onChange={(event) => {
              const file = event.target.files?.[0] ?? null;
              setError(null);
              if (!file) {
                setCoverFile(null);
                setCoverPreview(story.cover_url ?? null);
                return;
              }
              if (file.size > 5 * 1024 * 1024) {
                setError("Cover image must be smaller than 5MB.");
                event.target.value = "";
                setCoverFile(null);
                return;
              }
              setCoverFile(file);
              setCoverPreview(URL.createObjectURL(file));
            }}
            className="block w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600"
          />
          {coverPreview ? (
            <div className="overflow-hidden rounded-xl border border-slate-200">
              <img
                src={coverPreview}
                alt="Cover preview"
                className="h-48 w-full object-cover"
              />
            </div>
          ) : null}
        </div>

        {error ? (
          <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
            {error}
          </div>
        ) : null}

        <button
          type="submit"
          disabled={saving}
          className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {saving ? "Saving..." : "Save changes"}
        </button>
      </form>
    </div>
  );
}
