import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useSession } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { GraduationCap, Loader2, FileText, Crown } from "lucide-react";
import { calcGrade, EXAM_TYPE_LABEL, EXAM_PATTERN_LABEL, bnNum } from "@/lib/grading";
import { getExamToppers } from "@/lib/student-stats.functions";

export const Route = createFileRoute("/student/results")({
  component: StudentResults,
});

function StudentResults() {
  const { user } = useSession();
  const fetchToppers = useServerFn(getExamToppers);

  const { data, isLoading } = useQuery({
    queryKey: ["my-results", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data: s } = await supabase.from("students").select("id, class_level").eq("user_id", user!.id).maybeSingle();
      if (!s) return [];
      const { data: exams } = await supabase
        .from("exams").select("*").eq("class_level", s.class_level).order("exam_date", { ascending: false });
      const { data: results } = await supabase
        .from("exam_results").select("exam_id, marks").eq("student_id", s.id);
      const map = new Map(results?.map((r) => [r.exam_id, Number(r.marks)]) ?? []);
      return (exams ?? []).map((e) => ({ ...e, my_marks: map.has(e.id) ? map.get(e.id)! : null }));
    },
  });

  const examIds = (data ?? []).map((e: any) => e.id);
  const { data: toppers } = useQuery({
    queryKey: ["exam-toppers", examIds.join(",")],
    enabled: examIds.length > 0,
    queryFn: () => fetchToppers({ data: { examIds } }),
  });

  return (
    <div className="space-y-4 max-w-4xl">
      <div className="flex items-center gap-3">
        <div className="size-10 rounded-xl bg-purple-500/15 text-purple-600 flex items-center justify-center">
          <GraduationCap />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-academy-navy">রেজাল্ট</h1>
          <p className="text-sm text-muted-foreground">তারিখ অনুযায়ী আপনার পরীক্ষার ফলাফল</p>
        </div>
      </div>

      {isLoading ? (
        <div className="p-12 flex justify-center"><Loader2 className="animate-spin" /></div>
      ) : (data?.length ?? 0) === 0 ? (
        <div className="bg-white rounded-2xl border p-12 text-center text-muted-foreground">কোনো পরীক্ষা নেই</div>
      ) : (
        <ul className="space-y-3">
          {data!.map((e: any) => {
            const g = calcGrade(e.my_marks, e.full_marks);
            const pct = e.my_marks != null ? ((e.my_marks / e.full_marks) * 100).toFixed(1) : null;
            const top = toppers?.[e.id];
            return (
              <li key={e.id} className="bg-white rounded-2xl border p-4 space-y-3">
                <div className="flex gap-3 items-center flex-wrap">
                  <div className="size-10 rounded-lg bg-academy-soft text-academy-navy flex items-center justify-center shrink-0">
                    <FileText className="size-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-bold text-academy-navy">
                      {e.subject}{e.title && <span className="text-muted-foreground font-normal"> — {e.title}</span>}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {EXAM_TYPE_LABEL[e.exam_type]} · {EXAM_PATTERN_LABEL[e.pattern ?? "written"]} · পূর্ণমান {bnNum(e.full_marks)} ·{" "}
                      {new Date(e.exam_date).toLocaleDateString("bn-BD")}
                    </div>
                  </div>
                  <div className="text-right">
                    {e.my_marks != null ? (
                      <>
                        <div className="text-2xl font-bold text-academy-navy">{bnNum(e.my_marks)}<span className="text-sm text-muted-foreground">/{bnNum(e.full_marks)}</span></div>
                        <div className={`text-xs font-bold ${g.color}`}>{g.grade} · {bnNum(pct!)}%</div>
                      </>
                    ) : (
                      <span className="text-xs text-muted-foreground">প্রকাশিত হয়নি</span>
                    )}
                  </div>
                </div>

                {top && (
                  <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">
                    <Crown className="size-4 text-amber-600 shrink-0" />
                    <div className="text-xs flex-1 min-w-0">
                      <span className="text-muted-foreground">সর্বোচ্চ নাম্বার: </span>
                      <span className="font-bold text-academy-navy">{bnNum(top.marks)}</span>
                      <span className="text-muted-foreground"> · প্রাপক: </span>
                      <span className="font-bold text-academy-navy truncate">{top.name}</span>
                      {top.roll && <span className="text-muted-foreground"> (রোল {bnNum(top.roll)})</span>}
                    </div>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
