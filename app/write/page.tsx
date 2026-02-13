"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabase/client";
import { STORY_GENRES, STORY_LENGTH_TIERS, StoryLengthClass } from "../../types/story";

type StoryInsert = {
  title: string;
  slug: string;
  synopsis_1?: string | null;
  body: string;
  length_class: StoryLengthClass;
  genre: string;
  tags?: string | null;
  content_warnings?: string | null;
  original_author?: string | null;
  is_public_domain?: boolean;
  status: "draft" | "published";
  author_id: string;
  reading_time: number;
  published_at?: string | null;
  cover_url?: string | null;
  cover_image_url?: string | null;
  cover_path?: string | null;
};

const sanitizeSlugBase = (value: string) => {
  const base = value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "")
    .slice(0, 72);
  return base || "story";
};

const estimateReadingTime = (text: string) => {
  const words = text.trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.ceil(words / 200));
};

async function generateUniqueSlug(baseInput: string) {
  const base = sanitizeSlugBase(baseInput);

  for (let i = 0; i < 50; i += 1) {
    const candidate = i === 0 ? base : `${base}-${i + 1}`;
    const { data, error } = await supabase
      .from("stories")
      .select("slug")
      .eq("slug", candidate)
      .maybeSingle();

    if (error) {
      throw new Error("Unable to validate slug uniqueness.");
    }

    if (!data) return candidate;
  }

  return `${base}-${Date.now()}`;
}

