import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const supabaseAnonKey =
  process.env.SUPABASE_ANON_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

const createSupabase = (token?: string) =>
  createClient(supabaseUrl, supabaseAnonKey, {
    auth: { persistSession: false },
    global: token ? { headers: { Authorization: `Bearer ${token}` } } : {},
  });

const parseToken = (request: Request) => {
  const authHeader = request.headers.get("authorization") ?? "";
  if (!authHeader.startsWith("Bearer ")) return null;
  return authHeader.slice("Bearer ".length);
};

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const storyId = (body.storyId ?? body.story_id) as string | undefined;
    const reason = (body.reason as string | undefined)?.trim() ?? null;

    if (!storyId) {
      return NextResponse.json({ error: "storyId is required." }, { status: 400 });
    }

    const token = parseToken(request);
    if (!token) {
      return NextResponse.json({ error: "Sign in required to report." }, { status: 401 });
    }

    const supabase = createSupabase(token);
    const { data: userData } = await supabase.auth.getUser(token);
    const userId = userData.user?.id;

    if (!userId) {
      return NextResponse.json({ error: "Invalid session." }, { status: 401 });
    }

    const { error } = await supabase.from("reports").insert({
      story_id: storyId,
      reporter_id: userId,
      reason,
    });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }
}

