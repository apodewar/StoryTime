import { redirect } from "next/navigation";

type FeedPageProps = {
  searchParams?: Record<string, string | string[] | undefined>;
};

export default function FeedPage({ searchParams }: FeedPageProps) {
  const params = new URLSearchParams();

  for (const [key, rawValue] of Object.entries(searchParams ?? {})) {
    if (typeof rawValue === "undefined") continue;
    if (Array.isArray(rawValue)) {
      for (const value of rawValue) {
        params.append(key, value);
      }
      continue;
    }
    params.set(key, rawValue);
  }

  const query = params.toString();
  redirect(query ? `/personal-feed?${query}` : "/personal-feed");
}
