import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Loader2, Printer } from "lucide-react";
import { calcGrade, calcPositions, CLASS_LEVELS, EXAM_TYPE_LABEL, EXAM_PATTERN_LABEL, bnClass, BATCH_LABEL } from "@/lib/grading";

export const Route = createFileRoute("/admin/marksheet")({
  component: MarksheetPage,
});

const todayStr = () => new Date().toISOString().slice(0, 10);
const monthAgoStr = () => {
  const d = new Date(); d.setMonth(d.getMonth() - 1);
  return d.toISOString().slice(0, 10);
};

function MarksheetPage() {
  const [cls, setCls] = useState("");
  const [batch, setBatch] = useState("all");
  const [studentId, setStudentId] = useState<string>("all");
  const [from, setFrom] = useState(monthAgoStr());
  const [to, setTo] = useState(todayStr());
  const [generated, setGenerated] = useState<{ cls: string; batch: string; from: string; to: string; studentId: string } | null>(null);

  const { data: classStudents } = useQuery({
    queryKey: ["marksheet-students", cls, batch],
    enabled: !!cls,
    queryFn: async () => {
      let q = supabase
        .from("students")
        .select("id, full_name, roll")
        .eq("class_level", cls as any)
        .eq("is_active", true);
      if (batch !== "all") q = q.eq("batch", batch as any);
      const { data, error } = await q.order("roll", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });

  return (
    <div className="space-y-4 max-w-6xl">
      <div className="print:hidden">
        <h1 className="text-2xl font-bold text-academy-navy">মার্কশীট প্রিন্ট</h1>
        <p className="text-sm text-muted-foreground">ক্লাস, শিক্ষার্থী ও তারিখ পরিসর সিলেক্ট করে মার্কশীট তৈরি করুন</p>
      </div>

      <div className="bg-white rounded-2xl border p-4 grid sm:grid-cols-2 lg:grid-cols-5 gap-3 print:hidden">
        <div>
          <Label>শ্রেণি</Label>
          <Select value={cls} onValueChange={(v) => { setCls(v); setStudentId("all"); }}>
            <SelectTrigger><SelectValue placeholder="বাছাই" /></SelectTrigger>
            <SelectContent>
              {CLASS_LEVELS.map((c) => <SelectItem key={c} value={c}>{bnClass(c)}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>ব্যাচ</Label>
          <Select value={batch} onValueChange={(v) => { setBatch(v); setStudentId("all"); }}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">সব ব্যাচ</SelectItem>
              <SelectItem value="morning">{BATCH_LABEL.morning}</SelectItem>
              <SelectItem value="afternoon">{BATCH_LABEL.afternoon}</SelectItem>
              <SelectItem value="evening">{BATCH_LABEL.evening}</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>শিক্ষার্থী</Label>
          <Select value={studentId} onValueChange={setStudentId} disabled={!cls}>
            <SelectTrigger><SelectValue placeholder="বাছাই" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">সবাই</SelectItem>
              {(classStudents ?? []).map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.roll ? `${s.roll} — ` : ""}{s.full_name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>শুরু তারিখ</Label>
          <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        </div>
        <div>
          <Label>শেষ তারিখ</Label>
          <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        </div>
        <div className="flex items-end">
          <Button
            className="bg-academy-navy text-white w-full"
            disabled={!cls}
            onClick={() => setGenerated({ cls, from, to, studentId })}
          >
            মার্কশীট তৈরি
          </Button>
        </div>
      </div>

      {generated && <MarksheetView {...generated} />}
    </div>
  );
}


function MarksheetView({ cls, from, to, studentId }: { cls: string; from: string; to: string; studentId: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ["marksheet", cls, from, to],
    queryFn: async () => {
      const [{ data: students, error: e1 }, { data: exams, error: e2 }] = await Promise.all([
        supabase
          .from("students")
          .select("id, full_name, roll")
          .eq("class_level", cls as any)
          .eq("is_active", true)
          .order("roll", { ascending: true }),
        supabase
          .from("exams")
          .select("*")
          .eq("class_level", cls as any)
          .gte("exam_date", from)
          .lte("exam_date", to)
          .order("exam_date", { ascending: true }),
      ]);
      if (e1) throw e1;
      if (e2) throw e2;
      const examIds = (exams ?? []).map((e) => e.id);
      let results: { exam_id: string; student_id: string; marks: number | null }[] = [];
      if (examIds.length) {
        const { data: r, error: e3 } = await supabase
          .from("exam_results")
          .select("exam_id, student_id, marks")
          .in("exam_id", examIds);
        if (e3) throw e3;
        results = (r ?? []).map((x) => ({ ...x, marks: x.marks == null ? null : Number(x.marks) }));
      }
      const posByExam = new Map<string, Map<string, number>>();
      for (const ex of exams ?? []) {
        const rows = (students ?? []).map((s) => ({
          student_id: s.id,
          marks: results.find((r) => r.exam_id === ex.id && r.student_id === s.id)?.marks ?? null,
        }));
        posByExam.set(ex.id, calcPositions(rows));
      }
      return { students: students ?? [], exams: exams ?? [], results, posByExam };
    },
  });

  if (isLoading) return <div className="p-12 flex justify-center"><Loader2 className="animate-spin" /></div>;
  if (!data) return null;
  const { students: allStudents, exams, results, posByExam } = data;
  const students = studentId && studentId !== "all"
    ? allStudents.filter((s) => s.id === studentId)
    : allStudents;

  if (exams.length === 0) {
    return <div className="bg-white p-12 rounded-2xl border text-center text-muted-foreground">এই সময়ের মধ্যে কোনো পরীক্ষা নেই</div>;
  }
  if (students.length === 0) {
    return <div className="bg-white p-12 rounded-2xl border text-center text-muted-foreground">শিক্ষার্থী পাওয়া যায়নি</div>;
  }


  return (
    <div>
      <div className="print:hidden flex justify-end mb-3">
        <Button onClick={() => window.print()} variant="outline">
          <Printer className="size-4 mr-1" /> প্রিন্ট
        </Button>
      </div>

      <div className="space-y-6 print:space-y-4">
        {students.map((s) => {
          const studentRows = exams.map((ex) => {
            const r = results.find((rr) => rr.exam_id === ex.id && rr.student_id === s.id);
            const marks = r?.marks ?? null;
            const g = calcGrade(marks, ex.full_marks);
            const pos = posByExam.get(ex.id)?.get(s.id) ?? null;
            return { ex, marks, grade: g, pos };
          });
          const totalFull = studentRows.reduce((a, b) => a + (b.marks != null ? b.ex.full_marks : 0), 0);
          const totalGot = studentRows.reduce((a, b) => a + (b.marks ?? 0), 0);
          // overall class rank: by sum across these exams
          const overall = allStudents.map((st) => {
            const sum = exams.reduce((acc, ex) => {
              const m = results.find((r) => r.exam_id === ex.id && r.student_id === st.id)?.marks;
              return acc + (m ?? 0);
            }, 0);
            return { id: st.id, sum };
          }).sort((a, b) => b.sum - a.sum);
          const classRank = overall.findIndex((x) => x.id === s.id) + 1;

          return (
            <div key={s.id} className="marksheet-page bg-white rounded-2xl border p-6 print:border-0 print:shadow-none mx-auto" style={{ width: "210mm", minHeight: "297mm" }}>
              <div className="text-center border-b pb-3 mb-4">
                <div className="text-xs text-muted-foreground">সমীকরণ শিক্ষা পরিবার</div>
                <h2 className="text-xl font-bold text-academy-navy">মার্কশীট</h2>
                <div className="text-xs text-muted-foreground">
                  {new Date(from).toLocaleDateString("bn-BD")} — {new Date(to).toLocaleDateString("bn-BD")}
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2 text-sm mb-4">
                <div><span className="text-muted-foreground">নাম: </span><b>{s.full_name}</b></div>
                <div><span className="text-muted-foreground">রোল: </span><b>{s.roll ?? "—"}</b></div>
                <div><span className="text-muted-foreground">শ্রেণি: </span><b>{bnClass(cls)}</b></div>
              </div>
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="bg-academy-soft">
                    <th className="border p-2 text-left">তারিখ</th>
                    <th className="border p-2 text-left">বিষয়</th>
                    <th className="border p-2 text-left">ধরন</th>
                    <th className="border p-2">পূর্ণমান</th>
                    <th className="border p-2">প্রাপ্ত</th>
                    <th className="border p-2">গ্রেড</th>
                    <th className="border p-2">পজিশন</th>
                  </tr>
                </thead>
                <tbody>
                  {studentRows.map(({ ex, marks, grade, pos }) => (
                    <tr key={ex.id}>
                      <td className="border p-2">{new Date(ex.exam_date).toLocaleDateString("bn-BD")}</td>
                      <td className="border p-2">{ex.subject}{ex.title ? ` (${ex.title})` : ""}</td>
                      <td className="border p-2">{EXAM_TYPE_LABEL[ex.exam_type]} ({EXAM_PATTERN_LABEL[(ex as any).pattern ?? "written"]})</td>
                      <td className="border p-2 text-center">{ex.full_marks}</td>
                      <td className="border p-2 text-center">{marks ?? "—"}</td>
                      <td className={`border p-2 text-center font-bold ${grade.color}`}>{grade.grade}</td>
                      <td className="border p-2 text-center">{pos ?? "—"}</td>
                    </tr>
                  ))}
                  <tr className="bg-academy-soft font-bold">
                    <td colSpan={3} className="border p-2 text-right">সর্বমোট</td>
                    <td className="border p-2 text-center">{totalFull}</td>
                    <td className="border p-2 text-center">{totalGot}</td>
                    <td className="border p-2 text-center" colSpan={2}>
                      ক্লাসে অবস্থান: {classRank} / {allStudents.length}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          );
        })}
      </div>
    </div>
  );
}
