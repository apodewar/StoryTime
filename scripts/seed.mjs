import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";

dotenv.config({ path: ".env.local" });

const supabaseUrl = process.env.SUPABASE_URL ?? "";
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

if (!supabaseUrl || !supabaseServiceRoleKey) {
  throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.");
}

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

const sampleBodies = {
  flash: [
    "A single room, a single rule: never open the last door. Tonight, I forgot why.",
    "She wrote her wish on a paper boat and watched the river decide.",
    "The clock skipped a minute, and with it, his last regret.",
    "Every candle in town went out when she whispered his name.",
    "The train arrived early, but only for those with unfinished stories.",
  ],
  short: [
    "On the morning the city woke without gravity, Lina found her brother anchored to a promise.",
    "The cafe served memories in porcelain cups, and I kept ordering your laugh.",
    "A fox with a silver ear guided her through the blizzard, asking for a story in return.",
    "He carried a notebook of strangers' dreams and delivered them before sunrise.",
    "The lighthouse keeper could hear ships that never existed until she learned their names.",
  ],
  storytime: [
    "In the village where words were taxed, Mara smuggled poems beneath her coat.",
    "A violin carved from stormwood played only during eclipses, and only for those who had lied.",
    "The river reversed itself every decade, bringing back what it had taken—and what it had not.",
    "When the mountain spoke, it asked for a single story to keep the snows warm.",
    "He built a house from postcards and lived inside other people's goodbyes.",
  ],
};

const genres = [
  "Fantasy",
  "Sci-Fi",
  "Romance",
  "Mystery",
  "Horror",
  "Slice of Life",
  "Adventure",
  "Magical Realism",
];

const lengthClasses = ["flash", "short", "storytime"];
const storyCount = 20;

const slugify = (value) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "");

const buildStories = () => {
  const stories = [];

  for (let i = 0; i < storyCount; i += 1) {
    const lengthClass = lengthClasses[i % lengthClasses.length];
    const bodyPool = sampleBodies[lengthClass];
    const body = bodyPool[i % bodyPool.length];
    const genre = genres[i % genres.length];
    const readingTime = lengthClass === "flash" ? 3 : lengthClass === "short" ? 5 : 12;
    const title = `${genre} Story ${i + 1}`;
    const slug = `${slugify(title)}-${i + 1}`;

    stories.push({
      title,
      slug,
      body,
      length_class: lengthClass,
      reading_time: readingTime,
      genre,
      published_at: new Date().toISOString(),
      status: "published",
    });
  }

  return stories;
};

const run = async () => {
  const stories = buildStories();

  const { data, error } = await supabase
    .from("stories")
    .insert(stories)
    .select("id, title, slug");

  if (error) {
    console.error("Seed failed:", error.message);
    process.exit(1);
  }

  console.log(`Seeded ${data?.length ?? 0} stories.`);
  if (data) {
    data.slice(0, 5).forEach((story) => {
      console.log(`- ${story.title} (${story.slug})`);
    });
  }
};

run().catch((err) => {
  console.error("Seed error:", err);
  process.exit(1);
});
