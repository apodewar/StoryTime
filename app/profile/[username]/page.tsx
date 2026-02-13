"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import StoryCard from "../../../components/StoryCard";
import { supabase } from "../../../lib/supabase/client";

type ProfileRow = {
  id: string;
  username: string | null;
  display_name: string | null;
  bio: string | null;
  avatar_url: string | null;
  created_at: string;
};

type StoryRow = {
  title: string;
  slug: string;
  length_class: "flash" | "short" | "storytime";
  reading_time: number;
  genre: string;
  synopsis_1?: string | null;
  cover_url?: string | null;
  is_public_domain?: boolean | null;
  original_author?: string | null;
  author_name?: string | null;
  author_label?: "By" | "Original author";
  origin_label?: string | null;
};

type ShelfRow = {
  id: string;
  name: string;
};

type FollowRow = {
  follower_id: string;
  following_id: string;
};

type FollowProfileRow = {
  id: string;
  username: string | null;
  display_name: string | null;
};

export default function ProfilePage() {
  const params = useParams<{ username: string }>();
  const usernameParam = params?.username;
  const [sessionUserId, setSessionUserId] = useState<string | null>(null);
  const [profile, setProfile] = useState<ProfileRow | null>(null);
  const [stories, setStories] = useState<StoryRow[]>([]);
  const [shelves, setShelves] = useState<ShelfRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isFollowingProfile, setIsFollowingProfile] = useState(false);
  const [followLoading, setFollowLoading] = useState(false);
  const [followError, setFollowError] = useState<string | null>(null);
  const [followers, setFollowers] = useState<FollowProfileRow[]>([]);
  const [following, setFollowing] = useState<FollowProfileRow[]>([]);
  const [followersCount, setFollowersCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);

  useEffect(() => {
    const loadSession = async () => {
      const { data } = await supabase.auth.getUser();
      setSessionUserId(data?.user?.id ?? null);
    };
    loadSession();
  }, []);

  useEffect(() => {
    let isMounted = true;

    const loadProfile = async () => {
      if (!usernameParam) return;
      setLoading(true);
      setError(null);

      let resolvedProfile: ProfileRow | null = null;

      const { data: byUsername } = await supabase
        .from("profiles")
        .select("id, username, display_name, bio, avatar_url, created_at")
        .eq("username", usernameParam)
        .maybeSingle();

      resolvedProfile = (byUsername as ProfileRow | null) ?? null;

      if (!resolvedProfile) {
        const { data: byId } = await supabase
          .from("profiles")
          .select("id, username, display_name, bio, avatar_url, created_at")
          .eq("id", usernameParam)
          .maybeSingle();
        resolvedProfile = (byId as ProfileRow | null) ?? null;
      }

      if (!resolvedProfile) {
        if (!isMounted) return;
        setError("Profile not found.");
        setProfile(null);
        setStories([]);
        setShelves([]);
        setLoading(false);
        return;
      }

      const profileId = resolvedProfile.id;

      const [storyResult, shelfResult, followersResult, followingResult] = await Promise.all([
        supabase
          .from("stories")
          .select(
            "title, slug, length_class, reading_time, genre, synopsis_1, cover_url, is_public_domain, original_author",
          )
          .eq("author_id", profileId)
          .eq("status", "published")
          .order("published_at", { ascending: false })
          .limit(20),
        supabase
          .from("shelves")
          .select("id, name")
          .eq("user_id", profileId)
          .order("created_at", { ascending: true }),
        supabase
          .from("follows")
          .select("follower_id")
          .eq("following_id", profileId),
        supabase
          .from("follows")
          .select("following_id")
          .eq("follower_id", profileId),
      ]);

      if (!isMounted) return;

      setProfile(resolvedProfile);
      const baseStories = (storyResult.data ?? []) as StoryRow[];
      setStories(
        baseStories.map((story) => ({
          ...story,
          author_name: story.is_public_domain
            ? story.original_author ?? "Unknown author"
            : null,
          author_label: story.is_public_domain ? "Original author" : "By",
          origin_label: story.is_public_domain ? "Public domain" : "Original",
          synopsis_1: story.synopsis_1 ?? undefined,
        })),
      );
      setShelves((shelfResult.data ?? []) as ShelfRow[]);

      const followerIds = ((followersResult.data ?? []) as FollowRow[]).map(
        (row) => row.follower_id,
      );
      const followingIds = ((followingResult.data ?? []) as FollowRow[]).map(
        (row) => row.following_id,
      );
      setFollowersCount(followerIds.length);
      setFollowingCount(followingIds.length);
      const allFollowIds = Array.from(new Set([...followerIds, ...followingIds]));

      const { data: followProfilesData } = allFollowIds.length
        ? await supabase
            .from("profiles")
            .select("id, username, display_name")
            .in("id", allFollowIds)
        : { data: [] as FollowProfileRow[] };

      const followProfilesById = Object.fromEntries(
        ((followProfilesData ?? []) as FollowProfileRow[]).map((item) => [item.id, item]),
      );

      setFollowers(
        followerIds
          .map((id) => followProfilesById[id])
          .filter(Boolean)
          .slice(0, 12),
      );
      setFollowing(
        followingIds
          .map((id) => followProfilesById[id])
          .filter(Boolean)
          .slice(0, 12),
      );

      if (sessionUserId && sessionUserId !== profileId) {
        const { data: followRow } = await supabase
          .from("follows")
          .select("follower_id")
          .eq("follower_id", sessionUserId)
          .eq("following_id", profileId)
          .maybeSingle();
        if (!isMounted) return;
        setIsFollowingProfile(!!followRow);
      } else {
        setIsFollowingProfile(false);
      }

      setLoading(false);
    };

    loadProfile();

    return () => {
      isMounted = false;
    };
  }, [sessionUserId, usernameParam]);

  const handleToggleFollowProfile = async () => {
    if (!profile || !sessionUserId || sessionUserId === profile.id) return;

    setFollowError(null);
    setFollowLoading(true);

    if (isFollowingProfile) {
      const { error: unfollowError } = await supabase
        .from("follows")
        .delete()
        .eq("follower_id", sessionUserId)
        .eq("following_id", profile.id);

      if (unfollowError) {
        setFollowError(unfollowError.message || "Unable to unfollow right now.");
      } else {
        setIsFollowingProfile(false);
      }
      setFollowLoading(false);
      return;
    }

    const { error: followInsertError } = await supabase.from("follows").insert({
      follower_id: sessionUserId,
      following_id: profile.id,
    });

    if (followInsertError) {
      setFollowError(followInsertError.message || "Unable to follow right now.");
    } else {
      setIsFollowingProfile(true);
    }
    setFollowLoading(false);
  };

  if (loading) {
    return (
      <div className="rounded-lg border border-slate-200 bg-white p-6 text-slate-600">
        Loading profile...
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div className="rounded-lg border border-rose-200 bg-rose-50 p-6 text-rose-700">
        {error ?? "Profile not found."}
      </div>
    );
  }

  const displayName = profile.display_name ?? "Reader";
  const profilePath = `/profile/${profile.username ?? profile.id}`;

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-center gap-4">
          {profile.avatar_url ? (
            <img
              src={profile.avatar_url}
              alt=""
              className="h-16 w-16 rounded-full object-cover"
            />
          ) : (
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-slate-100 text-lg font-semibold text-slate-500">
              {displayName.slice(0, 1).toUpperCase()}
            </div>
          )}
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
              {displayName}
            </h1>
            <p className="text-sm text-slate-500">
              @{profile.username ?? "reader"} .{" "}
              {profile.created_at
                ? `Member since ${new Date(profile.created_at).toLocaleDateString()}`
                : "Member"}
            </p>
            <p className="mt-1 text-xs text-slate-500">Share: {profilePath}</p>
          </div>
          {sessionUserId && sessionUserId !== profile.id ? (
            <div className="ml-auto flex flex-col items-end gap-2">
              <button
                type="button"
                onClick={handleToggleFollowProfile}
                disabled={followLoading}
                className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
                  isFollowingProfile
                    ? "border border-slate-300 text-slate-700 hover:border-slate-400"
                    : "bg-slate-900 text-white hover:bg-slate-800"
                } disabled:cursor-not-allowed disabled:opacity-60`}
              >
                {followLoading
                  ? "Saving..."
                  : isFollowingProfile
                    ? "Following"
                    : "Follow"}
              </button>
              {followError ? (
                <span className="text-xs text-rose-600">{followError}</span>
              ) : null}
            </div>
          ) : null}
        </div>
        {profile.bio ? (
          <p className="mt-4 whitespace-pre-wrap text-sm text-slate-700">
            {profile.bio}
          </p>
        ) : (
          <p className="mt-4 text-sm text-slate-500">
            This reader hasn&apos;t added a bio yet.
          </p>
        )}
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Stories</p>
          <p className="mt-1 text-xl font-semibold text-slate-900">{stories.length}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Followers</p>
          <p className="mt-1 text-xl font-semibold text-slate-900">
            {followersCount}
          </p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Following</p>
          <p className="mt-1 text-xl font-semibold text-slate-900">{followingCount}</p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <section className="rounded-xl border border-slate-200 bg-white p-4">
          <h2 className="text-sm font-semibold text-slate-900">Followers</h2>
          {followers.length === 0 ? (
            <p className="mt-2 text-xs text-slate-500">No followers yet.</p>
          ) : (
            <ul className="mt-2 space-y-1">
              {followers.map((item) => (
                <li key={item.id}>
                  <Link
                    href={`/profile/${item.username ?? item.id}`}
                    className="text-sm text-slate-700 hover:underline"
                  >
                    {item.display_name ?? item.username ?? "Reader"}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
        <section className="rounded-xl border border-slate-200 bg-white p-4">
          <h2 className="text-sm font-semibold text-slate-900">Following</h2>
          {following.length === 0 ? (
            <p className="mt-2 text-xs text-slate-500">Not following anyone yet.</p>
          ) : (
            <ul className="mt-2 space-y-1">
              {following.map((item) => (
                <li key={item.id}>
                  <Link
                    href={`/profile/${item.username ?? item.id}`}
                    className="text-sm text-slate-700 hover:underline"
                  >
                    {item.display_name ?? item.username ?? "Reader"}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {sessionUserId === profile.id ? (
        <section className="rounded-xl border border-slate-200 bg-white p-4">
          <h2 className="text-sm font-semibold text-slate-900">Your Shelves</h2>
          {shelves.length === 0 ? (
            <p className="mt-2 text-xs text-slate-500">No shelves yet.</p>
          ) : (
            <ul className="mt-2 flex flex-wrap gap-2">
              {shelves.map((shelf) => (
                <li key={shelf.id}>
                  <Link
                    href={`/shelves/${shelf.id}`}
                    className="rounded-full border border-slate-300 px-3 py-1 text-xs font-semibold text-slate-700"
                  >
                    {shelf.name}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : null}

      <div className="space-y-3">
        <h2 className="text-lg font-semibold text-slate-900">Published Stories</h2>
        {stories.length === 0 ? (
          <div className="rounded-lg border border-dashed border-slate-200 bg-white p-6 text-sm text-slate-500">
            No published stories yet.
          </div>
        ) : (
          <div className="space-y-4">
            {stories.map((story) => (
              <StoryCard
                key={story.slug}
                {...story}
                synopsis={story.synopsis_1 ?? undefined}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
