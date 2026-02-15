import Link from "next/link";

export default function HomePage() {
  return (
    <div className="mx-auto flex min-h-[75vh] w-full max-w-4xl items-center">
      <section className="grid w-full gap-8 md:grid-cols-2 md:gap-10">
        <div className="space-y-5">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">
            StoryTime
          </p>
          <h1 className="text-4xl font-semibold tracking-tight text-slate-900 md:text-5xl">
            Welcome to StoryTime.
          </h1>
          <p className="text-base text-slate-600 md:text-lg">
            Discover short fiction you can finish in minutes, track what you
            love, and keep your next read ready.
          </p>
        </div>

        <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">
            Join the community
          </h2>
          <p className="text-sm text-slate-600">
            Create an account or log in to personalize your reading feed.
          </p>

          <div className="space-y-3 pt-2">
            <Link
              href="/signup"
              className="block w-full rounded-lg bg-slate-900 px-4 py-2.5 text-center text-sm font-semibold text-white transition hover:bg-slate-800"
            >
              Sign up
            </Link>
            <Link
              href="/login"
              className="block w-full rounded-lg border border-slate-300 px-4 py-2.5 text-center text-sm font-semibold text-slate-700 transition hover:border-slate-400"
            >
              Log in
            </Link>
          </div>

          <p className="pt-2 text-center text-sm text-slate-600">
            <Link href="/algo" className="font-medium text-slate-900 underline">
              Continue as guest
            </Link>
          </p>
        </div>
      </section>
    </div>
  );
}
