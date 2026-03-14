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
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const today = new Date().toISOString().split("T")[0];

    // Find all users with overdue subscriptions that aren't already blocked
    const { data: overdue, error: overdueErr } = await supabaseAdmin
      .from("profiles")
      .select("id")
      .lt("subscription_due_date", today)
      .neq("subscription_status", "blocked")
      .not("subscription_due_date", "is", null);

    if (overdueErr) throw overdueErr;

    let blockedCount = 0;
    if (overdue && overdue.length > 0) {
      for (const p of overdue) {
        await supabaseAdmin
          .from("profiles")
          .update({ subscription_status: "blocked", active: false })
          .eq("id", p.id);
        blockedCount++;
      }
    }

    console.log(`Auto-block: ${blockedCount} users blocked`);

    return new Response(JSON.stringify({ success: true, blocked_count: blockedCount }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("auto-block-overdue error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
