import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { BarChart3, Loader2, Printer, TrendingDown, TrendingUp, Minus } from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell, Rectangle,
} from "recharts";
import { bnNum, bnClass, CLASS_LEVELS, calcGrade } from "@/lib/grading";

function renderBarShape({ x, y, width, height, value, payload, payloadKey, fill, inside = false, insideTextFill = "#ffffff", outsideTextFill = "#0f172a" }: {
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  value?: number | string;
  payload?: Record<string, number | string | undefined>;
  payloadKey?: string;
  fill?: string;
  inside?: boolean;
  insideTextFill?: string;
  outsideTextFill?: string;
}) {
  const resolvedValue = value ?? (payloadKey ? payload?.[payloadKey] : undefined);

  if (
    typeof x !== "number"
    || typeof y !== "number"
    || typeof width !== "number"
    || typeof height !== "number"
    || resolvedValue === undefined
    || resolvedValue === null
  ) {
    return <g />;
  }

  const useInside = inside && height > 22;

  return (
    <g>
      <Rectangle
        x={x}
        y={y}
        width={width}
        height={height}
        radius={[6, 6, 0, 0]}
        fill={fill}
      />
      <text
        x={x + width / 2}
        y={useInside ? y + 14 : y - 6}
        textAnchor="middle"
        fontSize={10}
        fontWeight={700}
        fill={useInside ? insideTextFill : outsideTextFill}
        pointerEvents="none"
      >
        {bnNum(resolvedValue)}
      </text>
    </g>
  );
}

export const Route = createFileRoute("/admin/analysis")({
  component: AdminAnalysis,
});

