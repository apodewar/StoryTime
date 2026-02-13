import type { Metadata } from "next";
import { createServerSupabaseClient } from "../../../lib/supabase/server";
import StoryPageClient from "./StoryPageClient";

type StoryMetaRow = {
  title: string;
  synopsis_1?: string | null;
  body?: string | null;
  cover_url?: string | null;
  cover_image_url?: string | null;
};

type StoryPageProps = {
  params: { slug: string };
};

const fallbackDescription = "Short fiction you can finish.";

export async function generateMetadata({ params }: StoryPageProps): Promise<Metadata> {
  const supabase = createServerSupabaseClient();
  const { data } = await supabase
    .from("stories")
    .select("title, synopsis_1, body, cover_url, cover_image_url")
    .eq("slug", params.slug)
    .eq("status", "published")
    .maybeSingle();

  const story = (data ?? null) as StoryMetaRow | null;
  if (!story) {
    return {
      title: "Story not found | StoryTime",
      description: fallbackDescription,
    };
  }

  const description =
    story.synopsis_1?.trim() ||
    story.body?.replace(/\s+/g, " ").trim().slice(0, 160) ||
    fallbackDescription;
  const image = story.cover_url ?? story.cover_image_url ?? undefined;

  return {
    title: `${story.title} | StoryTime`,
    description,
    openGraph: {
      title: story.title,
      description,
      type: "article",
      images: image ? [{ url: image, alt: story.title }] : undefined,
    },
    twitter: {
      card: image ? "summary_large_image" : "summary",
      title: story.title,
      description,
      images: image ? [image] : undefined,
    },
  };
}

export default function StoryPage({ params }: StoryPageProps) {
  return <StoryPageClient slug={params.slug} />;
}

