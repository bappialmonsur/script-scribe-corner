import type { User } from "@supabase/supabase-js";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type TeacherFeature = "attendance" | "results" | "newsfeed" | "admission";

export interface MyAccess {
  isAdmin: boolean;
  isTeacher: boolean;
  permissions: TeacherFeature[];
}

export function useMyAccess(user: User | null | undefined) {
  return useQuery<MyAccess>({
    queryKey: ["my-access", user?.id],
    enabled: !!user,
    queryFn: async () => {
      if (!user) return { isAdmin: false, isTeacher: false, permissions: [] };

      const { data: roles, error: rErr } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id);
      if (rErr) throw new Error(rErr.message);

      const roleSet = new Set((roles ?? []).map((r) => r.role as string));
      const isAdmin = roleSet.has("admin");
      const isTeacher = roleSet.has("teacher");

      let permissions: TeacherFeature[] = [];
      if (isTeacher) {
        const { data: perms, error: pErr } = await (supabase as any)
          .from("teacher_permissions")
          .select("feature")
          .eq("user_id", user.id);
        if (pErr) throw new Error(pErr.message);
        permissions = (perms ?? []).map((p: any) => p.feature as TeacherFeature);
      }

      return { isAdmin, isTeacher, permissions };
    },
  });
}