function AdminAnalysis() {
  const [cls, setCls] = useState("");
  const [studentId, setStudentId] = useState("");

  const { data: students } = useQuery({
    queryKey: ["analysis-students", cls],
    enabled: !!cls,
    queryFn: async () => {
      const { data } = await supabase
        .from("students").select("id, full_name, roll")
        .eq("class_level", cls as any).eq("is_active", true)
        .order("roll", { ascending: true });
      return data ?? [];
    },
  });

  return (
    <div className="space-y-4 max-w-5xl">
      <div className="print:hidden">
        <h1 className="text-2xl font-bold text-academy-navy">রেজাল্ট এনালাইসিস</h1>
        <p className="text-sm text-muted-foreground">শিক্ষার্থী অনুযায়ী বিস্তারিত পারফরম্যান্স রিপোর্ট</p>
      </div>

      <div className="bg-white rounded-2xl border p-4 grid sm:grid-cols-2 gap-3 print:hidden">
        <div>
          <Label>শ্রেণি</Label>
          <Select value={cls} onValueChange={(v) => { setCls(v); setStudentId(""); }}>
            <SelectTrigger><SelectValue placeholder="বাছাই" /></SelectTrigger>
            <SelectContent>
              {CLASS_LEVELS.map((c) => <SelectItem key={c} value={c}>{bnClass(c)}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>শিক্ষার্থী</Label>
          <Select value={studentId} onValueChange={setStudentId} disabled={!cls}>
            <SelectTrigger><SelectValue placeholder="বাছাই" /></SelectTrigger>
            <SelectContent>
              {(students ?? []).map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.roll ? `${s.roll} — ` : ""}{s.full_name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {studentId && cls && (
        <StudentAnalysisView
          studentId={studentId}
          cls={cls}
          studentName={students?.find((s) => s.id === studentId)?.full_name ?? ""}
          studentRoll={students?.find((s) => s.id === studentId)?.roll ?? null}
        />
      )}
    </div>
  );
}

function StudentAnalysisView({
  studentId, cls, studentName, studentRoll,
}: { studentId: string; cls: string; studentName: string; studentRoll: string | null }) {
  const { data, isLoading } = useQuery({
    queryKey: ["admin-analysis", studentId, cls],
    queryFn: async () => {
      const { data: exams } = await supabase
        .from("exams").select("*").eq("class_level", cls as any).order("exam_date");
      const { data: results } = await supabase
        .from("exam_results").select("exam_id, marks").eq("student_id", studentId);
      const map = new Map(results?.map((r) => [r.exam_id, Number(r.marks)]) ?? []);
      return (exams ?? [])
        .filter((e) => map.has(e.id))
        .map((e) => ({
          id: e.id, subject: e.subject, date: e.exam_date,
          full: e.full_marks, marks: map.get(e.id)!,
          pct: (map.get(e.id)! / e.full_marks) * 100,
        }));
    },
  });

  const overallData = useMemo(() =>
    (data ?? []).map((d) => ({
      label: `${d.subject.slice(0, 6)} · ${new Date(d.date).toLocaleDateString("bn-BD", { day: "numeric", month: "short" })}`,
      "শতকরা": Number(d.pct.toFixed(1)),
    })), [data]);

  const subjectStats = useMemo(() => {
    const m = new Map<string, { pcts: number[]; obtained: number; full: number }>();
    (data ?? []).forEach((d) => {
      const e = m.get(d.subject) ?? { pcts: [], obtained: 0, full: 0 };
      e.pcts.push(d.pct); e.obtained += d.marks; e.full += d.full;
      m.set(d.subject, e);
    });
    return Array.from(m.entries()).map(([subject, v]) => {
      const avg = v.pcts.reduce((s, x) => s + x, 0) / v.pcts.length;
      const best = Math.max(...v.pcts);
      const worst = Math.min(...v.pcts);
      let trend: "up" | "down" | "flat" = "flat";
      if (v.pcts.length >= 2) {
        const mid = Math.floor(v.pcts.length / 2);
        const a = v.pcts.slice(0, mid || 1);
        const b = v.pcts.slice(mid || 1);
        const diff = b.reduce((s, x) => s + x, 0) / b.length - a.reduce((s, x) => s + x, 0) / a.length;
        if (diff > 3) trend = "up"; else if (diff < -3) trend = "down";
      }
      return { subject, avg, best, worst, count: v.pcts.length, trend, obtained: v.obtained, full: v.full };
    }).sort((a, b) => b.avg - a.avg);
  }, [data]);

  const subjectBarData = useMemo(() =>
    subjectStats.map((s) => ({
      subject: s.subject,
      "প্রাপ্ত নম্বর": Number(s.obtained.toFixed(1)),
      "মোট নম্বর": Number(s.full.toFixed(1)),
    })), [subjectStats]);

  const totals = useMemo(() => {
    const obtained = (data ?? []).reduce((a, b) => a + b.marks, 0);
    const full = (data ?? []).reduce((a, b) => a + b.full, 0);
    return { obtained, full, grade: full > 0 ? calcGrade(obtained, full) : null };
  }, [data]);

  if (isLoading) return <div className="p-12 flex justify-center"><Loader2 className="animate-spin" /></div>;
  if (!data || data.length === 0) {
    return <div className="bg-white rounded-2xl border p-12 text-center text-muted-foreground">এই শিক্ষার্থীর এনালাইসিসের জন্য পর্যাপ্ত ডেটা নেই</div>;
  }

  return (
    <>
      <div className="print:hidden flex justify-end">
        <Button onClick={() => window.print()} variant="outline">
          <Printer className="size-4 mr-1" /> প্রিন্ট
        </Button>
      </div>

      <div className="print-area space-y-4 bg-white p-6 rounded-2xl border print:border-0 print:shadow-none mx-auto" style={{ width: "210mm", minHeight: "297mm" }}>
        <div className="text-center border-b pb-3">
          <div className="text-xs text-muted-foreground">সমীকরণ শিক্ষা পরিবার</div>
          <h2 className="text-xl font-bold text-academy-navy">শিক্ষার্থীর পারফরম্যান্স এনালাইসিস</h2>
        </div>
        <div className="grid grid-cols-4 gap-2 text-sm">
          <div><span className="text-muted-foreground">নাম: </span><b>{studentName}</b></div>
          <div><span className="text-muted-foreground">রোল: </span><b>{studentRoll ?? "—"}</b></div>
          <div><span className="text-muted-foreground">শ্রেণি: </span><b>{bnClass(cls)}</b></div>
          <div><span className="text-muted-foreground">গ্রেড: </span>
            <b className={totals.grade?.color}>{totals.grade?.grade ?? "—"}</b>
            {totals.full > 0 && <span className="text-xs text-muted-foreground ml-1">({bnNum(totals.obtained)}/{bnNum(totals.full)})</span>}
          </div>
        </div>

        <div className="border rounded-xl p-3">
          <h3 className="font-bold text-academy-navy text-sm mb-2">তারিখ অনুযায়ী সব পরীক্ষা (শতকরা %)</h3>
          <div className="h-64 w-full">
            <ResponsiveContainer>
              <BarChart data={overallData} margin={{ top: 10, right: 10, left: 0, bottom: 40 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
                <XAxis dataKey="label" angle={-30} textAnchor="end" interval={0} tick={{ fontSize: 9 }} height={60} />
                <YAxis domain={[0, 100]} tick={{ fontSize: 10 }} />
                <Tooltip />
                <Bar dataKey="শতকরা" fill="#1e3a8a" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="border rounded-xl p-3">
          <h3 className="font-bold text-academy-navy text-sm mb-2">বিষয়ভিত্তিক প্রাপ্ত vs মোট নম্বর</h3>
          <div className="h-64 w-full">
            <ResponsiveContainer>
              <BarChart data={subjectBarData} margin={{ top: 36, right: 10, left: 0, bottom: 40 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
                <XAxis dataKey="subject" angle={-20} textAnchor="end" interval={0} tick={{ fontSize: 10 }} height={60} />
                <YAxis tick={{ fontSize: 10 }} domain={[0, (dataMax: number) => Math.ceil(dataMax * 1.15)]} />
                <Tooltip />
                <Bar
                  dataKey="মোট নম্বর"
                  fill="#cbd5e1"
                  radius={[6, 6, 0, 0]}
                  isAnimationActive={false}
                  shape={(props: Parameters<typeof renderBarShape>[0]) => renderBarShape({ ...props, payloadKey: "মোট নম্বর", inside: true, insideTextFill: "#334155", outsideTextFill: "#334155" })}
                />
                <Bar
                  dataKey="প্রাপ্ত নম্বর"
                  radius={[6, 6, 0, 0]}
                  isAnimationActive={false}
                  shape={(props: Parameters<typeof renderBarShape>[0]) => renderBarShape({ ...props, payloadKey: "প্রাপ্ত নম্বর", inside: true })}
                >
                  {subjectStats.map((s, i) => {
                    const color = s.avg >= 80 ? "#16a34a" : s.avg >= 60 ? "#1e3a8a" : s.avg >= 40 ? "#d97706" : "#dc2626";
                    return <Cell key={i} fill={color} />;
                  })}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="border rounded-xl p-3">
          <h3 className="font-bold text-academy-navy text-sm mb-2">বিষয়ভিত্তিক মন্তব্য</h3>
          <ul className="space-y-2">
            {subjectStats.map((s) => {
              const status =
                s.avg >= 80 ? { label: "চমৎকার", color: "bg-green-100 text-green-700", comment: `${s.subject}-এ দুর্দান্ত পারফরম্যান্স।` }
                : s.avg >= 60 ? { label: "ভালো", color: "bg-blue-100 text-blue-700", comment: `${s.subject}-এ ভালো করছে, আরও পরিশ্রমে A+ সম্ভব।` }
                : s.avg >= 40 ? { label: "মাঝারি", color: "bg-amber-100 text-amber-700", comment: `${s.subject}-এ বাড়তি মনোযোগ প্রয়োজন।` }
                : { label: "দুর্বল", color: "bg-red-100 text-red-700", comment: `${s.subject}-এ বিশেষ যত্ন ও অতিরিক্ত অনুশীলন দরকার।` };
              const TIcon = s.trend === "up" ? TrendingUp : s.trend === "down" ? TrendingDown : Minus;
              const tColor = s.trend === "up" ? "text-green-600" : s.trend === "down" ? "text-red-600" : "text-muted-foreground";
              const tText = s.trend === "up" ? "উন্নতি" : s.trend === "down" ? "অবনতি" : "স্থির";
              return (
                <li key={s.subject} className="border rounded-lg p-2 text-xs">
                  <div className="flex items-center justify-between mb-1 flex-wrap gap-1">
                    <div className="font-bold text-academy-navy text-sm">{s.subject}</div>
                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-0.5 rounded-full font-medium ${status.color}`}>{status.label}</span>
                      <span className={`flex items-center gap-1 ${tColor}`}><TIcon className="size-3" />{tText}</span>
                    </div>
                  </div>
                  <div className="grid grid-cols-4 gap-1 mb-1">
                    <Cell2 label="গড়" value={`${bnNum(s.avg.toFixed(1))}%`} />
                    <Cell2 label="সর্বোচ্চ" value={`${bnNum(s.best.toFixed(1))}%`} />
                    <Cell2 label="সর্বনিম্ন" value={`${bnNum(s.worst.toFixed(1))}%`} />
                    <Cell2 label="পরীক্ষা" value={bnNum(s.count)} />
                  </div>
                  <p className="text-muted-foreground">{status.comment}</p>
                </li>
              );
            })}
          </ul>
        </div>
      </div>

      <style>{`
        @media print {
          @page { size: A4; margin: 10mm; }
          body * { visibility: hidden; }
          .print-area, .print-area * { visibility: visible; }
          .print-area { position: absolute; left: 0; top: 0; width: 210mm; }
        }
      `}</style>
    </>
  );
}

function Cell2({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-academy-soft/60 rounded px-1.5 py-1 text-center">
      <div className="text-[9px] text-muted-foreground">{label}</div>
      <div className="font-bold text-academy-navy text-xs">{value}</div>
    </div>
  );
}
