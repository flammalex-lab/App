import { createClient } from "@/lib/supabase/server";
import type { Profile } from "@/lib/supabase/types";

export interface Session {
  userId: string;
  profile: Profile;
}

export async function getSession(): Promise<Session | null> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();
  if (!profile) return null;
  return { userId: user.id, profile: profile as Profile };
}

export async function requireAdmin(): Promise<Session> {
  const s = await getSession();
  if (!s) throw new Error("unauthorized");
  if (s.profile.role !== "admin") throw new Error("admin only");
  return s;
}
