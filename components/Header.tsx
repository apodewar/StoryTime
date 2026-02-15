"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { supabase } from "../lib/supabase/client";

type SessionUser = {
  id: string;
  username?: string | null;
  email?: string | null;
};

export default function Header() {
  const pathname = usePathname();
  const [user, setUser] = useState<SessionUser | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const isWelcomeRoute =
    pathname === "/" || pathname === "/login" || pathname === "/signup";

  useEffect(() => {
    let isMounted = true;

    const loadUser = async () => {
      const { data } = await supabase.auth.getUser();
      if (!isMounted) return;
      if (data?.user) {
        const [{ data: profileData }, { data: adminData }] = await Promise.all([
          supabase.from("profiles").select("username").eq("id", data.user.id).maybeSingle(),
          supabase.from("admin_users").select("user_id").eq("user_id", data.user.id).maybeSingle(),
        ]);
        if (!isMounted) return;
        setUser({
          id: data.user.id,
          username: (profileData?.username as string | null | undefined) ?? null,
          email: data.user.email,
        });
        setIsAdmin(!!adminData?.user_id);
      } else {
        setUser(null);
        setIsAdmin(false);
      }
      setLoading(false);
    };

    loadUser();

    const { data: authListener } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        if (!isMounted) return;
        if (session?.user) {
          setUser({ id: session.user.id, email: session.user.email, username: null });
          void supabase
            .from("admin_users")
            .select("user_id")
            .eq("user_id", session.user.id)
            .maybeSingle()
            .then(({ data: adminData }) => {
              if (!isMounted) return;
              setIsAdmin(!!adminData?.user_id);
            });
        } else {
          setUser(null);
          setIsAdmin(false);
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
        <Link href="/" className="brand no-underline hover:no-underline">
          StoryTime
        </Link>
        <nav className="nav">
          {isWelcomeRoute ? (
            <>
              <Link href="/algo">Continue as guest</Link>
              <Link href="/login">Log in</Link>
              <Link href="/signup">Sign up</Link>
            </>
          ) : (
            <>
              <Link href={user ? `/profile/${user.username ?? user.id}` : "/login"}>
                Profile
              </Link>
              <Link href="/personal-feed">Personal Feed</Link>
              <Link href="/algo">StoryTime Algorithm</Link>
              <Link href="/suggestions">Suggestions</Link>
              <Link href="/hot">Hot</Link>
              <Link href="/featured">Featured Page</Link>
              <Link href="/authors">Authors</Link>
              <Link href="/shelves">Shelves</Link>
              <Link href="/write">Write</Link>
              <Link href="/settings">Settings</Link>
              {isAdmin ? <Link href="/admin">Admin</Link> : null}
              {loading ? (
                <span className="text-sm text-slate-500">Loading...</span>
              ) : user ? (
                <>
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
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
