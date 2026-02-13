"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase/client";

type SessionUser = {
  id: string;
  username?: string | null;
  email?: string | null;
};

export default function Header() {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    const loadUser = async () => {
      const { data } = await supabase.auth.getUser();
      if (!isMounted) return;
      if (data?.user) {
        const { data: profileData } = await supabase
          .from("profiles")
          .select("username")
          .eq("id", data.user.id)
          .maybeSingle();
        if (!isMounted) return;
        setUser({
          id: data.user.id,
          username: (profileData?.username as string | null | undefined) ?? null,
          email: data.user.email,
        });
      } else {
        setUser(null);
      }
      setLoading(false);
    };

    loadUser();

    const { data: authListener } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        if (!isMounted) return;
        if (session?.user) {
          setUser({ id: session.user.id, email: session.user.email, username: null });
        } else {
          setUser(null);
        }
      },
    );

    return () => {
      isMounted = false;
      authListener.subscription.unsubscribe();
    };
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  return (
    <header className="header">
      <div className="container">
        <div className="brand">StoryTime</div>
        <nav className="nav">
          <Link href="/feed">Feed</Link>
          <Link href="/following">Following</Link>
          <Link href="/algo">Algo</Link>
          <Link href="/suggestions">Suggestions</Link>
          <Link href="/hot">Hot</Link>
          <Link href="/featured">Featured</Link>
          <Link href="/authors">Authors</Link>
          <Link href="/shelves">Shelves</Link>
          <Link href="/public-domain">Public domain</Link>
          <Link href="/write">Write</Link>
          <Link href="/settings">Settings</Link>
          <Link href="/admin">Admin</Link>
          {loading ? (
            <span className="text-sm text-slate-500">Loading...</span>
          ) : user ? (
            <>
              <Link href="/profile/edit" className="text-sm text-slate-600">
                Edit profile
              </Link>
              <Link
                href={`/profile/${user.username ?? user.id}`}
                className="text-sm text-slate-600"
              >
                My profile
              </Link>
              <span className="text-sm text-slate-600">
                {user.email ?? "Signed in"}
              </span>
              <button
                onClick={handleLogout}
                className="rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-600 transition hover:border-slate-300"
                type="button"
              >
                Logout
              </button>
            </>
          ) : (
            <>
              <Link href="/login">Login</Link>
              <Link href="/signup">Signup</Link>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
