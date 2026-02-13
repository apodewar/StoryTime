import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

type ActionType = "save" | "dismiss" | "snooze" | "open";

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

const isActionType = (value: string): value is ActionType =>
  value === "save" || value === "dismiss" || value === "snooze" || value === "open";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const action = body.action as string;
    const storyId = (body.storyId ?? body.story_id) as string | undefined;
    const anonSessionId = (body.anonSessionId ?? body.anon_session_id) as
      | string
      | undefined;
    const shelfId = (body.shelfId ?? body.shelf_id) as string | undefined;
    const shelfName = (body.shelfName ?? body.shelf_name) as string | undefined;
    const snoozeUntil = (body.snoozeUntil ?? body.snooze_until) as
      | string
      | undefined;

    if (!storyId || !action || !isActionType(action)) {
      return NextResponse.json({ error: "Invalid action payload." }, { status: 400 });
    }

    const token = parseToken(request);
    const supabase = createSupabase(token ?? undefined);

    let userId: string | null = null;
    if (token) {
      const { data } = await supabase.auth.getUser(token);
      userId = data.user?.id ?? null;
    }

    if (action === "open") {
      const { error } = await supabase.from("story_events").insert({
        user_id: userId,
        anon_session_id: userId ? null : anonSessionId ?? null,
        story_id: storyId,
        event_type: "open",
        metadata: {},
      });
      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
      return NextResponse.json({ ok: true });
    }

    if (action === "save") {
      if (!userId) {
        return NextResponse.json(
          { error: "Sign in required to save to shelf." },
          { status: 401 },
        );
      }

      let targetShelfId = shelfId;
      if (!targetShelfId) {
        const name = shelfName?.trim() || "Read Later";
        const { data: existingShelf } = await supabase
          .from("shelves")
          .select("id")
          .eq("user_id", userId)
          .eq("name", name)
          .maybeSingle();

        targetShelfId = existingShelf?.id as string | undefined;
        if (!targetShelfId) {
          const { data: createdShelf, error: createShelfError } = await supabase
            .from("shelves")
            .insert({ user_id: userId, name })
            .select("id")
            .single();
          if (createShelfError || !createdShelf?.id) {
            return NextResponse.json(
              { error: createShelfError?.message ?? "Unable to create shelf." },
              { status: 500 },
            );
          }
          targetShelfId = createdShelf.id as string;
        }
      }

      const { error: itemError } = await supabase.from("shelf_items").upsert(
        {
          shelf_id: targetShelfId,
          story_id: storyId,
        },
        { onConflict: "shelf_id,story_id" },
      );

      if (itemError) {
        return NextResponse.json({ error: itemError.message }, { status: 500 });
      }

      return NextResponse.json({ ok: true });
    }

    const visibilityFilter = userId
      ? { user_id: userId, anon_session_id: null }
      : { user_id: null, anon_session_id: anonSessionId ?? null };

    if (!userId && !visibilityFilter.anon_session_id) {
      return NextResponse.json(
        { error: "anonSessionId is required for this action." },
        { status: 400 },
      );
    }

    const visibilityQuery = supabase
      .from("story_visibility")
      .select("id")
      .eq("story_id", storyId);

    const { data: existingVisibility } = userId
      ? await visibilityQuery.eq("user_id", userId).maybeSingle()
      : await visibilityQuery.eq("anon_session_id", anonSessionId ?? "").maybeSingle();

    const nextValues =
      action === "dismiss"
        ? { dismissed: true, snooze_until: null }
        : { dismissed: false, snooze_until: snoozeUntil ?? null };

    if (existingVisibility?.id) {
      const { error: updateError } = await supabase
        .from("story_visibility")
        .update(nextValues)
        .eq("id", existingVisibility.id);
      if (updateError) {
        return NextResponse.json({ error: updateError.message }, { status: 500 });
      }
      return NextResponse.json({ ok: true });
    }

    const { error: insertError } = await supabase.from("story_visibility").insert({
      ...visibilityFilter,
      story_id: storyId,
      ...nextValues,
    });

    if (insertError) {
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }
}
