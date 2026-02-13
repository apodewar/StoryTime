import { supabase } from "./supabase/client";

export type StoryRow = {
  id: string;
  title: string;
  slug: string;
  synopsis_1?: string | null;
  body: string;
  length_class: "flash" | "short" | "storytime";
  reading_time: number;
  genre: string;
  tags?: string | null;
  cover_url?: string | null;
  cover_image_url?: string | null;
  author_id: string | null;
  original_author?: string | null;
  is_public_domain?: boolean | null;
  published_at?: string | null;
};

type ProfileRow = {
  id: string;
  display_name: string | null;
};

type MetricWindowOptions = {
  sinceDays?: number;
};

type MetricRows = {
  storyEvents: Array<{ story_id: string; event_type: string; created_at: string }>;
  reactions: Array<{ story_id: string; value: string; created_at: string }>;
  storyLikes: Array<{ story_id: string; created_at: string }>;
  shelfItems: Array<{ story_id: string; created_at: string }>;
  completions: Array<{ story_id: string; created_at: string }>;
};

type DiscoveryMode = "newest" | "algo";

type DiscoveryOptions = {
  limit?: number;
  query?: string;
  mode?: DiscoveryMode;
  onlyPublicDomain?: boolean;
  sinceDays?: number;
};

export type StoryMetrics = {
  views: number;
  impressions: number;
  opens: number;
  likes: number;
  dislikes: number;
  saves: number;
  completions: number;
  completionRate: number;
  likeRatio: number;
  sampleSize: number;
};

export type DiscoveryItem = StoryRow & {
  author_name: string;
  synopsis: string;
  views: number;
  likes: number;
  dislikes: number;
  saves: number;
  completions: number;
  completion_rate: number;
  like_ratio: number;
  score: number;
};

const LENGTH_POOLS: StoryRow["length_class"][] = ["flash", "short", "storytime"];

const firstSentence = (story: StoryRow) => {
  const preferred = story.synopsis_1?.trim();
  if (preferred) return preferred;
  const clean = story.body.replace(/\s+/g, " ").trim();
  if (!clean) return "No synopsis available.";
  const sentence = clean.match(/[^.!?]+[.!?]/)?.[0] ?? clean;
  return sentence.length > 140 ? `${sentence.slice(0, 137)}...` : sentence;
};

export const isWithinDays = (isoDate: string | null | undefined, days: number) => {
  if (!isoDate) return false;
  const value = new Date(isoDate).getTime();
  if (Number.isNaN(value)) return false;
  return value >= Date.now() - days * 24 * 60 * 60 * 1000;
};

const buildMetricsMap = (storyIds: string[], rows: MetricRows): Record<string, StoryMetrics> => {
  const metrics = Object.fromEntries(
    storyIds.map((storyId) => [
      storyId,
      {
        views: 0,
        impressions: 0,
        opens: 0,
        likes: 0,
        dislikes: 0,
        saves: 0,
        completions: 0,
        completionRate: 0,
        likeRatio: 0,
        sampleSize: 0,
      },
    ]),
  ) as Record<string, StoryMetrics>;

  const eventCounts = {} as Record<string, { impression: number; open: number; complete: number }>;
  for (const row of rows.storyEvents) {
    if (!eventCounts[row.story_id]) {
      eventCounts[row.story_id] = { impression: 0, open: 0, complete: 0 };
    }
    if (row.event_type === "impression") eventCounts[row.story_id].impression += 1;
    if (row.event_type === "open") eventCounts[row.story_id].open += 1;
    if (row.event_type === "complete") eventCounts[row.story_id].complete += 1;
  }

  const reactionCounts = {} as Record<string, { likes: number; dislikes: number }>;
  for (const row of rows.reactions) {
    if (!reactionCounts[row.story_id]) {
      reactionCounts[row.story_id] = { likes: 0, dislikes: 0 };
    }
    if (row.value === "like") reactionCounts[row.story_id].likes += 1;
    if (row.value === "dislike") reactionCounts[row.story_id].dislikes += 1;
  }

  const legacyLikes = rows.storyLikes.reduce(
    (acc, row) => {
      acc[row.story_id] = (acc[row.story_id] ?? 0) + 1;
      return acc;
    },
    {} as Record<string, number>,
  );

  const saves = rows.shelfItems.reduce(
    (acc, row) => {
      acc[row.story_id] = (acc[row.story_id] ?? 0) + 1;
      return acc;
    },
    {} as Record<string, number>,
  );

  const legacyCompletions = rows.completions.reduce(
    (acc, row) => {
      acc[row.story_id] = (acc[row.story_id] ?? 0) + 1;
      return acc;
    },
    {} as Record<string, number>,
  );

  for (const storyId of storyIds) {
    const event = eventCounts[storyId] ?? { impression: 0, open: 0, complete: 0 };
    const reaction = reactionCounts[storyId] ?? { likes: 0, dislikes: 0 };
    const likes = reaction.likes > 0 ? reaction.likes : legacyLikes[storyId] ?? 0;
    const completions = Math.max(event.complete, legacyCompletions[storyId] ?? 0);
    const views = event.open;
    const denominator = Math.max(views, 1);
    const likesAndDislikes = likes + reaction.dislikes;

    metrics[storyId] = {
      views,
      impressions: event.impression,
      opens: event.open,
      likes,
      dislikes: reaction.dislikes,
      saves: saves[storyId] ?? 0,
      completions,
      completionRate: completions / denominator,
      likeRatio: likesAndDislikes > 0 ? likes / likesAndDislikes : 0,
      sampleSize: denominator,
    };
  }

  return metrics;
};

