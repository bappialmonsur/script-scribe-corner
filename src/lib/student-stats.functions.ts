import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

// For each given exam, return the top scorer (name + marks).
// Caller must be a student in those exams' class (or admin).
export const getExamToppers = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ examIds: z.array(z.string().uuid()).min(1).max(200) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { userId } = context;

    const { data: isAdmin } = await supabaseAdmin
      .from("user_roles").select("role").eq("user_id", userId).eq("role", "admin").maybeSingle();

    let allowedClass: string | null = null;
    if (!isAdmin) {
      const { data: student } = await supabaseAdmin
        .from("students").select("class_level, is_active").eq("user_id", userId).maybeSingle();
      if (!student || !student.is_active) throw new Error("অ্যাক্সেস নেই");
      allowedClass = student.class_level;
    }

    const { data: exams } = await supabaseAdmin
      .from("exams").select("id, class_level").in("id", data.examIds);
    const examMap = new Map((exams ?? []).map((e) => [e.id, e.class_level]));
    const validIds = data.examIds.filter((id) => {
      const cl = examMap.get(id);
      if (!cl) return false;
      if (allowedClass && cl !== allowedClass) return false;
      return true;
    });
    if (validIds.length === 0) return {};

    const { data: results } = await supabaseAdmin
      .from("exam_results").select("exam_id, student_id, marks").in("exam_id", validIds);

    const top = new Map<string, { student_id: string; marks: number }>();
    for (const r of results ?? []) {
      const m = Number(r.marks);
      const cur = top.get(r.exam_id);
      if (!cur || m > cur.marks) top.set(r.exam_id, { student_id: r.student_id, marks: m });
    }

    const studentIds = Array.from(new Set(Array.from(top.values()).map((t) => t.student_id)));
    const { data: students } = studentIds.length
      ? await supabaseAdmin.from("students").select("id, full_name, roll").in("id", studentIds)
      : { data: [] as any[] };
    const sMap = new Map((students ?? []).map((s) => [s.id, s]));

    const out: Record<string, { name: string; roll: string | null; marks: number }> = {};
    for (const [examId, t] of top.entries()) {
      const s = sMap.get(t.student_id);
      out[examId] = {
        name: s?.full_name ?? "—",
        roll: s?.roll ?? null,
        marks: t.marks,
      };
    }
    return out;
  });

// Compute caller's class-wide position based on total marks across all results.
export const getMyClassPosition = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { userId } = context;
    const { data: me } = await supabaseAdmin
      .from("students").select("id, class_level, is_active").eq("user_id", userId).maybeSingle();
    if (!me || !me.is_active) return null;

    const { data: classmates } = await supabaseAdmin
      .from("students").select("id").eq("class_level", me.class_level).eq("is_active", true);
    const ids = (classmates ?? []).map((s) => s.id);
    if (ids.length === 0) return null;

    const { data: results } = await supabaseAdmin
      .from("exam_results").select("student_id, marks, exam_id").in("student_id", ids);

    const totals = new Map<string, number>();
    for (const r of results ?? []) {
      totals.set(r.student_id, (totals.get(r.student_id) ?? 0) + Number(r.marks));
    }

    const myTotal = totals.get(me.id) ?? 0;

    // Compute total full marks across exams the caller took
    const myExamIds = (results ?? []).filter((r) => r.student_id === me.id).map((r) => r.exam_id);
    let myFullTotal = 0;
    if (myExamIds.length) {
      const { data: exams } = await supabaseAdmin
        .from("exams").select("id, full_marks").in("id", myExamIds);
      myFullTotal = (exams ?? []).reduce((s, e) => s + Number(e.full_marks), 0);
    }

    if (myTotal === 0 && !totals.has(me.id)) {
      return { position: null, classSize: ids.length, myTotal: 0, myFullTotal: 0 };
    }

    const scored = ids.map((id) => totals.get(id) ?? 0).sort((a, b) => b - a);
    const better = scored.filter((m) => m > myTotal).length;
    const position = better + 1;

    return {
      position,
      classSize: ids.length,
      myTotal,
      myFullTotal,
      scoredCount: scored.filter((m) => m > 0).length,
    };
  });

export type MeritEntry = {
  student_id: string;
  name: string;
  roll: string | null;
  photoUrl: string | null;
  total: number;
  fullTotal: number;
  position: number;
};

export type MonthlyMerit = {
  top: MeritEntry[];
  me: { position: number | null; classSize: number; total: number; fullTotal: number } | null;
  monthLabel: string;
};

// Class merit list (top 5) + caller's own position, scoped to the current month
// (exams from the 1st of the month). Ranked by total obtained marks.
export const getMonthlyClassMerit = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<MonthlyMerit> => {
    const { userId } = context;

    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
      .toISOString().slice(0, 10);
    const monthLabel = now.toLocaleDateString("bn-BD", { month: "long", year: "numeric" });
    const empty: MonthlyMerit = { top: [], me: null, monthLabel };

    const { data: me } = await supabaseAdmin
      .from("students").select("id, class_level, is_active").eq("user_id", userId).maybeSingle();
    if (!me || !me.is_active) return empty;
    const classLevel = me.class_level;

    const { data: exams } = await supabaseAdmin
      .from("exams").select("id, full_marks")
      .eq("class_level", classLevel).gte("exam_date", monthStart);
    const examIds = (exams ?? []).map((e) => e.id);
    const fullMap = new Map((exams ?? []).map((e) => [e.id, Number(e.full_marks)]));

    const { data: students } = await supabaseAdmin
      .from("students").select("id, full_name, roll, photo_path")
      .eq("class_level", classLevel).eq("is_active", true);
    const sMap = new Map((students ?? []).map((s) => [s.id, s]));

    const totals = new Map<string, number>();
    const fullTotals = new Map<string, number>();

    if (examIds.length) {
      const { data: results } = await supabaseAdmin
        .from("exam_results").select("student_id, exam_id, marks").in("exam_id", examIds);
      for (const r of results ?? []) {
        if (!sMap.has(r.student_id) || r.marks == null) continue;
        totals.set(r.student_id, (totals.get(r.student_id) ?? 0) + Number(r.marks));
        fullTotals.set(r.student_id, (fullTotals.get(r.student_id) ?? 0) + (fullMap.get(r.exam_id) ?? 0));
      }
    }

    const ranked = Array.from(totals.entries())
      .map(([sid, total]) => ({ sid, total }))
      .sort((a, b) => b.total - a.total);
    const posMap = new Map<string, number>();
    ranked.forEach((r, i) => posMap.set(r.sid, i + 1));

    const top: MeritEntry[] = [];
    for (const r of ranked.slice(0, 5)) {
      const s = sMap.get(r.sid);
      let photoUrl: string | null = null;
      if (s?.photo_path) {
        const { data: signed } = await supabaseAdmin.storage
          .from("student-photos").createSignedUrl(s.photo_path, 60 * 60);
        photoUrl = signed?.signedUrl ?? null;
      }
      top.push({
        student_id: r.sid,
        name: s?.full_name ?? "—",
        roll: s?.roll ?? null,
        photoUrl,
        total: r.total,
        fullTotal: fullTotals.get(r.sid) ?? 0,
        position: posMap.get(r.sid)!,
      });
    }

    return {
      top,
      me: {
        position: posMap.get(me.id) ?? null,
        classSize: ranked.length,
        total: totals.get(me.id) ?? 0,
        fullTotal: fullTotals.get(me.id) ?? 0,
      },
      monthLabel,
    };
  });
