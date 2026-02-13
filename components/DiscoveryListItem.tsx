import Link from "next/link";
import { DiscoveryItem } from "../lib/discovery-feed";

type DiscoveryListItemProps = {
  item: DiscoveryItem;
};

const lengthLabelMap: Record<DiscoveryItem["length_class"], string> = {
  flash: "Flash",
  short: "Short",
  storytime: "Storytime",
};

export default function DiscoveryListItem({ item }: DiscoveryListItemProps) {
  return (
    <article className="book-surface flex items-start gap-3 rounded-2xl p-3">
      <Link href={`/story/${item.slug}`} className="block">
        {item.cover_url ? (
          <img
            src={item.cover_url}
            alt=""
            className="h-24 w-20 rounded-lg object-cover"
          />
        ) : (
          <div className="flex h-24 w-20 items-center justify-center rounded-lg bg-amber-50 text-[10px] font-semibold text-amber-700">
            Story
          </div>
        )}
      </Link>
      <div className="min-w-0 flex-1">
        <Link href={`/story/${item.slug}`} className="no-underline hover:no-underline">
          <h3 className="truncate text-base font-semibold text-slate-900">
            {item.title}
          </h3>
        </Link>
        <p className="line-clamp-2 text-xs text-slate-600">{item.synopsis}</p>
        <div className="mt-1 flex flex-wrap gap-2 text-[11px] text-slate-500">
          <span>{item.author_name}</span>
          <span>{item.genre}</span>
          <span>{lengthLabelMap[item.length_class]}</span>
          <span>{item.reading_time}m</span>
          <span>{item.views} views</span>
          <span>{item.likes} likes</span>
          <span>{item.completions} completes</span>
        </div>
      </div>
    </article>
  );
}
