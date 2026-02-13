export const STORY_LENGTH_TIERS = ["flash", "short", "storytime"] as const;
export type StoryLengthClass = (typeof STORY_LENGTH_TIERS)[number];

export const STORY_GENRES = [
  "Fantasy",
  "Sci-Fi",
  "Romance",
  "Mystery",
  "Horror",
  "Slice of Life",
  "Adventure",
  "Magical Realism",
  "Thriller",
  "Historical",
] as const;
export type StoryGenre = (typeof STORY_GENRES)[number];

export type StoryRecord = {
  id: string;
  title: string;
  slug: string;
  synopsis_1?: string | null;
  body: string;
  length_class: StoryLengthClass;
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