export async function fetchStoryMetrics(
  storyIds: string[],
  options: MetricWindowOptions = {},
): Promise<Record<string, StoryMetrics>> {
  if (storyIds.length === 0) return {};

  const sinceIso =
    typeof options.sinceDays === "number"
      ? new Date(Date.now() - options.sinceDays * 24 * 60 * 60 * 1000).toISOString()
      : null;

  const withSince = <T extends { gte: (col: string, value: string) => T }>(
    query: T,
  ) => (sinceIso ? query.gte("created_at", sinceIso) : query);

  const [storyEventsResult, reactionsResult, storyLikesResult, shelfItemsResult, completionsResult] =
    await Promise.all([
      withSince(
        supabase
          .from("story_events")
          .select("story_id, event_type, created_at")
          .in("story_id", storyIds),
      ),
      withSince(
        supabase.from("reactions").select("story_id, value, created_at").in("story_id", storyIds),
      ),
      withSince(
        supabase.from("story_likes").select("story_id, created_at").in("story_id", storyIds),
      ),
      withSince(
        supabase.from("shelf_items").select("story_id, created_at").in("story_id", storyIds),
      ),
      withSince(
        supabase.from("completions").select("story_id, created_at").in("story_id", storyIds),
      ),
    ]);

  const storyEvents =
    ((storyEventsResult.data ?? []) as Array<{ story_id: string; event_type: string; created_at: string }>) ?? [];
  const reactions =
    ((reactionsResult.data ?? []) as Array<{ story_id: string; value: string; created_at: string }>) ?? [];
  const storyLikes =
    ((storyLikesResult.data ?? []) as Array<{ story_id: string; created_at: string }>) ?? [];
  const shelfItems =
    ((shelfItemsResult.data ?? []) as Array<{ story_id: string; created_at: string }>) ?? [];
  const completions =
    ((completionsResult.data ?? []) as Array<{ story_id: string; created_at: string }>) ?? [];

  return buildMetricsMap(storyIds, {
    storyEvents,
    reactions,
    storyLikes,
    shelfItems,
    completions,
  });
}

const computeAlgoScore = (story: StoryRow, metrics: StoryMetrics) => {
  const freshnessBoost = isWithinDays(story.published_at, 3)
    ? 12
    : isWithinDays(story.published_at, 14)
      ? 7
      : isWithinDays(story.published_at, 30)
        ? 3
        : 0;

  return (
    metrics.completionRate * 100 +
    metrics.saves * 1.8 +
    metrics.likes * 1.2 -
    metrics.dislikes * 0.8 +
    freshnessBoost
  );
};

const sortAlgoPools = (items: DiscoveryItem[]) => {
  const pools = Object.fromEntries(
    LENGTH_POOLS.map((length) => [
      length,
      items
        .filter((item) => item.length_class === length)
        .sort((a, b) => b.score - a.score),
    ]),
  ) as Record<StoryRow["length_class"], DiscoveryItem[]>;

  const ranked: DiscoveryItem[] = [];
  let keepGoing = true;

  while (keepGoing) {
    keepGoing = false;
    for (const length of LENGTH_POOLS) {
      const next = pools[length].shift();
      if (next) {
        ranked.push(next);
        keepGoing = true;
      }
    }
  }

  return ranked;
};

