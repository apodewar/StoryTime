"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabase/client";

export default function ProfileRedirectPage() {
  const router = useRouter();
  const [message, setMessage] = useState("Loading your profile...");
  const redirectedRef = useRef(false);

  useEffect(() => {
    let isMounted = true;

    const goToProfile = async (userId: string) => {
      if (redirectedRef.current || !isMounted) return;

      const { data: profileRow } = await supabase
        .from("profiles")
        .select("username")
        .eq("id", userId)
        .maybeSingle();

      redirectedRef.current = true;
      const username = (profileRow?.username as string | null | undefined) ?? null;
      router.replace(`/profile/${username ?? userId}`);
    };

    const bootstrap = async () => {
      const { data } = await supabase.auth.getSession();
      const userId = data.session?.user?.id ?? null;

      if (userId) {
        await goToProfile(userId);
        return;
      }

      if (isMounted) {
        setMessage("Please sign in to view your profile.");
      }
    };

    const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_IN" && session?.user?.id) {
        void goToProfile(session.user.id);
      }
    });

    void bootstrap();

    return () => {
      isMounted = false;
      authListener.subscription.unsubscribe();
    };
  }, [router]);

  return (
    <div className="mx-auto max-w-md p-6">
      <div className="rounded-2xl border border-slate-200 bg-white p-5 text-sm text-slate-700">
        <p>{message}</p>
        <Link href="/login" className="mt-3 inline-block text-slate-900 underline">
          Go to login
        </Link>
      </div>
    </div>
  );
}
