import { supabase } from "./supabase/client";

type StoryMetric = {
  story_id: string;
  completion_rate: number;
  saves: number;
  follows: number;
  score?: number;
};

export const getTrendingStories = async () => {
  const { data, error } = await supabase
    .from("story_metrics")
    .select("story_id, completion_rate, saves, follows")
    .limit(200);

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? [])
    .map((item) => ({
      ...(item as StoryMetric),
      score: computeTrendingScore(
        Number((item as StoryMetric).completion_rate ?? 0),
        Number((item as StoryMetric).saves ?? 0),
        Number((item as StoryMetric).follows ?? 0)
      ),
    }))
    .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
    .slice(0, 20);
};

export const computeTrendingScore = (
  completionRate: number,
  saves: number,
  follows: number
) => completionRate * saves * follows;
