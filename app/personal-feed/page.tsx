import { Suspense } from "react";
import UnifiedFeedPage from "../../components/UnifiedFeedPage";

export default function PersonalFeedPage() {
  return (
    <Suspense
      fallback={
        <div className="rounded-2xl border border-slate-200 bg-white p-5 text-slate-600">
          Loading personal feed...
        </div>
      }
    >
      <UnifiedFeedPage routeBase="/personal-feed" />
    </Suspense>
  );
}