export default function WritePage() {
  const router = useRouter();
  const [userId, setUserId] = useState<string | null>(null);
  const [loadingUser, setLoadingUser] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [title, setTitle] = useState("");
  const [synopsis1, setSynopsis1] = useState("");
  const [body, setBody] = useState("");
  const [lengthClass, setLengthClass] = useState<StoryLengthClass>("flash");
  const [genre, setGenre] = useState<string>(STORY_GENRES[0]);
  const [tags, setTags] = useState("");
  const [contentWarnings, setContentWarnings] = useState("");
  const [originalAuthor, setOriginalAuthor] = useState("");
  const [isPublicDomain, setIsPublicDomain] = useState(false);
  const [publishMode, setPublishMode] = useState<"draft" | "published">("published");
  const [coverUrlInput, setCoverUrlInput] = useState("");
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [coverPreview, setCoverPreview] = useState<string | null>(null);

  useEffect(() => {
    const loadUser = async () => {
      const { data } = await supabase.auth.getUser();
      setUserId(data?.user?.id ?? null);
      setLoadingUser(false);
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

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    setSuccess(null);

    if (!title.trim() || !body.trim()) {
      setError("Title and body are required.");
      return;
    }

    if (!userId) {
      setError("You need to be logged in to write.");
      return;
    }

    setSubmitting(true);

    try {
      const slug = await generateUniqueSlug(title);
      const readingTime = estimateReadingTime(body);

      let coverUrl = coverUrlInput.trim() || null;
      let coverPath: string | null = null;

      if (coverFile) {
        const extension = coverFile.name.split(".").pop()?.toLowerCase() ?? "jpg";
        coverPath = `${userId}/${slug}-${Date.now()}.${extension}`;
        const { error: uploadError } = await supabase.storage
          .from("story-covers")
          .upload(coverPath, coverFile, {
            upsert: true,
            contentType: coverFile.type,
          });

        if (uploadError) {
          throw new Error(`Cover upload failed: ${uploadError.message}`);
        }

        const { data: publicData } = supabase.storage
          .from("story-covers")
          .getPublicUrl(coverPath);
        coverUrl = publicData.publicUrl;
      }

      const payload: StoryInsert = {
        title: title.trim(),
        slug,
        synopsis_1: synopsis1.trim() || null,
        body: body.trim(),
        length_class: lengthClass,
        genre: genre.trim(),
        tags: tags.trim() || null,
        content_warnings: contentWarnings.trim() || null,
        original_author: originalAuthor.trim() || null,
        is_public_domain: isPublicDomain,
        status: publishMode,
        author_id: userId,
        reading_time: readingTime,
        published_at: publishMode === "published" ? new Date().toISOString() : null,
        cover_url: coverUrl,
        cover_image_url: coverUrl,
        cover_path: coverPath,
      };

      const { data, error: insertError } = await supabase
        .from("stories")
        .insert(payload)
        .select("slug,status")
        .single();

      if (insertError) {
        throw new Error(insertError.message);
      }

      setSuccess(
        publishMode === "published"
          ? "Story published."
          : "Draft saved.",
      );

      if (data?.slug && publishMode === "published") {
        router.push(`/story/${data.slug}`);
      } else {
        router.push("/feed");
      }
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "Unable to save story right now.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  if (loadingUser) {
    return (
      <div className="rounded-lg border border-slate-200 bg-white p-6 text-slate-600">
        Checking your session...
      </div>
    );
  }

  if (!userId) {
    return (
      <div className="space-y-4 rounded-lg border border-slate-200 bg-white p-6">
        <h1 className="text-2xl font-semibold tracking-tight">Log in to write</h1>
        <p className="text-slate-600">Create an account or log in to publish new stories.</p>
        <Link
          href="/login"
          className="inline-flex rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white"
        >
          Go to login
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Write a story</h1>
        <p className="text-slate-600">Create a draft or publish instantly.</p>
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
            placeholder="The night the lights went out"
            required
          />
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium text-slate-700" htmlFor="synopsis1">
            One-line synopsis
          </label>
          <input
            id="synopsis1"
            value={synopsis1}
            onChange={(event) => setSynopsis1(event.target.value)}
            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-slate-400"
            placeholder="A single sentence hook for the feed."
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
            placeholder="Start typing your story..."
            required
          />
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700" htmlFor="lengthClass">
              Length class
            </label>
            <select
              id="lengthClass"
              value={lengthClass}
              onChange={(event) => setLengthClass(event.target.value as StoryLengthClass)}
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-slate-400"
            >
              {STORY_LENGTH_TIERS.map((tier) => (
                <option key={tier} value={tier}>
                  {tier === "flash" ? "Flash" : tier === "short" ? "Short" : "Storytime"}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700" htmlFor="genre">
              Genre
            </label>
            <select
              id="genre"
              value={genre}
              onChange={(event) => setGenre(event.target.value)}
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-slate-400"
            >
              {STORY_GENRES.map((genreOption) => (
                <option key={genreOption} value={genreOption}>
                  {genreOption}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700" htmlFor="status">
              Publish mode
            </label>
            <select
              id="status"
              value={publishMode}
              onChange={(event) =>
                setPublishMode(event.target.value as "draft" | "published")
              }
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-slate-400"
            >
              <option value="published">Publish now</option>
              <option value="draft">Save as draft</option>
            </select>
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
            <label className="text-sm font-medium text-slate-700" htmlFor="contentWarnings">
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
          <label className="text-sm font-medium text-slate-700" htmlFor="originalAuthor">
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
          Public domain story
        </label>

        <div className="space-y-2">
          <label className="text-sm font-medium text-slate-700" htmlFor="coverUrl">
            Cover image URL (optional)
          </label>
          <input
            id="coverUrl"
            value={coverUrlInput}
            onChange={(event) => setCoverUrlInput(event.target.value)}
            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-slate-400"
            placeholder="https://..."
          />
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium text-slate-700" htmlFor="coverFile">
            Cover upload (optional)
          </label>
          <input
            id="coverFile"
            type="file"
            accept="image/*"
            onChange={(event) => {
              const file = event.target.files?.[0] ?? null;
              setError(null);
              if (!file) {
                setCoverFile(null);
                setCoverPreview(null);
                return;
              }
              if (file.size > 5 * 1024 * 1024) {
                setError("Cover image must be smaller than 5MB.");
                event.target.value = "";
                setCoverFile(null);
                setCoverPreview(null);
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

        {success ? (
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
            {success}
          </div>
        ) : null}

        <button
          type="submit"
          disabled={submitting}
          className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {submitting
            ? publishMode === "published"
              ? "Publishing..."
              : "Saving draft..."
            : publishMode === "published"
              ? "Publish story"
              : "Save draft"}
        </button>
      </form>
    </div>
  );
}
