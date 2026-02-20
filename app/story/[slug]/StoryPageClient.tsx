"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "../../../lib/supabase/client";
import CompletionTracker from "../../../components/CompletionTracker";
import Reader from "../../../components/Reader";
import { StoryRecord } from "../../../types/story";

type StoryDetail = StoryRecord;
type NextStory = {
  slug: string;
  title: string;
};

type Profile = {
  id: string;
  username?: string | null;
  display_name: string | null;
  avatar_url?: string | null;
};

type CommentRow = {
  id: string;
  body: string;
  created_at: string;
  user_id: string | null;
  profile?: Profile | null;
  like_count?: number;
  liked_by_me?: boolean;
};

type StoryPageClientProps = {
  slug: string;
};

export default function StoryPageClient({ slug }: StoryPageClientProps) {
  const [story, setStory] = useState<StoryDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reachedBottom, setReachedBottom] = useState(false);
  const [author, setAuthor] = useState<Profile | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [currentUserProfile, setCurrentUserProfile] = useState<Profile | null>(
    null,
  );
  const [likeCount, setLikeCount] = useState(0);
  const [liked, setLiked] = useState(false);
  const [likeError, setLikeError] = useState<string | null>(null);
  const [comments, setComments] = useState<CommentRow[]>([]);
  const [commentBody, setCommentBody] = useState("");
  const [commentError, setCommentError] = useState<string | null>(null);
  const [commentLoading, setCommentLoading] = useState(false);
  const [commentLikeLoadingId, setCommentLikeLoadingId] = useState<string | null>(null);
  const [activeCommentLikeId, setActiveCommentLikeId] = useState<string | null>(null);
  const [commentLikeError, setCommentLikeError] = useState<string | null>(null);
  const [isFollowingAuthor, setIsFollowingAuthor] = useState(false);
  const [followLoading, setFollowLoading] = useState(false);
  const [followError, setFollowError] = useState<string | null>(null);
  const [reportReason, setReportReason] = useState("");
  const [reportLoading, setReportLoading] = useState(false);
  const [reportMessage, setReportMessage] = useState<string | null>(null);
  const [readerMode, setReaderMode] = useState<"scroll" | "page">("scroll");
  const [nextStory, setNextStory] = useState<NextStory | null>(null);

  useEffect(() => {
    let isMounted = true;

    const loadStory = async () => {
      if (!slug) return;

      setLoading(true);
      setError(null);

      const { data, error: queryError } = await supabase
        .from("stories")
        .select("id, title, slug, body, reading_time, genre, tags, original_author, is_public_domain, cover_url, author_id, published_at")
        .eq("slug", slug)
        .single();

      if (!isMounted) return;

      if (queryError) {
        setError(queryError.message || "Unable to load this story right now.");
        setStory(null);
      } else {
        setStory(data as StoryDetail);
      }

      setLoading(false);
    };

    loadStory();

    return () => {
      isMounted = false;
    };
  }, [slug]);

  useEffect(() => {
    let isMounted = true;

    const loadUser = async () => {
      const { data } = await supabase.auth.getUser();
      if (!isMounted) return;
      setUserId(data?.user?.id ?? null);
    };

    loadUser();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    let isMounted = true;

    const loadCurrentProfile = async () => {
      if (!userId) {
        setCurrentUserProfile(null);
        return;
      }

      const { data } = await supabase
        .from("profiles")
        .select("id, username, display_name, avatar_url")
        .eq("id", userId)
        .maybeSingle();

      if (!isMounted) return;
      if (data) {
        setCurrentUserProfile(data as Profile);
      }

      const { data: settingsData } = await supabase
        .from("user_settings")
        .select("reader_mode")
        .eq("user_id", userId)
        .maybeSingle();

      if (!isMounted) return;
      if (settingsData?.reader_mode === "page" || settingsData?.reader_mode === "scroll") {
        setReaderMode(settingsData.reader_mode);
      }
    };

    loadCurrentProfile();

    return () => {
      isMounted = false;
    };
  }, [userId]);

  useEffect(() => {
    let isMounted = true;

    const loadDetails = async () => {
      if (!story) return;

      if (story.author_id) {
        const { data: authorData } = await supabase
          .from("profiles")
          .select("id, username, display_name, avatar_url")
          .eq("id", story.author_id)
          .maybeSingle();

        if (isMounted) {
          setAuthor((authorData as Profile | null) ?? null);
        }
      } else {
        setAuthor(null);
      }

      if (userId && story.author_id && userId !== story.author_id) {
        const { data: followRow } = await supabase
          .from("follows")
          .select("follower_id")
          .eq("follower_id", userId)
          .eq("following_id", story.author_id)
          .maybeSingle();
        if (isMounted) {
          setIsFollowingAuthor(!!followRow);
        }
      } else if (isMounted) {
        setIsFollowingAuthor(false);
      }

      const { count } = await supabase
        .from("story_likes")
        .select("id", { count: "exact", head: true })
        .eq("story_id", story.id);

      if (isMounted) {
        setLikeCount(count ?? 0);
      }

      if (userId) {
        const { data: likedRow } = await supabase
          .from("story_likes")
          .select("id")
          .eq("story_id", story.id)
          .eq("user_id", userId)
          .maybeSingle();

        if (isMounted) {
          setLiked(!!likedRow);
        }
      } else if (isMounted) {
        setLiked(false);
      }

      const { data: commentData } = await supabase
        .from("story_comments")
        .select("id, body, created_at, user_id")
        .eq("story_id", story.id)
        .order("created_at", { ascending: true });

      const baseComments = (commentData ?? []) as CommentRow[];
      const commentIds = baseComments.map((item) => item.id);
      const commenterIds = Array.from(
        new Set(baseComments.map((item) => item.user_id).filter(Boolean)),
      ) as string[];

      let profilesById: Record<string, Profile> = {};
      if (commenterIds.length > 0) {
        const { data: profileData } = await supabase
          .from("profiles")
          .select("id, display_name, avatar_url")
          .in("id", commenterIds);
        profilesById = Object.fromEntries(
          (profileData ?? []).map((profile) => [profile.id, profile as Profile]),
        );
      }

      let commentLikeRows: Array<{ comment_id: string; user_id: string }> = [];
      if (commentIds.length > 0) {
        const { data: likesData } = await supabase
          .from("story_comment_likes")
          .select("comment_id, user_id")
          .in("comment_id", commentIds);

        commentLikeRows =
          ((likesData ?? []) as Array<{ comment_id: string; user_id: string }>) ?? [];
      }

      const likeCountsByComment = commentLikeRows.reduce(
        (acc, row) => {
          acc[row.comment_id] = (acc[row.comment_id] ?? 0) + 1;
          return acc;
        },
        {} as Record<string, number>,
      );

      const likedByMeCommentIds = new Set(
        userId
          ? commentLikeRows
              .filter((row) => row.user_id === userId)
              .map((row) => row.comment_id)
          : [],
      );

      if (isMounted) {
        setComments(
          baseComments.map((comment) => ({
            ...comment,
            profile: comment.user_id ? profilesById[comment.user_id] ?? null : null,
            like_count: likeCountsByComment[comment.id] ?? 0,
            liked_by_me: likedByMeCommentIds.has(comment.id),
          })),
        );
      }
    };

    loadDetails();

    return () => {
      isMounted = false;
    };
  }, [story, userId]);

  useEffect(() => {
    let isMounted = true;

    const loadNextStory = async () => {
      if (!story?.id) {
        setNextStory(null);
        return;
      }

      let query = supabase
        .from("stories")
        .select("slug, title")
        .eq("status", "published")
        .neq("id", story.id)
        .order("published_at", { ascending: false })
        .limit(1);

      if (story.published_at) {
        query = query.lt("published_at", story.published_at);
      }

      const { data } = await query;

      if (!isMounted) return;

      if (data && data.length > 0) {
        setNextStory(data[0] as NextStory);
        return;
      }

      const { data: fallbackData } = await supabase
        .from("stories")
        .select("slug, title")
        .eq("status", "published")
        .neq("id", story.id)
        .order("published_at", { ascending: false })
        .limit(1);

      if (!isMounted) return;
      setNextStory((fallbackData?.[0] as NextStory | undefined) ?? null);
    };

    loadNextStory();

    return () => {
      isMounted = false;
    };
  }, [story?.id, story?.published_at]);

  useEffect(() => {
    const handleScroll = () => {
      const scrollPosition = window.innerHeight + window.scrollY;
      const pageHeight = document.documentElement.scrollHeight;

      if (pageHeight > 0 && scrollPosition >= pageHeight - 4) {
        setReachedBottom(true);
      }
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    handleScroll();

    return () => {
      window.removeEventListener("scroll", handleScroll);
    };
  }, []);

  if (loading) {
    return (
      <div className="rounded-lg border border-slate-200 bg-white p-6 text-slate-600">
        Loading story...
      </div>
    );
  }

  if (error || !story) {
    return (
      <div className="rounded-lg border border-rose-200 bg-rose-50 p-6 text-rose-700">
        {error ?? "Story not found."}
      </div>
    );
  }

  const tags = story.tags
    ? story.tags
        .split(",")
        .map((tag) => tag.trim())
        .filter(Boolean)
    : [];

  const authorName = author?.display_name ?? "Unknown author";

  const handleToggleLike = async () => {
    if (!story) return;
    setLikeError(null);

    if (!userId) {
      setLikeError("Sign in to like this story.");
      return;
    }

    if (liked) {
      const { error: unlikeError } = await supabase
        .from("story_likes")
        .delete()
        .eq("story_id", story.id)
        .eq("user_id", userId);

      if (unlikeError) {
        setLikeError("Unable to update like right now.");
      } else {
        setLiked(false);
        setLikeCount((prev) => Math.max(0, prev - 1));
      }
      return;
    }

    const { error: insertLikeError } = await supabase.from("story_likes").insert({
      story_id: story.id,
      user_id: userId,
    });

    if (insertLikeError) {
      setLikeError("Unable to update like right now.");
    } else {
      setLiked(true);
      setLikeCount((prev) => prev + 1);
    }
  };

  const handleSubmitComment = async (event: FormEvent) => {
    event.preventDefault();
    setCommentError(null);

    if (!story) return;

    if (!userId) {
      setCommentError("Sign in to comment.");
      return;
    }

    const trimmed = commentBody.trim();
    if (!trimmed) {
      setCommentError("Comment cannot be empty.");
      return;
    }

    setCommentLoading(true);
    const { data, error: insertError } = await supabase
      .from("story_comments")
      .insert({
        story_id: story.id,
        user_id: userId,
        body: trimmed,
      })
      .select("id, body, created_at, user_id")
      .single();

    if (insertError || !data) {
      setCommentError("Unable to post comment right now.");
    } else {
      setComments((prev) => [
        ...prev,
        {
          ...(data as CommentRow),
          profile: currentUserProfile,
          like_count: 0,
          liked_by_me: false,
        },
      ]);
      setCommentBody("");
    }

    setCommentLoading(false);
  };

  const handleToggleCommentLike = async (comment: CommentRow) => {
    setActiveCommentLikeId(comment.id);
    setCommentLikeError(null);

    if (!userId) {
      setCommentLikeError("Sign in to like comments.");
      return;
    }

    if (comment.user_id && comment.user_id === userId) {
      setCommentLikeError("You can only like other people's comments.");
      return;
    }

    setCommentLikeLoadingId(comment.id);

    if (comment.liked_by_me) {
      const { error: unlikeError } = await supabase
        .from("story_comment_likes")
        .delete()
        .eq("comment_id", comment.id)
        .eq("user_id", userId);

      if (unlikeError) {
        setCommentLikeError("Unable to update comment like right now.");
      } else {
        setComments((prev) =>
          prev.map((item) =>
            item.id === comment.id
              ? {
                  ...item,
                  liked_by_me: false,
                  like_count: Math.max(0, (item.like_count ?? 0) - 1),
                }
              : item,
          ),
        );
      }

      setCommentLikeLoadingId(null);
      return;
    }

    const { error: likeError } = await supabase.from("story_comment_likes").insert({
      comment_id: comment.id,
      user_id: userId,
    });

    if (likeError) {
      setCommentLikeError("Unable to update comment like right now.");
    } else {
      setComments((prev) =>
        prev.map((item) =>
          item.id === comment.id
            ? {
                ...item,
                liked_by_me: true,
                like_count: (item.like_count ?? 0) + 1,
              }
            : item,
        ),
      );
    }

    setCommentLikeLoadingId(null);
  };

  const handleToggleFollowAuthor = async () => {
    if (!userId) {
      setFollowError("Sign in to follow authors.");
      return;
    }
    if (!story?.author_id || story.author_id === userId) return;

    setFollowError(null);
    setFollowLoading(true);

    if (isFollowingAuthor) {
      const { error: unfollowError } = await supabase
        .from("follows")
        .delete()
        .eq("follower_id", userId)
        .eq("following_id", story.author_id);

      if (unfollowError) {
        setFollowError("Unable to unfollow right now.");
      } else {
        setIsFollowingAuthor(false);
      }
      setFollowLoading(false);
      return;
    }

    const { error: followInsertError } = await supabase.from("follows").insert({
      follower_id: userId,
      following_id: story.author_id,
    });

    if (followInsertError) {
      setFollowError("Unable to follow right now.");
    } else {
      setIsFollowingAuthor(true);
    }
    setFollowLoading(false);
  };

  const handleReport = async () => {
    if (!story) return;

    setReportLoading(true);
    setReportMessage(null);

    const session = await supabase.auth.getSession();
    const token = session.data.session?.access_token ?? "";
    if (!token) {
      setReportMessage("Sign in to report stories.");
      setReportLoading(false);
      return;
    }

    const response = await fetch("/api/reports", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ storyId: story.id, reason: reportReason }),
    });

    if (response.ok) {
      setReportMessage("Report submitted.");
      setReportReason("");
    } else {
      const body = await response.json().catch(() => ({}));
      setReportMessage(body.error ?? "Unable to submit report.");
    }

    setReportLoading(false);
  };

  return (
    <article className="book-surface space-y-6 rounded-3xl p-6 md:p-8">
      {story.cover_url ? (
        <div className="overflow-hidden rounded-2xl border border-amber-100 bg-amber-50">
          <img
            src={story.cover_url}
            alt=""
            className="h-64 w-full object-cover"
          />
        </div>
      ) : null}
      <header className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight text-slate-900">
          {story.title}
        </h1>
        <div className="flex flex-wrap items-center gap-3 text-sm text-slate-600">
          <span className="text-slate-500">By</span>
          {story.author_id ? (
            <Link
              href={`/profile/${author?.username ?? story.author_id}`}
              className="font-medium text-slate-900 hover:underline"
            >
              {authorName}
            </Link>
          ) : (
            <span className="font-medium text-slate-900">{authorName}</span>
          )}
          {story.original_author ? (
            <span className="text-slate-500">
              Original author: {story.original_author}
            </span>
          ) : null}
          {story.is_public_domain ? (
            <span className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700">
              Public domain
            </span>
          ) : null}
          <span className="rounded-full bg-slate-100 px-3 py-1 font-medium text-slate-700">
            {story.genre}
          </span>
          <span>{story.reading_time} min read</span>
        </div>
        {userId && userId === story.author_id ? (
          <div>
            <Link
              href={`/story/${story.slug}/edit`}
              className="inline-flex rounded-full border border-slate-300 px-3 py-1 text-xs font-semibold text-slate-700 transition hover:border-slate-400"
            >
              Edit story
            </Link>
          </div>
        ) : story.author_id ? (
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleToggleFollowAuthor}
              disabled={followLoading}
              className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
                isFollowingAuthor
                  ? "border border-slate-300 text-slate-700 hover:border-slate-400"
                  : "bg-slate-900 text-white hover:bg-slate-800"
              } disabled:cursor-not-allowed disabled:opacity-60`}
            >
              {followLoading
                ? "Saving..."
                : isFollowingAuthor
                  ? "Following"
                  : "Follow"}
            </button>
            {followError ? (
              <span className="text-xs text-rose-600">{followError}</span>
            ) : null}
          </div>
        ) : null}
        {tags.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {tags.map((tag) => (
              <span
                key={tag}
                className="rounded-full border border-slate-200 px-3 py-1 text-xs font-medium text-slate-600"
              >
                #{tag}
              </span>
            ))}
          </div>
        ) : null}
      </header>

      <Reader storyId={story.id} storyBody={story.body} initialMode={readerMode} />

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={handleToggleLike}
          className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
            liked
              ? "bg-slate-900 text-white"
              : "border border-slate-300 text-slate-700 hover:border-slate-400"
          }`}
        >
          {liked ? "Liked" : "Like"} ({likeCount})
        </button>
        {likeError ? (
          <span className="text-sm text-rose-600">
            {likeError}
          </span>
        ) : null}
      </div>

      <section className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="text-sm font-semibold text-slate-900">Report story</h2>
        <textarea
          value={reportReason}
          onChange={(event) => setReportReason(event.target.value)}
          rows={2}
          className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-slate-400"
          placeholder="Optional reason"
        />
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleReport}
            disabled={reportLoading}
            className="rounded-lg border border-rose-300 bg-rose-50 px-3 py-1.5 text-xs font-semibold text-rose-700"
          >
            {reportLoading ? "Submitting..." : "Report"}
          </button>
          {reportMessage ? <span className="text-xs text-slate-600">{reportMessage}</span> : null}
        </div>
      </section>

      <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Comments</h2>
          <p className="text-sm text-slate-500">
            {comments.length} comment{comments.length === 1 ? "" : "s"}
          </p>
        </div>

        <form onSubmit={handleSubmitComment} className="space-y-3">
          <textarea
            value={commentBody}
            onChange={(event) => setCommentBody(event.target.value)}
            rows={3}
            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-slate-400"
            placeholder="Share a thought..."
          />
          {commentError ? (
            <div className="text-sm text-rose-600">{commentError}</div>
          ) : null}
          <button
            type="submit"
            disabled={commentLoading}
            className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {commentLoading ? "Posting..." : "Post comment"}
          </button>
        </form>

        <div className="space-y-4">
          {comments.length === 0 ? (
            <div className="rounded-lg border border-dashed border-slate-200 p-4 text-sm text-slate-500">
              No comments yet. Be the first to jump in.
            </div>
          ) : (
            comments.map((comment) => (
              <div key={comment.id} className="rounded-lg border border-slate-200 p-4">
                <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                  <span className="font-semibold text-slate-700">
                    {comment.profile?.display_name ?? "Reader"}
                  </span>
                  <span>
                    {new Date(comment.created_at).toLocaleDateString()}
                  </span>
                </div>
                <p className="mt-2 whitespace-pre-wrap text-sm text-slate-700">
                  {comment.body}
                </p>
                <div className="mt-3">
                  <button
                    type="button"
                    onClick={() => handleToggleCommentLike(comment)}
                    disabled={
                      commentLikeLoadingId === comment.id
                      || (!!userId && comment.user_id === userId)
                    }
                    className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
                      comment.liked_by_me
                        ? "bg-slate-900 text-white"
                        : "border border-slate-300 text-slate-700 hover:border-slate-400"
                    } disabled:cursor-not-allowed disabled:opacity-60`}
                  >
                    {commentLikeLoadingId === comment.id
                      ? "Saving..."
                      : `${comment.liked_by_me ? "Liked" : "Like"} (${comment.like_count ?? 0})`}
                  </button>
                  {activeCommentLikeId === comment.id && commentLikeError ? (
                    <div className="mt-2 text-xs text-rose-600">{commentLikeError}</div>
                  ) : null}
                </div>
              </div>
            ))
          )}
        </div>
      </section>

      <div className="text-xs text-slate-500">
        {reachedBottom ? "Reached end" : "Keep reading"}
      </div>
      {reachedBottom ? (
        <section className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <h2 className="text-sm font-semibold text-slate-900">You reached the end</h2>
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href="/feed"
              className="rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white"
            >
              Back to feed
            </Link>
            {nextStory ? (
              <Link
                href={`/story/${nextStory.slug}`}
                className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700"
              >
                Next story: {nextStory.title}
              </Link>
            ) : (
              <span className="text-xs text-slate-500">No next story yet.</span>
            )}
          </div>
        </section>
      ) : null}
      <CompletionTracker storyId={story.id} />
    </article>
  );
}

