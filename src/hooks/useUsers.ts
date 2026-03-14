import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

export interface AppUser {
  id: string;
  email: string;
  full_name: string;
  role: "admin" | "user";
  created_at: string;
  active: boolean;
  subscription_due_date: string | null;
  subscription_status: "active" | "pending" | "blocked";
}

const invoke = async (body: Record<string, unknown>) => {
  const { data, error } = await supabase.functions.invoke("admin-users", { body });
  if (error) throw error;
  if (data?.error) throw new Error(data.error);
  return data;
};

export const useUsers = () => {
  const [users, setUsers] = useState<AppUser[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const data = await invoke({ action: "list" });
      setUsers(data.users ?? []);
    } catch (err: any) {
      toast({ title: "Erro ao buscar usuários", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, []);

  const createUser = async (email: string, password: string, full_name: string, role: string) => {
    const data = await invoke({ action: "create", email, password, full_name, role });
    await fetchUsers();
    return data;
  };

  const updateRole = async (user_id: string, role: string) => {
    await invoke({ action: "update_role", user_id, role });
    await fetchUsers();
  };

  const toggleActive = async (user_id: string, active: boolean) => {
    await invoke({ action: "toggle_active", user_id, active });
    await fetchUsers();
  };

  const updateSubscription = async (user_id: string, subscription_due_date: string | null, subscription_status: string) => {
    await invoke({ action: "update_subscription", user_id, subscription_due_date, subscription_status });
    await fetchUsers();
  };

  const deleteUser = async (user_id: string) => {
    await invoke({ action: "delete", user_id });
    await fetchUsers();
  };

  return { users, loading, fetchUsers, createUser, updateRole, toggleActive, updateSubscription, deleteUser };
};
