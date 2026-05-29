import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { normalizeBdPhone } from "./phone";

const FEATURES = ["attendance", "results", "newsfeed", "admission"] as const;

const signupSchema = z.object({
  phone: z.string().trim().min(11).max(20),
  password: z.string().min(6).max(72),
  full_name: z.string().trim().min(2).max(100),
});

// Public: teacher self-signup. Creates a phone+password account and grants the teacher role.
// No feature permissions are granted until an admin assigns them.
export const teacherSignup = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => signupSchema.parse(input))
  .handler(async ({ data }) => {
    const phoneE164 = normalizeBdPhone(data.phone);
    if (!phoneE164) throw new Error("সঠিক ফোন নম্বর দিন (১১ ডিজিটের, ০১... দিয়ে শুরু)");
    const syntheticEmail = `${phoneE164.replace(/\D/g, "")}@somikoron.local`;

    const { data: created, error: createErr } =
      await supabaseAdmin.auth.admin.createUser({
        email: syntheticEmail,
        password: data.password,
        email_confirm: true,
        user_metadata: { full_name: data.full_name, role: "teacher", phone: phoneE164 },
      });
    if (createErr || !created.user) {
      throw new Error(createErr?.message ?? "একাউন্ট তৈরি ব্যর্থ");
    }

    const { error: roleErr } = await (supabaseAdmin as any)
      .from("user_roles")
      .insert({ user_id: created.user.id, role: "teacher" });
    if (roleErr) {
      await supabaseAdmin.auth.admin.deleteUser(created.user.id).catch(() => {});
      throw new Error(roleErr.message);
    }

    return { phone: phoneE164 };
  });

async function assertAdmin(ctx: { supabase: any; userId: string }) {
  const { data, error } = await ctx.supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", ctx.userId)
    .eq("role", "admin")
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("শুধুমাত্র এডমিন এই কাজ করতে পারবেন");
}

// Admin: list all teachers with their names, phone and granted permissions.
export const listTeachers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);

    const { data: roleRows, error: rErr } = await (supabaseAdmin as any)
      .from("user_roles")
      .select("user_id")
      .eq("role", "teacher");
    if (rErr) throw new Error(rErr.message);

    const ids: string[] = (roleRows ?? []).map((r: any) => r.user_id);
    if (ids.length === 0) return { teachers: [] as any[] };

    const [{ data: profs }, { data: perms }, usersRes] = await Promise.all([
      supabaseAdmin.from("profiles").select("id, full_name").in("id", ids),
      (supabaseAdmin as any).from("teacher_permissions").select("user_id, feature").in("user_id", ids),
      supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1000 }),
    ]);

    const nameMap = new Map((profs ?? []).map((p: any) => [p.id, p.full_name]));
    const phoneMap = new Map<string, string>();
    for (const u of usersRes.data?.users ?? []) {
      if (ids.includes(u.id)) {
        const meta: any = u.user_metadata ?? {};
        phoneMap.set(u.id, meta.phone ?? (u.email ?? "").replace(/@.*/, ""));
      }
    }
    const permMap = new Map<string, string[]>();
    for (const p of (perms ?? []) as any[]) {
      const list = permMap.get(p.user_id) ?? [];
      list.push(p.feature);
      permMap.set(p.user_id, list);
    }

    const teachers = ids.map((id) => ({
      user_id: id,
      full_name: (nameMap.get(id) as string) || "নামহীন শিক্ষক",
      phone: phoneMap.get(id) ?? "",
      permissions: permMap.get(id) ?? [],
    }));

    return { teachers };
  });

const setPermSchema = z.object({
  user_id: z.string().uuid(),
  feature: z.enum(FEATURES),
  enabled: z.boolean(),
});

// Admin: grant or revoke a single feature permission for a teacher.
export const setTeacherPermission = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => setPermSchema.parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);

    if (data.enabled) {
      const { error } = await (supabaseAdmin as any)
        .from("teacher_permissions")
        .upsert({ user_id: data.user_id, feature: data.feature }, { onConflict: "user_id,feature" });
      if (error) throw new Error(error.message);
    } else {
      const { error } = await (supabaseAdmin as any)
        .from("teacher_permissions")
        .delete()
        .eq("user_id", data.user_id)
        .eq("feature", data.feature);
      if (error) throw new Error(error.message);
    }

    return { ok: true };
  });