const mapWithAuthorAndMetrics = async (
  stories: StoryRow[],
  options: MetricWindowOptions = {},
): Promise<DiscoveryItem[]> => {
  if (stories.length === 0) return [];

  const storyIds = stories.map((story) => story.id);
  const authorIds = Array.from(
    new Set(stories.map((story) => story.author_id).filter(Boolean)),
  ) as string[];

  const [profilesResult, metricsByStory] = await Promise.all([
    authorIds.length > 0
      ? supabase.from("profiles").select("id, display_name").in("id", authorIds)
      : Promise.resolve({ data: [] as ProfileRow[] }),
    fetchStoryMetrics(storyIds, options),
  ]);

  const profileMap = Object.fromEntries(
    ((profilesResult.data ?? []) as ProfileRow[]).map((profile) => [
      profile.id,
      profile.display_name ?? "Unknown author",
    ]),
  );

  return stories.map((story) => {
    const metrics = metricsByStory[story.id] ?? {
      views: 0,
      impressions: 0,
      opens: 0,
      likes: 0,
      dislikes: 0,
      saves: 0,
      completions: 0,
      completionRate: 0,
      likeRatio: 0,
      sampleSize: 0,
    };

    const author_name = story.is_public_domain
      ? story.original_author ?? "Unknown author"
      : story.author_id
        ? profileMap[story.author_id] ?? "Unknown author"
        : "Unknown author";

    return {
      ...story,
      author_name,
      synopsis: firstSentence(story),
      views: metrics.views,
      likes: metrics.likes,
      dislikes: metrics.dislikes,
      saves: metrics.saves,
      completions: metrics.completions,
      completion_rate: metrics.completionRate,
      like_ratio: metrics.likeRatio,
      score: computeAlgoScore(story, metrics),
    };
  });
};

export async function fetchDiscoveryItems(options: DiscoveryOptions = {}): Promise<DiscoveryItem[]> {
  const {
    limit = 180,
    query,
    mode = "newest",
    onlyPublicDomain = false,
    sinceDays,
  } = options;

  let storiesQuery = supabase
    .from("stories")
    .select(
      "id, title, slug, synopsis_1, body, length_class, reading_time, genre, tags, cover_url, cover_image_url, author_id, original_author, is_public_domain, published_at",
    )
    .eq("status", "published")
    .order("published_at", { ascending: false })
    .limit(limit);

  if (onlyPublicDomain) {
    storiesQuery = storiesQuery.eq("is_public_domain", true);
  }

  if (query?.trim()) {
    const clean = query.trim().replace(/[%_]/g, "");
    storiesQuery = storiesQuery.or(
      `title.ilike.%${clean}%,synopsis_1.ilike.%${clean}%,genre.ilike.%${clean}%`,
    );
  }

  const { data, error } = await storiesQuery;

  if (error) {
    throw new Error(error.message || "Unable to load stories.");
  }

  const stories = (data ?? []) as StoryRow[];
  const enriched = await mapWithAuthorAndMetrics(stories, { sinceDays });

  if (mode === "algo") {
    return sortAlgoPools(enriched);
  }

  return enriched;
}

export async function fetchDiscoveryItemsByStoryIds(
  storyIds: string[],
  options: { sinceDays?: number } = {},
): Promise<DiscoveryItem[]> {
  if (storyIds.length === 0) return [];

  const uniqueIds = Array.from(new Set(storyIds));

  const { data, error } = await supabase
    .from("stories")
    .select(
      "id, title, slug, synopsis_1, body, length_class, reading_time, genre, tags, cover_url, cover_image_url, author_id, original_author, is_public_domain, published_at",
    )
    .eq("status", "published")
    .in("id", uniqueIds);

  if (error) {
    throw new Error(error.message || "Unable to load selected stories.");
  }

  const stories = (data ?? []) as StoryRow[];
  const mapped = await mapWithAuthorAndMetrics(stories, { sinceDays: options.sinceDays });
  const byId = Object.fromEntries(mapped.map((item) => [item.id, item]));

  return uniqueIds.map((id) => byId[id]).filter(Boolean);
}
