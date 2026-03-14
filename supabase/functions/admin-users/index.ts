import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);

    const supabaseUser = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await supabaseUser.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) return json({ error: "Unauthorized" }, 401);

    const callerId = claimsData.claims.sub;

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: roleData } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", callerId)
      .eq("role", "admin")
      .maybeSingle();

    if (!roleData) return json({ error: "Forbidden: admin only" }, 403);

    const { action, ...params } = await req.json();

    // LIST USERS
    if (action === "list") {
      const { data: profiles, error: profilesErr } = await supabaseAdmin
        .from("profiles")
        .select("id, full_name, created_at, active, subscription_due_date, subscription_status");
      if (profilesErr) throw profilesErr;

      const { data: roles, error: rolesErr } = await supabaseAdmin
        .from("user_roles")
        .select("user_id, role");
      if (rolesErr) throw rolesErr;

      const { data: authUsers, error: authErr } = await supabaseAdmin.auth.admin.listUsers();
      if (authErr) throw authErr;

      const emailMap = new Map(authUsers.users.map((u: any) => [u.id, u.email]));
      const roleMap = new Map(roles.map((r: any) => [r.user_id, r.role]));

      const users = profiles!.map((p: any) => ({
        id: p.id,
        email: emailMap.get(p.id) || "—",
        full_name: p.full_name || "",
        role: roleMap.get(p.id) || "user",
        created_at: p.created_at,
        active: p.active,
        subscription_due_date: p.subscription_due_date,
        subscription_status: p.subscription_status || "active",
      }));

      return json({ users });
    }

    // CREATE USER
    if (action === "create") {
      const { email, password, full_name, role } = params;
      if (!email || !password) return json({ error: "Email e senha obrigatórios" }, 400);

      const { data: newUser, error: createErr } = await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { full_name },
      });
      if (createErr) throw createErr;

      await supabaseAdmin
        .from("profiles")
        .upsert({ id: newUser.user.id, full_name, active: true });

      if (role === "admin") {
        await supabaseAdmin
          .from("user_roles")
          .update({ role: "admin" })
          .eq("user_id", newUser.user.id);
      }

      return json({ success: true, userId: newUser.user.id });
    }

    // UPDATE ROLE
    if (action === "update_role") {
      const { user_id, role } = params;
      if (!user_id || !role) return json({ error: "user_id e role obrigatórios" }, 400);

      const { error } = await supabaseAdmin
        .from("user_roles")
        .update({ role })
        .eq("user_id", user_id);
      if (error) throw error;

      return json({ success: true });
    }

    // TOGGLE ACTIVE
    if (action === "toggle_active") {
      const { user_id, active } = params;
      const { error } = await supabaseAdmin
        .from("profiles")
        .update({ active })
        .eq("id", user_id);
      if (error) throw error;

      return json({ success: true });
    }

    // UPDATE SUBSCRIPTION
    if (action === "update_subscription") {
      const { user_id, subscription_due_date, subscription_status } = params;
      if (!user_id) return json({ error: "user_id obrigatório" }, 400);

      const updates: Record<string, unknown> = {};
      if (subscription_due_date !== undefined) updates.subscription_due_date = subscription_due_date;
      if (subscription_status !== undefined) updates.subscription_status = subscription_status;

      const { error } = await supabaseAdmin
        .from("profiles")
        .update(updates)
        .eq("id", user_id);
      if (error) throw error;

      // If blocking, also set active = false
      if (subscription_status === "blocked") {
        await supabaseAdmin.from("profiles").update({ active: false }).eq("id", user_id);
      }

      return json({ success: true });
    }

    // AUTO-BLOCK OVERDUE USERS (called by cron)
    if (action === "auto_block_overdue") {
      const today = new Date().toISOString().split("T")[0];

      const { data: overdue, error: overdueErr } = await supabaseAdmin
        .from("profiles")
        .select("id")
        .lt("subscription_due_date", today)
        .neq("subscription_status", "blocked")
        .not("subscription_due_date", "is", null);

      if (overdueErr) throw overdueErr;

      if (overdue && overdue.length > 0) {
        for (const p of overdue) {
          await supabaseAdmin
            .from("profiles")
            .update({ subscription_status: "blocked", active: false })
            .eq("id", p.id);
        }
      }

      return json({ success: true, blocked_count: overdue?.length || 0 });
    }

    // DELETE USER
    if (action === "delete") {
      const { user_id } = params;
      if (!user_id) return json({ error: "user_id obrigatório" }, 400);
      if (user_id === callerId) return json({ error: "Você não pode excluir a si mesmo" }, 400);

      const { error } = await supabaseAdmin.auth.admin.deleteUser(user_id);
      if (error) throw error;

      return json({ success: true });
    }

    return json({ error: "Ação inválida" }, 400);
  } catch (err: any) {
    console.error("admin-users error:", err);
    return json({ error: err.message || "Internal error" }, 500);
  }
});
