import { isSupabaseConfigured, supabase } from "../lib/supabase";

const DEMO_SESSION_KEY = "forigua:demo_session";

export const login = async (email: string, password: string) => {
  return await supabase.auth.signInWithPassword({
    email,
    password,
  });
};

export const logout = async () => {
  localStorage.removeItem(DEMO_SESSION_KEY);

  if (!isSupabaseConfigured) {
    return { error: null };
  }

  try {
    return await supabase.auth.signOut();
  } catch {
    return { error: null };
  }
};

export const getSession = async () => {
  return await supabase.auth.getSession();
};
