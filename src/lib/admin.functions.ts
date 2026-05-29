import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { normalizeBdPhone, defaultStudentPassword } from "./phone";

const CLASSES = ["5", "6", "7", "8", "9", "10", "11", "12"] as const;
const BATCHES = ["morning", "afternoon", "evening"] as const;
const DEPTS = ["none", "science", "business"] as const;

const studentSchema = z.object({
  full_name: z.string().trim().min(2).max(100),
  father_name: z.string().trim().max(100).optional().default(""),
  mother_name: z.string().trim().max(100).optional().default(""),
  father_occupation: z.string().trim().max(100).optional().default(""),
  school_name: z.string().trim().max(150).optional().default(""),
  phone: z.string().trim().min(11).max(20),
  guardian_phone: z.string().trim().max(20).optional().default(""),
  class_level: z.enum(CLASSES),
  batch: z.enum(BATCHES),
  department: z.enum(DEPTS).default("none"),
  address: z.string().trim().max(500).optional().default(""),
});

export const createStudentAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => studentSchema.parse(input))
  .handler(async ({ data, context }) => {
    // Verify caller is admin OR a teacher with admission permission
    const { data: roleRow, error: roleErr } = await context.supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId)
      .eq("role", "admin")
      .maybeSingle();
    if (roleErr) throw new Error(roleErr.message);
    if (!roleRow) {
      const { data: perm, error: permErr } = await (context.supabase as any)
        .from("teacher_permissions")
        .select("id")
        .eq("user_id", context.userId)
        .eq("feature", "admission")
        .maybeSingle();
      if (permErr) throw new Error(permErr.message);
      if (!perm) throw new Error("এই কাজের অনুমতি নেই");
    }

    const phoneE164 = normalizeBdPhone(data.phone);
    if (!phoneE164) throw new Error("সঠিক ফোন নম্বর দিন (১১ ডিজিটের, ০১... দিয়ে শুরু)");
    const syntheticEmail = `${phoneE164.replace(/\D/g, "")}@somikoron.local`;
    const autoPassword = defaultStudentPassword(phoneE164);

    // Create auth user with synthetic email + auto password (last 6 digits of phone)
    const { data: created, error: createErr } =
      await supabaseAdmin.auth.admin.createUser({
        email: syntheticEmail,
        password: autoPassword,
        email_confirm: true,
        user_metadata: { full_name: data.full_name, role: "student", phone: phoneE164 },
      });
    if (createErr || !created.user) {
      throw new Error(createErr?.message ?? "ব্যবহারকারী তৈরি ব্যর্থ");
    }
    const newUserId = created.user.id;

    // Insert student row using admin client (RLS bypass — we just verified admin manually)
    const { data: student, error: insErr } = await supabaseAdmin
      .from("students")
      .insert({
        user_id: newUserId,
        full_name: data.full_name,
        father_name: data.father_name || null,
        mother_name: data.mother_name || null,
        father_occupation: data.father_occupation || null,
        school_name: data.school_name || null,
        phone: phoneE164,
        guardian_phone: data.guardian_phone || null,
        class_level: data.class_level,
        batch: data.batch,
        department: data.class_level >= "9" ? data.department : "none",
        address: data.address || null,
      })
      .select("id, roll, class_level")
      .single();

    if (insErr) {
      // Rollback the auth user
      await supabaseAdmin.auth.admin.deleteUser(newUserId).catch(() => {});
      throw new Error(insErr.message);
    }

    return { id: student.id, roll: student.roll, class_level: student.class_level, phone: phoneE164, password: autoPassword };
  });

const adminSignupSchema = z.object({
  phone: z.string().trim().min(11).max(20),
  password: z.string().min(6).max(72),
  full_name: z.string().trim().min(2).max(100),
});

// First-admin bootstrap: creates a phone+password user and grants admin role.
// Only succeeds when NO admin exists yet.
export const bootstrapAdminAccount = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => adminSignupSchema.parse(input))
  .handler(async ({ data }) => {
    // Check no admin yet
    const { count, error: countErr } = await supabaseAdmin
      .from("user_roles")
      .select("*", { count: "exact", head: true })
      .eq("role", "admin");
    if (countErr) throw new Error(countErr.message);
    if ((count ?? 0) > 0) {
      throw new Error("ইতিমধ্যে এডমিন আছেন। কর্তৃপক্ষের সাথে যোগাযোগ করুন।");
    }

    const phoneE164 = normalizeBdPhone(data.phone);
    if (!phoneE164) throw new Error("সঠিক ফোন নম্বর দিন");
    const syntheticEmail = `${phoneE164.replace(/\D/g, "")}@somikoron.local`;

    const { data: created, error: createErr } =
      await supabaseAdmin.auth.admin.createUser({
        email: syntheticEmail,
        password: data.password,
        email_confirm: true,
        user_metadata: { full_name: data.full_name, role: "admin", phone: phoneE164 },
      });
    if (createErr || !created.user) {
      throw new Error(createErr?.message ?? "একাউন্ট তৈরি ব্যর্থ");
    }

    const { error: roleErr } = await supabaseAdmin
      .from("user_roles")
      .insert({ user_id: created.user.id, role: "admin" });
    if (roleErr) {
      await supabaseAdmin.auth.admin.deleteUser(created.user.id).catch(() => {});
      throw new Error(roleErr.message);
    }

    return { phone: phoneE164 };
  });

export const checkAdminExists = createServerFn({ method: "GET" }).handler(
  async () => {
    const { count, error } = await supabaseAdmin
      .from("user_roles")
      .select("*", { count: "exact", head: true })
      .eq("role", "admin");
    if (error) throw new Error(error.message);
    return { exists: (count ?? 0) > 0 };
  },
);
