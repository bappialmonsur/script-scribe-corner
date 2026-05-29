import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table, TableHeader, TableBody, TableRow, TableHead, TableCell,
} from "@/components/ui/table";
import { toast } from "sonner";
import { ArrowLeft, Loader2, Save } from "lucide-react";
import { calcGrade, calcPositions, EXAM_TYPE_LABEL, EXAM_PATTERN_LABEL, bnClass } from "@/lib/grading";

export const Route = createFileRoute("/admin/results/$examId")({
  component: MarksEntryPage,
});

type Row = { student_id: string; full_name: string; roll: string | null; marks: number | null };

function MarksEntryPage() {
  const { examId } = Route.useParams();

  const { data: exam, isLoading: loadingExam } = useQuery({
    queryKey: ["exam", examId],
    queryFn: async () => {
      const { data, error } = await supabase.from("exams").select("*").eq("id", examId).single();
      if (error) throw error;
      return data;
    },
  });

  const { data: rows, isLoading: loadingRows, refetch } = useQuery({
    queryKey: ["exam-roster", examId, exam?.class_level],
    enabled: !!exam,
    queryFn: async () => {
      const [{ data: students, error: e1 }, { data: results, error: e2 }] = await Promise.all([
        supabase
          .from("students")
          .select("id, full_name, roll")
          .eq("class_level", exam!.class_level)
          .eq("is_active", true)
          .order("roll", { ascending: true }),
        supabase.from("exam_results").select("student_id, marks").eq("exam_id", examId),
      ]);
      if (e1) throw e1;
      if (e2) throw e2;
      const marksMap = new Map((results ?? []).map((r) => [r.student_id, Number(r.marks)]));
      return (students ?? []).map((s) => ({
        student_id: s.id,
        full_name: s.full_name,
        roll: s.roll,
        marks: marksMap.has(s.id) ? marksMap.get(s.id)! : null,
      })) as Row[];
    },
  });

  const [edits, setEdits] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (rows) {
      const init: Record<string, string> = {};
      rows.forEach((r) => { init[r.student_id] = r.marks == null ? "" : String(r.marks); });
      setEdits(init);
    }
  }, [rows]);

  const currentRows = useMemo<Row[]>(() => {
    if (!rows) return [];
    return rows.map((r) => {
      const v = edits[r.student_id];
      const n = v === "" || v == null ? null : Number(v);
      return { ...r, marks: n != null && !isNaN(n) ? n : null };
    });
  }, [rows, edits]);

  const positions = useMemo(() => calcPositions(currentRows), [currentRows]);

  const handleSave = async () => {
    if (!exam || !rows) return;
    setSaving(true);
    // Build upserts for non-empty, deletes for cleared
    const toUpsert: { exam_id: string; student_id: string; marks: number }[] = [];
    const toClear: string[] = [];
    for (const r of rows) {
      const v = edits[r.student_id];
      if (v === "" || v == null) {
        if (r.marks != null) toClear.push(r.student_id);
        continue;
      }
      const n = Number(v);
      if (isNaN(n) || n < 0 || n > exam.full_marks) {
        setSaving(false);
        return toast.error(`"${r.full_name}" এর নাম্বার ০-${exam.full_marks} এর মধ্যে দিন`);
      }
      toUpsert.push({ exam_id: examId, student_id: r.student_id, marks: n });
    }
    if (toUpsert.length) {
      const { error } = await supabase.from("exam_results").upsert(toUpsert, {
        onConflict: "exam_id,student_id",
      });
      if (error) { setSaving(false); return toast.error(error.message); }
    }
    if (toClear.length) {
      const { error } = await supabase.from("exam_results")
        .delete().eq("exam_id", examId).in("student_id", toClear);
      if (error) { setSaving(false); return toast.error(error.message); }
    }
    setSaving(false);
    toast.success("সংরক্ষিত হয়েছে");
    refetch();
  };

  if (loadingExam || loadingRows) {
    return <div className="p-12 flex justify-center"><Loader2 className="animate-spin" /></div>;
  }
  if (!exam) {
    return <div className="text-center p-12 text-muted-foreground">পরীক্ষা পাওয়া যায়নি</div>;
  }

  return (
    <div className="space-y-4 max-w-5xl">
      <div className="flex items-center gap-3 flex-wrap">
        <Link to="/admin/results">
          <Button variant="ghost" size="icon"><ArrowLeft /></Button>
        </Link>
        <div className="flex-1 min-w-0">
          <h1 className="text-xl md:text-2xl font-bold text-academy-navy truncate">
            {exam.subject}{exam.title ? ` — ${exam.title}` : ""}
          </h1>
          <p className="text-sm text-muted-foreground">
            {bnClass(exam.class_level)} · {EXAM_TYPE_LABEL[exam.exam_type]} · {EXAM_PATTERN_LABEL[(exam as any).pattern ?? "written"]} · পূর্ণমান {exam.full_marks} ·{" "}
            {new Date(exam.exam_date).toLocaleDateString("bn-BD")}
          </p>
        </div>
        <Button onClick={handleSave} disabled={saving} className="bg-academy-navy text-white">
          {saving ? <Loader2 className="size-4 mr-1 animate-spin" /> : <Save className="size-4 mr-1" />}
          সংরক্ষণ
        </Button>
      </div>

      <div className="bg-white rounded-2xl border overflow-hidden">
        {currentRows.length === 0 ? (
          <div className="p-12 text-center text-muted-foreground">
            এই শ্রেণিতে কোনো এক্টিভ শিক্ষার্থী নেই
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-16">রোল</TableHead>
                <TableHead>নাম</TableHead>
                <TableHead className="w-32">নাম্বার</TableHead>
                <TableHead className="w-20">গ্রেড</TableHead>
                <TableHead className="w-20">পজিশন</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {currentRows.map((r) => {
                const g = calcGrade(r.marks, exam.full_marks);
                const pos = positions.get(r.student_id);
                return (
                  <TableRow key={r.student_id}>
                    <TableCell className="text-muted-foreground">{r.roll ?? "—"}</TableCell>
                    <TableCell className="font-medium text-academy-navy">{r.full_name}</TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        inputMode="decimal"
                        min={0}
                        max={exam.full_marks}
                        value={edits[r.student_id] ?? ""}
                        onChange={(e) => setEdits((p) => ({ ...p, [r.student_id]: e.target.value }))}
                        placeholder="—"
                        className="h-9"
                      />
                    </TableCell>
                    <TableCell className={`font-bold ${g.color}`}>{g.grade}</TableCell>
                    <TableCell>{pos ? `${pos}` : "—"}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  );
}
