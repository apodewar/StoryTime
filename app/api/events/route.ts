import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const supabaseAnonKey =
  process.env.SUPABASE_ANON_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: { persistSession: false },
});

const isValidEventType = (value: string): value is "impression" | "open" | "complete" =>
  value === "impression" || value === "open" || value === "complete";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const storyId: string | undefined = body.story_id ?? body.storyId;
    const eventType: string | undefined = body.event_type ?? body.eventType;
    const anonSessionId: string | undefined =
      body.anon_session_id ?? body.anonSessionId;

    if (!storyId || !eventType) {
      return NextResponse.json(
        { error: "storyId and eventType are required." },
        { status: 400 },
      );
    }

    if (!isValidEventType(eventType)) {
      return NextResponse.json(
        { error: "eventType must be one of impression/open/complete." },
        { status: 400 },
      );
    }

    if (!anonSessionId) {
      return NextResponse.json(
        { error: "anonSessionId is required for event tracking." },
        { status: 400 },
      );
    }

    const { error } = await supabase.from("story_events").insert({
      story_id: storyId,
      event_type: eventType,
      anon_session_id: anonSessionId,
      metadata: {},
    });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }
}
