import { supabase } from "../../config/supabaseClient.js";

export const addUser = async (userData) => {
  const { data, error } = await supabase.from("users").insert([userData]);

  if (error) throw error;
  return data;
};

export const getUsers = async () => {
  const { data, error } = await supabase.from("users").select("*");

  if (error) throw error;
  return data;
};

export const getUserByEmail = async (email) => {
  const { data, error } = await supabase
    .from("users")
    .select("*")
    .eq("email", email)
    .single();

  if (error) throw error;
  return data;
};

export const updateVerified = async (email) => {
  const { data, error } = await supabase
    .from("users")
    .update({ email_Verification: "verified" })
    .eq("email", email)
    .select();

  if (error) throw error;
  return data;
};
