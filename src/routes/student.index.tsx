import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useSession } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import {
  Bell, CalendarCheck, GraduationCap, BarChart3, FileText, Loader2, TrendingUp, Trophy,
} from "lucide-react";
import { bnClass, bnNum, calcGrade } from "@/lib/grading";
import { getMyClassPosition } from "@/lib/student-stats.functions";
import { FeatureCards } from "@/components/feature-cards";

export const Route = createFileRoute("/student/")({
  component: StudentDashboard,
});

function StudentDashboard() {
  const { user } = useSession();
  const fetchPosition = useServerFn(getMyClassPosition);
  const { data: pos } = useQuery({
    queryKey: ["my-class-position", user?.id],
    enabled: !!user,
    queryFn: () => fetchPosition(),
  });

  const { data, isLoading } = useQuery({
    queryKey: ["student-dashboard", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data: s } = await supabase
        .from("students").select("id, full_name, class_level").eq("user_id", user!.id).maybeSingle();
      if (!s) return null;

      const today = new Date().toISOString().slice(0, 10);
      const monthStart = new Date();
      monthStart.setDate(1);
      const monthStartStr = monthStart.toISOString().slice(0, 10);

      const [noticesQ, attendanceQ, monthAttQ, examsQ, resultsQ, pdfsQ, coursesQ] = await Promise.all([
        supabase.from("notices").select("id, title, created_at, class_level").eq("is_active", true)
          .or(`class_level.is.null,class_level.eq.${s.class_level}`)
          .order("created_at", { ascending: false }).limit(3),
        supabase.from("attendance").select("status, reason").eq("student_id", s.id).eq("date", today).maybeSingle(),
        supabase.from("attendance").select("status").eq("student_id", s.id).gte("date", monthStartStr),
        supabase.from("exams").select("id, subject, title, full_marks, exam_date, pattern, exam_type")
          .eq("class_level", s.class_level).order("exam_date", { ascending: false }).limit(20),
        supabase.from("exam_results").select("exam_id, marks").eq("student_id", s.id),
        supabase.from("pdf_notes").select("id").eq("is_active", true).eq("class_level", s.class_level),
        supabase.from("courses").select("*").eq("is_active", true)
          .or(`class_level.is.null,class_level.eq.${s.class_level}`)
          .order("sort_order"),
      ]);

      const marksMap = new Map(resultsQ.data?.map((r) => [r.exam_id, Number(r.marks)]) ?? []);
      const latestExamWithResult = (examsQ.data ?? []).find((e) => marksMap.has(e.id));
      const presentCount = (monthAttQ.data ?? []).filter((a) => a.status === "present").length;
      const totalCount = (monthAttQ.data ?? []).length;

      return {
        student: s,
        notices: noticesQ.data ?? [],
        today: attendanceQ.data,
        monthPct: totalCount ? Math.round((presentCount / totalCount) * 100) : null,
        monthPresent: presentCount,
        monthTotal: totalCount,
        latestResult: latestExamWithResult
          ? { exam: latestExamWithResult, marks: marksMap.get(latestExamWithResult.id)! }
          : null,
        examsCount: examsQ.data?.length ?? 0,
        resultsCount: marksMap.size,
        pdfCount: pdfsQ.data?.length ?? 0,
        courses: coursesQ.data ?? [],
      };
    },
  });

  if (isLoading || !data) {
    return <div className="p-12 flex justify-center"><Loader2 className="animate-spin" /></div>;
  }

  const { student, notices, today, monthPct, monthPresent, monthTotal, latestResult, resultsCount, pdfCount, courses } = data;
  const g = latestResult ? calcGrade(latestResult.marks, latestResult.exam.full_marks) : null;

  return (
    <div className="space-y-5 max-w-5xl">
      {/* Welcome */}
      <div className="bg-gradient-to-br from-academy-navy to-academy-navy/80 text-white rounded-2xl p-5 shadow">
        <div className="text-xs opacity-80">স্বাগতম</div>
        <div className="text-2xl font-bold mt-1">{student.full_name}</div>
        <div className="text-sm opacity-90">{bnClass(student.class_level)} শ্রেণি</div>
      </div>

      {/* Feature cards */}
      <FeatureCards variant="student" />


      {/* Position highlight */}
      {pos && pos.position != null && (() => {
        const overall = pos.myFullTotal > 0 ? calcGrade(pos.myTotal, pos.myFullTotal) : null;
        const pct = pos.myFullTotal > 0 ? ((pos.myTotal / pos.myFullTotal) * 100).toFixed(1) : null;
        return (
          <div className="bg-gradient-to-br from-academy-gold/20 to-amber-100 border border-amber-300 rounded-2xl p-5 flex items-center gap-4">
            <div className="size-14 rounded-2xl bg-academy-gold text-white flex items-center justify-center shrink-0 shadow">
              <Trophy className="size-7" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-xs text-amber-900/80">শ্রেণিতে আপনার অবস্থান (মোট প্রাপ্ত নম্বরে)</div>
              <div className="flex items-end gap-3 flex-wrap">
                <div className="text-3xl font-bold text-academy-navy leading-tight">
                  {bnNum(pos.position)}<span className="text-base text-muted-foreground font-normal">/{bnNum(pos.classSize)}</span>
                </div>
                {overall && (
                  <div className={`text-lg font-bold ${overall.color} bg-white/70 rounded-lg px-2.5 py-0.5`}>
                    {overall.grade}{pct && <span className="text-xs text-muted-foreground font-normal ml-1">· {bnNum(pct)}%</span>}
                  </div>
                )}
              </div>
              <div className="text-xs text-muted-foreground mt-0.5">
                মোট প্রাপ্ত নম্বর: <span className="font-bold text-academy-navy">{bnNum(pos.myTotal)}</span>
                {pos.myFullTotal > 0 && <span className="text-muted-foreground">/{bnNum(pos.myFullTotal)}</span>}
              </div>
            </div>
          </div>
        );
      })()}

      {/* Quick stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard
          icon={<CalendarCheck className="size-5" />}
          color="bg-green-500/15 text-green-600"
          label="আজকের উপস্থিতি"
          value={
            today
              ? today.status === "present" ? "উপস্থিত" : "অনুপস্থিত"
              : "—"
          }
          sub={today?.reason ?? undefined}
        />
        <StatCard
          icon={<TrendingUp className="size-5" />}
          color="bg-blue-500/15 text-blue-600"
          label="মাসিক হাজিরা"
          value={monthPct != null ? `${bnNum(monthPct)}%` : "—"}
          sub={monthTotal ? `${bnNum(monthPresent)}/${bnNum(monthTotal)} দিন` : undefined}
        />
        <StatCard
          icon={<GraduationCap className="size-5" />}
          color="bg-purple-500/15 text-purple-600"
          label="মোট রেজাল্ট"
          value={bnNum(resultsCount)}
        />
        <StatCard
          icon={<FileText className="size-5" />}
          color="bg-amber-500/15 text-amber-600"
          label="পিডিএফ নোটস"
          value={bnNum(pdfCount)}
        />
      </div>


      {/* Latest result */}
      {latestResult && g && (
        <div className="bg-white rounded-2xl border p-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-bold text-academy-navy">সর্বশেষ রেজাল্ট</h2>
            <Link to="/student/results" className="text-xs text-academy-navy underline">সব দেখুন</Link>
          </div>
          <div className="flex items-center gap-4 flex-wrap">
            <div className="flex-1 min-w-0">
              <div className="font-bold text-academy-navy">{latestResult.exam.subject}
                {latestResult.exam.title && <span className="text-muted-foreground font-normal"> — {latestResult.exam.title}</span>}
              </div>
              <div className="text-xs text-muted-foreground">
                {new Date(latestResult.exam.exam_date).toLocaleDateString("bn-BD")}
              </div>
            </div>
            <div className="text-right">
              <div className="text-2xl font-bold text-academy-navy">
                {bnNum(latestResult.marks)}<span className="text-sm text-muted-foreground">/{bnNum(latestResult.exam.full_marks)}</span>
              </div>
              <div className={`text-xs font-bold ${g.color}`}>{g.grade}</div>
            </div>
          </div>
        </div>
      )}

      {/* Courses for this student */}
      {courses.length > 0 && (
        <div className="bg-white rounded-2xl border p-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-bold text-academy-navy flex items-center gap-2"><GraduationCap className="size-4" /> আপনার কোর্সসমূহ</h2>
            <span className="text-xs text-muted-foreground">{bnNum(courses.length)} টি কোর্স</span>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {courses.map((c) => (
              <div key={c.id} className="rounded-xl border bg-academy-soft overflow-hidden hover:shadow-md hover:border-academy-gold/50 transition-all flex flex-col">
                {c.image_path ? (
                  <img
                    src={supabase.storage.from("site-assets").getPublicUrl(c.image_path).data.publicUrl}
                    alt={c.title}
                    className="w-full aspect-video object-cover"
                  />
                ) : (
                  <div className="w-full aspect-video bg-gradient-to-br from-academy-navy to-academy-navy/70 flex items-center justify-center text-academy-gold">
                    <GraduationCap className="size-10" />
                  </div>
                )}
                <div className="p-3 flex-1 flex flex-col">
                  {c.tag && <div className="text-[10px] font-bold text-academy-gold uppercase tracking-wider mb-1">{c.tag}</div>}
                  <div className="font-bold text-academy-navy text-sm leading-tight">{c.title}</div>
                  {c.description && <div className="text-xs text-muted-foreground line-clamp-2 mt-1">{c.description}</div>}
                  <div className="text-xs text-muted-foreground mt-2 flex flex-wrap gap-x-2">
                    {c.class_level && <span>{bnClass(c.class_level)} শ্রেণি</span>}
                    {c.duration && <span>· {c.duration}</span>}
                    {c.fee && <span className="font-bold text-academy-navy">· {c.fee}</span>}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Latest notices */}
      <div className="bg-white rounded-2xl border p-5">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-bold text-academy-navy flex items-center gap-2"><Bell className="size-4" /> সর্বশেষ নোটিশ</h2>
          <Link to="/student/notices" className="text-xs text-academy-navy underline">সব দেখুন</Link>
        </div>
        {notices.length === 0 ? (
          <div className="text-sm text-muted-foreground py-4 text-center">কোনো নোটিশ নেই</div>
        ) : (
          <ul className="space-y-2">
            {notices.map((n) => (
              <li key={n.id} className="border-l-2 border-academy-gold pl-3 py-1">
                <div className="font-medium text-academy-navy text-sm">{n.title}</div>
                <div className="text-xs text-muted-foreground">{new Date(n.created_at).toLocaleDateString("bn-BD")}</div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Quick links */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <QuickLink to="/student/attendance" icon={<CalendarCheck />} label="উপস্থিতি" />
        <QuickLink to="/student/results" icon={<GraduationCap />} label="রেজাল্ট" />
        <QuickLink to="/student/analysis" icon={<BarChart3 />} label="এনালাইসিস" />
        <QuickLink to="/student/pdfs" icon={<FileText />} label="পিডিএফ" />
      </div>
    </div>
  );
}

function StatCard({ icon, color, label, value, sub }: { icon: React.ReactNode; color: string; label: string; value: string; sub?: string }) {
  return (
    <div className="bg-white rounded-2xl border p-4">
      <div className={`size-9 rounded-lg ${color} flex items-center justify-center mb-2`}>{icon}</div>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="font-bold text-academy-navy text-lg leading-tight mt-0.5">{value}</div>
      {sub && <div className="text-xs text-muted-foreground mt-0.5 truncate">{sub}</div>}
    </div>
  );
}

function QuickLink({ to, icon, label }: { to: string; icon: React.ReactNode; label: string }) {
  return (
    <Link to={to} className="bg-white rounded-2xl border p-4 hover:shadow-md hover:border-academy-navy/30 transition-all flex flex-col items-center gap-2 text-center">
      <div className="size-10 rounded-xl bg-academy-soft text-academy-navy flex items-center justify-center">{icon}</div>
      <div className="text-sm font-medium text-academy-navy">{label}</div>
    </Link>
  );
}
