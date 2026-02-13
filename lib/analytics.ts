import { supabase } from "./supabase/client";

type EventPayload = {
  event_type: "story_open" | "story_completion" | "follow" | "save";
  story_id?: string | null;
  author_id?: string | null;
};

const insertEvent = async (payload: EventPayload) => {
  const { error } = await supabase.from("events").insert(payload);
  if (error) {
    throw new Error(error.message);
  }
};

export const logStoryOpen = async (story_id: string) => {
  await insertEvent({ event_type: "story_open", story_id });
};

export const logStoryCompletion = async (story_id: string) => {
  await insertEvent({ event_type: "story_completion", story_id });
};

export const logFollow = async (author_id: string) => {
  await insertEvent({ event_type: "follow", author_id });
};

export const logSave = async (story_id: string) => {
  await insertEvent({ event_type: "save", story_id });
};
