import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

interface AuthContextType {
  session: Session | null;
  user: User | null;
  fullName: string | null;
  isAdmin: boolean;
  isLoading: boolean;
  isInactive: boolean;
  isSubscriptionBlocked: boolean;
  subscriptionStatus: string | null;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signUp: (email: string, password: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isInactive, setIsInactive] = useState(false);
  const [isSubscriptionBlocked, setIsSubscriptionBlocked] = useState(false);
  const [subscriptionStatus, setSubscriptionStatus] = useState<string | null>(null);

  const checkAdminAndActive = async (userId: string) => {
    try {
      const { data: roleData, error: roleErr } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", userId)
        .eq("role", "admin")
        .maybeSingle();
      if (roleErr) console.error("Error checking admin role:", roleErr);
      setIsAdmin(!!roleData);

      const { data: profile, error: profileErr } = await supabase
        .from("profiles")
        .select("active, subscription_status")
        .eq("id", userId)
        .maybeSingle();
      if (profileErr) console.error("Error checking profile:", profileErr);

      if (profile) {
        setSubscriptionStatus(profile.subscription_status);

        if (profile.active === false) {
          setIsInactive(true);
          // Check if it's subscription blocked specifically
          if (profile.subscription_status === "blocked") {
            setIsSubscriptionBlocked(true);
          }
          await supabase.auth.signOut();
          return;
        }

        // Even if active, warn about pending status
        if (profile.subscription_status === "blocked") {
          setIsSubscriptionBlocked(true);
          setIsInactive(true);
          await supabase.auth.signOut();
          return;
        }
      }

      setIsInactive(false);
      setIsSubscriptionBlocked(false);
    } catch {
      setIsAdmin(false);
    }
  };

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        if (session?.user) {
          setTimeout(() => checkAdminAndActive(session.user.id), 0);
        } else {
          setIsAdmin(false);
          setIsInactive(false);
        }
        setIsLoading(false);
      }
    );

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        checkAdminAndActive(session.user.id);
      }
      setIsLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error: error ? new Error(error.message) : null };
  };

  const signUp = async (email: string, password: string) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: window.location.origin },
    });
    return { error: error ? new Error(error.message) : null };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setIsAdmin(false);
  };

  return (
    <AuthContext.Provider value={{ session, user, isAdmin, isLoading, isInactive, isSubscriptionBlocked, subscriptionStatus, signIn, signUp, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
};

export const useAdmin = () => {
  const { isAdmin } = useAuth();
  return isAdmin;
};
