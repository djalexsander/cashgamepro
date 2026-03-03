import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify caller is admin
    const supabaseUser = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await supabaseUser.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const callerId = claimsData.claims.sub;

    // Use service role to check admin and perform admin operations
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

    if (!roleData) {
      return new Response(JSON.stringify({ error: "Forbidden: admin only" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { action, ...params } = await req.json();

    // LIST USERS
    if (action === "list") {
      const { data: profiles, error: profilesErr } = await supabaseAdmin
        .from("profiles")
        .select("id, full_name, created_at, active");

      if (profilesErr) throw profilesErr;

      const { data: roles, error: rolesErr } = await supabaseAdmin
        .from("user_roles")
        .select("user_id, role");

      if (rolesErr) throw rolesErr;

      // Get emails from auth
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
      }));

      return new Response(JSON.stringify({ users }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // CREATE USER
    if (action === "create") {
      const { email, password, full_name, role } = params;
      if (!email || !password) {
        return new Response(JSON.stringify({ error: "Email e senha obrigatórios" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: newUser, error: createErr } = await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { full_name },
      });

      if (createErr) throw createErr;

      // Update profile
      await supabaseAdmin
        .from("profiles")
        .upsert({ id: newUser.user.id, full_name, active: true });

      // Set role if admin
      if (role === "admin") {
        await supabaseAdmin
          .from("user_roles")
          .update({ role: "admin" })
          .eq("user_id", newUser.user.id);
      }

      return new Response(JSON.stringify({ success: true, userId: newUser.user.id }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // UPDATE ROLE
    if (action === "update_role") {
      const { user_id, role } = params;
      if (!user_id || !role) {
        return new Response(JSON.stringify({ error: "user_id e role obrigatórios" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { error } = await supabaseAdmin
        .from("user_roles")
        .update({ role })
        .eq("user_id", user_id);

      if (error) throw error;

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // TOGGLE ACTIVE
    if (action === "toggle_active") {
      const { user_id, active } = params;

      const { error } = await supabaseAdmin
        .from("profiles")
        .update({ active })
        .eq("id", user_id);

      if (error) throw error;

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Ação inválida" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("admin-users error:", err);
    return new Response(JSON.stringify({ error: err.message || "Internal error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
