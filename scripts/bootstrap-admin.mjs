import { createClient } from "@supabase/supabase-js";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const DEFAULT_ADMIN_EMAIL = "alexsander.xaviervieira@gmail.com";
const DEFAULT_ADMIN_PASSWORD = "30141516";
const DEFAULT_ADMIN_NAME = "Alexsander Xavier Vieira";

function loadEnvFile(fileName) {
  const envPath = resolve(process.cwd(), fileName);
  if (!existsSync(envPath)) return;

  const lines = readFileSync(envPath, "utf8").split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) continue;

    const index = trimmed.indexOf("=");
    const key = trimmed.slice(0, index).trim();
    const rawValue = trimmed.slice(index + 1).trim();
    const value = rawValue.replace(/^["']|["']$/g, "");

    if (!(key in process.env)) {
      process.env[key] = value;
    }
  }
}

function loadDotEnv() {
  loadEnvFile(".env");
  loadEnvFile(".env.local");
}

async function findUserByEmail(supabaseAdmin, email) {
  const target = email.toLowerCase();
  let page = 1;
  const perPage = 1000;

  while (true) {
    const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage });
    if (error) throw error;

    const user = data.users.find((item) => item.email?.toLowerCase() === target);
    if (user) return user;
    if (data.users.length < perPage) return null;
    page += 1;
  }
}

async function main() {
  loadDotEnv();

  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const email = process.env.ADMIN_EMAIL || DEFAULT_ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD || DEFAULT_ADMIN_PASSWORD;
  const fullName = process.env.ADMIN_FULL_NAME || DEFAULT_ADMIN_NAME;

  if (!supabaseUrl) {
    throw new Error("SUPABASE_URL or VITE_SUPABASE_URL is required.");
  }
  if (!serviceRoleKey) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY is required. Copy it from Supabase Project Settings > API.");
  }

  const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  const existingUser = await findUserByEmail(supabaseAdmin, email);
  let user = existingUser;

  if (!user) {
    const { data, error } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: fullName },
    });
    if (error) throw error;
    user = data.user;
    console.log(`Created auth user: ${email}`);
  } else {
    const { data, error } = await supabaseAdmin.auth.admin.updateUserById(user.id, {
      email,
      password,
      email_confirm: true,
      user_metadata: {
        ...(user.user_metadata ?? {}),
        full_name: fullName,
      },
    });
    if (error) throw error;
    user = data.user;
    console.log(`Updated auth user password/confirmation: ${email}`);
  }

  if (!user?.id) {
    throw new Error("Supabase did not return an auth user id.");
  }

  const { error: profileError } = await supabaseAdmin
    .from("profiles")
    .upsert(
      {
        id: user.id,
        full_name: fullName,
        active: true,
        subscription_status: "active",
      },
      { onConflict: "id" },
    );
  if (profileError) throw profileError;

  const { error: deleteRolesError } = await supabaseAdmin
    .from("user_roles")
    .delete()
    .eq("user_id", user.id)
    .neq("role", "admin");
  if (deleteRolesError) throw deleteRolesError;

  const { error: roleError } = await supabaseAdmin
    .from("user_roles")
    .upsert(
      {
        user_id: user.id,
        role: "admin",
      },
      { onConflict: "user_id,role" },
    );
  if (roleError) throw roleError;

  console.log("Bootstrap complete.");
  console.log(`Admin email: ${email}`);
  console.log(`Admin user id: ${user.id}`);
}

main().catch((error) => {
  console.error("Bootstrap failed:");
  console.error(error);
  process.exitCode = 1;
});
