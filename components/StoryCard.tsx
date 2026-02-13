import Link from "next/link";

type StoryCardProps = {
  id?: string;
  title: string;
  slug: string;
  length_class: "flash" | "short" | "storytime";
  reading_time: number;
  genre: string;
  tags?: string | null;
  synopsis?: string;
  cover_url?: string | null;
  author_name?: string | null;
  author_label?: "By" | "Original author";
  origin_label?: string | null;
  likes?: number;
  views?: number;
  showActions?: boolean;
  onSave?: () => void;
  onDismiss?: () => void;
  onSnooze?: () => void;
  onOpen?: () => void;
  onReport?: () => void;
  shelfOptions?: Array<{ id: string; name: string }>;
  selectedShelfId?: string;
  onShelfChange?: (shelfId: string) => void;
};

const lengthLabelMap: Record<StoryCardProps["length_class"], string> = {
  flash: "Flash",
  short: "Short",
  storytime: "Storytime",
};

export default function StoryCard({
  title,
  slug,
  length_class,
  reading_time,
  genre,
  tags,
  synopsis,
  cover_url,
  author_name,
  author_label = "By",
  origin_label,
  likes = 0,
  views = 0,
  showActions = false,
  onSave,
  onDismiss,
  onSnooze,
  onOpen,
  onReport,
  shelfOptions = [],
  selectedShelfId,
  onShelfChange,
}: StoryCardProps) {
  const tagList = tags
    ? tags
        .split(",")
        .map((tag) => tag.trim())
        .filter(Boolean)
    : [];

  return (
    <article className="book-surface overflow-hidden rounded-2xl p-3">
      <div className="flex items-start gap-3">
        <Link href={`/story/${slug}`} className="block shrink-0">
          {cover_url ? (
            <img
              src={cover_url}
              alt=""
              className="h-24 w-20 rounded-lg object-cover"
              loading="lazy"
            />
          ) : (
            <div className="flex h-24 w-20 items-center justify-center rounded-lg bg-amber-50 text-[10px] font-semibold text-amber-700">
              Story
            </div>
          )}
        </Link>

        <div className="min-w-0 flex-1 space-y-1">
          <Link href={`/story/${slug}`} className="no-underline hover:no-underline">
            <h2 className="truncate text-base font-semibold tracking-tight text-slate-900">
              {title}
            </h2>
          </Link>
          {author_name ? (
            <p className="truncate text-xs text-slate-500">
              {author_label} {author_name}
            </p>
          ) : null}
          <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-500">
            <span className="rounded-full bg-amber-50 px-2 py-0.5 font-semibold text-amber-800">
              {genre}
            </span>
            <span>{lengthLabelMap[length_class]}</span>
            <span>{reading_time} min</span>
            <span>{likes} likes</span>
            <span>{views} views</span>
            {origin_label ? (
              <span className="rounded-full border border-slate-200 px-2 py-0.5">
                {origin_label}
              </span>
            ) : null}
          </div>
          {synopsis ? (
            <p className="line-clamp-1 text-xs text-slate-600">{synopsis}</p>
          ) : null}
          {tagList.length > 0 ? (
            <div className="flex flex-wrap gap-1">
              {tagList.slice(0, 3).map((tag) => (
                <span
                  key={tag}
                  className="rounded-full border border-amber-200 px-2 py-0.5 text-[10px] font-medium text-amber-700"
                >
                  #{tag}
                </span>
              ))}
            </div>
          ) : null}
        </div>
      </div>

      {showActions ? (
        <div className="mt-3 space-y-2">
          {shelfOptions.length > 0 ? (
            <select
              value={selectedShelfId ?? ""}
              onChange={(event) => onShelfChange?.(event.target.value)}
              className="h-8 w-full rounded-lg border border-slate-300 bg-white px-2 text-[11px] font-semibold text-slate-700"
            >
              {shelfOptions.map((shelf) => (
                <option key={shelf.id} value={shelf.id}>
                  {shelf.name}
                </option>
              ))}
            </select>
          ) : null}
          <div className="grid grid-cols-5 gap-2">
          <button
            type="button"
            onClick={onSave}
            className="rounded-lg border border-emerald-300 bg-emerald-50 px-2 py-1.5 text-[11px] font-semibold text-emerald-700"
          >
            Save
          </button>
          <button
            type="button"
            onClick={onDismiss}
            className="rounded-lg border border-rose-300 bg-rose-50 px-2 py-1.5 text-[11px] font-semibold text-rose-700"
          >
            Not interested
          </button>
          <button
            type="button"
            onClick={onSnooze}
            className="rounded-lg border border-amber-300 bg-amber-50 px-2 py-1.5 text-[11px] font-semibold text-amber-700"
          >
            Not today
          </button>
          <button
            type="button"
            onClick={onOpen}
            className="rounded-lg bg-slate-900 px-2 py-1.5 text-[11px] font-semibold text-white"
          >
            Open
          </button>
          <button
            type="button"
            onClick={onReport}
            className="rounded-lg border border-rose-300 bg-white px-2 py-1.5 text-[11px] font-semibold text-rose-700"
          >
            Report
          </button>
          </div>
        </div>
      ) : null}
    </article>
  );
}
