import { supabase } from "../../config/supabaseClient.js";

export const addUser = async (userData) => {
  if (!supabase) {
    throw new Error("Supabase is not configured. Please set SUPABASE_URL and SUPABASE_KEY environment variables.");
  }
  const { data, error } = await supabase.from("users").insert([userData]);

  if (error) throw error;
  return data;
};

export const getUsers = async () => {
  if (!supabase) {
    throw new Error("Supabase is not configured. Please set SUPABASE_URL and SUPABASE_KEY environment variables.");
  }
  const { data, error } = await supabase.from("users").select("*");

  if (error) throw error;
  return data;
};

export const getUserByEmail = async (email) => {
  if (!supabase) {
    throw new Error("Supabase is not configured. Please set SUPABASE_URL and SUPABASE_KEY environment variables.");
  }
  const { data, error } = await supabase
    .from("users")
    .select("*")
    .eq("email", email)
    .single();

  if (error) throw error;
  return data;
};

export const updateVerified = async (email) => {
  if (!supabase) {
    throw new Error("Supabase is not configured. Please set SUPABASE_URL and SUPABASE_KEY environment variables.");
  }
  const { data, error } = await supabase
    .from("users")
    .update({ email_Verification: "verified" })
    .eq("email", email)
    .select();

  if (error) throw error;
  return data;
};
