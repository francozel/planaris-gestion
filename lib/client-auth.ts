"use client";

import { supabase } from "@/lib/supabase";

export async function getAccessToken() {
  const { data } = await supabase.auth.getSession();

  if (data.session?.access_token) {
    return data.session.access_token;
  }

  const refreshed = await supabase.auth.refreshSession();

  return refreshed.data.session?.access_token || null;
}
