import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableHeader, TableBody, TableRow, TableHead, TableCell,
} from "@/components/ui/table";
import { toast } from "sonner";
import { ArrowLeft, Loader2, Save } from "lucide-react";
import { calcGrade, calcPositions, EXAM_TYPE_LABEL, EXAM_PATTERN_LABEL, bnClass, DEPT_LABEL, BATCH_LABEL, DEPT_CLASS_LEVELS } from "@/lib/grading";

export const Route = createFileRoute("/admin/results/$examId")({
  component: MarksEntryPage,
});

type Row = {
  student_id: string;
  full_name: string;
  roll: string | null;
  marks: number | null;
  department: string;
  batch: string;
};

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
    queryKey: ["exam-roster", examId, exam?.class_level, exam?.department, exam?.batch],
    enabled: !!exam,
    queryFn: async () => {
      let sq = supabase
        .from("students")
        .select("id, full_name, roll, department, batch")
        .eq("class_level", exam!.class_level)
        .eq("is_active", true);
      // পরীক্ষাটি নির্দিষ্ট বিভাগ/ব্যাচের জন্য হলে রোস্টার সেভাবেই সীমিত হবে
      if ((exam as any)!.department) sq = sq.eq("department", (exam as any).department);
      if ((exam as any)!.batch) sq = sq.eq("batch", (exam as any).batch);
      const [{ data: students, error: e1 }, { data: results, error: e2 }] = await Promise.all([
        sq.order("roll", { ascending: true }),
        supabase.from("exam_results").select("student_id, marks").eq("exam_id", examId),
      ]);
      if (e1) throw e1;
      if (e2) throw e2;
      const marksMap = new Map((results ?? []).map((r) => [r.student_id, Number(r.marks)]));
      return (students ?? []).map((s) => ({
        student_id: s.id,
        full_name: s.full_name,
        roll: s.roll,
        department: (s as any).department ?? "none",
        batch: (s as any).batch ?? "",
        marks: marksMap.has(s.id) ? marksMap.get(s.id)! : null,
      })) as Row[];
    },
  });

  const [edits, setEdits] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [deptFilter, setDeptFilter] = useState("all");
  const [batchFilter, setBatchFilter] = useState("all");

  // শ্রেণি ৯-১২ এর জন্য বিভাগ ফিল্টার দেখানো হবে (পরীক্ষাটি কোনো নির্দিষ্ট বিভাগের না হলে)
  const showDept =
    DEPT_CLASS_LEVELS.includes(String(exam?.class_level ?? "")) && !(exam as any)?.department;
  // পরীক্ষাটি কোনো নির্দিষ্ট ব্যাচের না হলে ব্যাচ ফিল্টার দেখানো হবে
  const showBatch = !(exam as any)?.batch;

  // রোস্টারে আসলে কোন কোন বিভাগ আছে
  const availableDepts = useMemo(() => {
    const set = new Set<string>();
    (rows ?? []).forEach((r) => set.add(r.department));
    return Array.from(set);
  }, [rows]);

  // রোস্টারে আসলে কোন কোন ব্যাচ আছে
  const availableBatches = useMemo(() => {
    const set = new Set<string>();
    (rows ?? []).forEach((r) => { if (r.batch) set.add(r.batch); });
    return Array.from(set);
  }, [rows]);

  useEffect(() => {
    if (rows) {
      const init: Record<string, string> = {};
      rows.forEach((r) => { init[r.student_id] = r.marks == null ? "" : String(r.marks); });
      setEdits(init);
    }
  }, [rows]);

  // বিভাগ ও ব্যাচ অনুযায়ী ফিল্টার করা সারি
  const filteredRows = useMemo<Row[]>(() => {
    if (!rows) return [];
    return rows.filter((r) => {
      if (showDept && deptFilter !== "all" && r.department !== deptFilter) return false;
      if (showBatch && batchFilter !== "all" && r.batch !== batchFilter) return false;
      return true;
    });
  }, [rows, showDept, deptFilter, showBatch, batchFilter]);

  const currentRows = useMemo<Row[]>(() => {
    return filteredRows.map((r) => {
      const v = edits[r.student_id];
      const n = v === "" || v == null ? null : Number(v);
      return { ...r, marks: n != null && !isNaN(n) ? n : null };
    });
  }, [filteredRows, edits]);

  const positions = useMemo(() => calcPositions(currentRows), [currentRows]);

  const handleSave = async () => {
    if (!exam || !rows) return;
    setSaving(true);
    // Build upserts for non-empty, deletes for cleared (only for currently visible rows)
    const toUpsert: { exam_id: string; student_id: string; marks: number }[] = [];
    const toClear: string[] = [];
    for (const r of filteredRows) {
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

      {showDept && (
        <div className="bg-white rounded-2xl border p-4 flex items-center gap-3 flex-wrap">
          <span className="text-sm font-medium text-academy-navy">বিভাগ:</span>
          <Select value={deptFilter} onValueChange={setDeptFilter}>
            <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">সব বিভাগ</SelectItem>
              {availableDepts.map((d) => (
                <SelectItem key={d} value={d}>{DEPT_LABEL[d] ?? d}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <span className="text-xs text-muted-foreground">
            {currentRows.length} জন শিক্ষার্থী
          </span>
        </div>
      )}

      <div className="bg-white rounded-2xl border overflow-hidden">
        {currentRows.length === 0 ? (
          <div className="p-12 text-center text-muted-foreground">
            {showDept && deptFilter !== "all"
              ? "এই বিভাগে কোনো এক্টিভ শিক্ষার্থী নেই"
              : "এই শ্রেণিতে কোনো এক্টিভ শিক্ষার্থী নেই"}
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
