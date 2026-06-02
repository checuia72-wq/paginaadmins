import { isSupabaseConfigured, supabase } from "../lib/supabase";

const DEMO_SESSION_KEY = "forigua:demo_session";

export const login = async (email: string, password: string) => {
  if (!supabase) throw new Error("Supabase no está configurado");
  return await supabase.auth.signInWithPassword({
    email,
    password,
  });
};

export const logout = async () => {
  localStorage.removeItem(DEMO_SESSION_KEY);

  if (!isSupabaseConfigured || !supabase) {
    return { error: null };
  }

  try {
    return await supabase.auth.signOut();
  } catch {
    return { error: null };
  }
};

export const getSession = async () => {
  if (!supabase) throw new Error("Supabase no está configurado");
  return await supabase.auth.getSession();
};