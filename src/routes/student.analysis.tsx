import { createFileRoute } from "@tanstack/react-router";
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSession } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { BarChart3, Loader2, TrendingUp, TrendingDown, Minus } from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell, Rectangle,
} from "recharts";
import { bnNum } from "@/lib/grading";

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


export const Route = createFileRoute("/student/analysis")({
  component: StudentAnalysis,
});

function StudentAnalysis() {
  const { user } = useSession();
  const { data, isLoading } = useQuery({
    queryKey: ["my-analysis", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data: s } = await supabase.from("students").select("id, class_level").eq("user_id", user!.id).maybeSingle();
      if (!s) return [];
      const { data: exams } = await supabase
        .from("exams").select("*").eq("class_level", s.class_level).order("exam_date");
      const { data: results } = await supabase
        .from("exam_results").select("exam_id, marks").eq("student_id", s.id);
      const map = new Map(results?.map((r) => [r.exam_id, Number(r.marks)]) ?? []);
      return (exams ?? [])
        .filter((e) => map.has(e.id))
        .map((e) => ({
          id: e.id,
          subject: e.subject,
          date: e.exam_date,
          full: e.full_marks,
          marks: map.get(e.id)!,
          pct: (map.get(e.id)! / e.full_marks) * 100,
        }));
    },
  });

  // All exams by date — overall progress
  const overallData = useMemo(() =>
    (data ?? []).map((d) => ({
      label: `${d.subject.slice(0, 6)} · ${new Date(d.date).toLocaleDateString("bn-BD", { day: "numeric", month: "short" })}`,
      "শতকরা": Number(d.pct.toFixed(1)),
    })), [data]);

  // Subject-wise: avg, best, worst, count, trend, totals
  const subjectStats = useMemo(() => {
    const m = new Map<string, { pcts: number[]; dates: string[]; obtained: number; full: number }>();
    (data ?? []).forEach((d) => {
      const e = m.get(d.subject) ?? { pcts: [], dates: [], obtained: 0, full: 0 };
      e.pcts.push(d.pct);
      e.dates.push(d.date);
      e.obtained += d.marks;
      e.full += d.full;
      m.set(d.subject, e);
    });
    return Array.from(m.entries()).map(([subject, v]) => {
      const avg = v.pcts.reduce((s, x) => s + x, 0) / v.pcts.length;
      const best = Math.max(...v.pcts);
      const worst = Math.min(...v.pcts);
      let trend: "up" | "down" | "flat" = "flat";
      if (v.pcts.length >= 2) {
        const mid = Math.floor(v.pcts.length / 2);
        const firstHalf = v.pcts.slice(0, mid || 1);
        const secondHalf = v.pcts.slice(mid || 1);
        const diff =
          secondHalf.reduce((s, x) => s + x, 0) / secondHalf.length -
          firstHalf.reduce((s, x) => s + x, 0) / firstHalf.length;
        if (diff > 3) trend = "up";
        else if (diff < -3) trend = "down";
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

  // Overall comment
  const overallComment = useMemo(() => {
    if (subjectStats.length === 0) return null;
    const overallAvg = subjectStats.reduce((s, x) => s + x.avg, 0) / subjectStats.length;
    const strongest = subjectStats[0];
    const weakest = subjectStats[subjectStats.length - 1];
    const improving = subjectStats.filter((s) => s.trend === "up").map((s) => s.subject);
    const declining = subjectStats.filter((s) => s.trend === "down").map((s) => s.subject);

    const lines: string[] = [];
    lines.push(
      overallAvg >= 80 ? `অসাধারণ পারফরম্যান্স! সামগ্রিক গড় ${bnNum(overallAvg.toFixed(1))}% — এই ধারা বজায় রাখুন।`
      : overallAvg >= 60 ? `ভালো পারফরম্যান্স। সামগ্রিক গড় ${bnNum(overallAvg.toFixed(1))}% — আরও পরিশ্রম করলে A+ সম্ভব।`
      : overallAvg >= 40 ? `সামগ্রিক গড় ${bnNum(overallAvg.toFixed(1))}% — দুর্বল বিষয়গুলোতে বাড়তি মনোযোগ দিন।`
      : `সামগ্রিক গড় ${bnNum(overallAvg.toFixed(1))}% — নিয়মিত অধ্যয়ন ও শিক্ষকের সাহায্য নেওয়া জরুরি।`
    );
    if (subjectStats.length > 1) {
      lines.push(`সবচেয়ে শক্তিশালী বিষয়: ${strongest.subject} (${bnNum(strongest.avg.toFixed(1))}%)।`);
      if (weakest.avg < strongest.avg) {
        lines.push(`সবচেয়ে দুর্বল বিষয়: ${weakest.subject} (${bnNum(weakest.avg.toFixed(1))}%) — এই বিষয়ে বাড়তি সময় দিন।`);
      }
    }
    if (improving.length) lines.push(`উন্নতি হচ্ছে: ${improving.join(", ")} 👍`);
    if (declining.length) lines.push(`অবনতি লক্ষণীয়: ${declining.join(", ")} — এখনই মনোযোগ প্রয়োজন।`);
    return lines;
  }, [subjectStats]);

  return (
    <div className="space-y-4 max-w-5xl">
      <div className="flex items-center gap-3">
        <div className="size-10 rounded-xl bg-blue-500/15 text-blue-600 flex items-center justify-center">
          <BarChart3 />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-academy-navy">রেজাল্ট এনালাইসিস</h1>
          <p className="text-sm text-muted-foreground">আপনার পারফরম্যান্সের সারসংক্ষেপ</p>
        </div>
      </div>

      {isLoading ? (
        <div className="p-12 flex justify-center"><Loader2 className="animate-spin" /></div>
      ) : (data?.length ?? 0) === 0 ? (
        <div className="bg-white rounded-2xl border p-12 text-center text-muted-foreground">এনালাইসিসের জন্য পর্যাপ্ত ডেটা নেই</div>
      ) : (
        <>
          {/* Overall chart */}
          <div className="bg-white rounded-2xl border p-4">
            <h2 className="font-bold text-academy-navy mb-3">তারিখ অনুযায়ী সব পরীক্ষা (শতকরা %)</h2>
            <div className="h-72 w-full">
              <ResponsiveContainer>
                <BarChart data={overallData} margin={{ top: 10, right: 10, left: 0, bottom: 40 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
                  <XAxis dataKey="label" angle={-30} textAnchor="end" interval={0} tick={{ fontSize: 10 }} height={60} />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Bar dataKey="শতকরা" fill="#1e3a8a" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Subject-wise chart */}
          <div className="bg-white rounded-2xl border p-4">
            <h2 className="font-bold text-academy-navy mb-1">বিষয়ভিত্তিক প্রাপ্ত vs মোট নম্বর</h2>
            <p className="text-xs text-muted-foreground mb-3">প্রতিটি বিষয়ে আপনার মোট প্রাপ্ত নম্বর এবং পূর্ণমান</p>
            <div className="h-72 w-full">
              <ResponsiveContainer>
                <BarChart data={subjectBarData} margin={{ top: 36, right: 10, left: 0, bottom: 40 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
                  <XAxis dataKey="subject" angle={-20} textAnchor="end" interval={0} tick={{ fontSize: 11 }} height={60} />
                  <YAxis tick={{ fontSize: 11 }} domain={[0, (dataMax: number) => Math.ceil(dataMax * 1.2)]} />
                  <Bar
                    dataKey="মোট নম্বর"
                    fill="#cbd5e1"
                    radius={[6, 6, 0, 0]}
                    isAnimationActive={false}
                    shape={(props: Parameters<typeof renderBarShape>[0]) => renderBarShape({ ...props, payloadKey: "মোট নম্বর", inside: true, insideTextFill: "#334155", outsideTextFill: "#334155" })}
                  />
                  <Bar
                    dataKey="প্রাপ্ত নম্বর"
                    fill="#1e3a8a"
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

          {/* Subject-wise detail with comments */}
          <div className="bg-white rounded-2xl border p-4">
            <h2 className="font-bold text-academy-navy mb-3">বিষয়ভিত্তিক বিশদ মন্তব্য</h2>
            <ul className="space-y-3">
              {subjectStats.map((s) => {
                const status =
                  s.avg >= 80 ? { label: "চমৎকার", color: "bg-green-100 text-green-700", comment: `${s.subject}-এ আপনি দুর্দান্ত করছেন। এই গতি ধরে রাখুন।` }
                  : s.avg >= 60 ? { label: "ভালো", color: "bg-blue-100 text-blue-700", comment: `${s.subject}-এ ভালো করছেন, তবে আরও পরিশ্রম করলে A+ আসবে।` }
                  : s.avg >= 40 ? { label: "মাঝারি", color: "bg-amber-100 text-amber-700", comment: `${s.subject}-এ আরও মনোযোগ দিন এবং নিয়মিত অনুশীলন করুন।` }
                  : { label: "দুর্বল", color: "bg-red-100 text-red-700", comment: `${s.subject}-এ বিশেষ মনোযোগ প্রয়োজন। শিক্ষকের সাহায্য নিন।` };
                const TrendIcon = s.trend === "up" ? TrendingUp : s.trend === "down" ? TrendingDown : Minus;
                const trendColor = s.trend === "up" ? "text-green-600" : s.trend === "down" ? "text-red-600" : "text-muted-foreground";
                const trendText = s.trend === "up" ? "উন্নতি হচ্ছে" : s.trend === "down" ? "অবনতি হচ্ছে" : "স্থির";
                return (
                  <li key={s.subject} className="border rounded-xl p-3">
                    <div className="flex items-center justify-between gap-2 flex-wrap mb-2">
                      <div className="font-bold text-academy-navy">{s.subject}</div>
                      <div className="flex items-center gap-2">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${status.color}`}>{status.label}</span>
                        <span className={`text-xs flex items-center gap-1 ${trendColor}`}>
                          <TrendIcon className="size-3.5" /> {trendText}
                        </span>
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-xs mb-2">
                      <Stat label="গড়" value={`${bnNum(s.avg.toFixed(1))}%`} />
                      <Stat label="সর্বোচ্চ" value={`${bnNum(s.best.toFixed(1))}%`} />
                      <Stat label="সর্বনিম্ন" value={`${bnNum(s.worst.toFixed(1))}%`} />
                    </div>
                    <p className="text-xs text-muted-foreground">{status.comment}</p>
                  </li>
                );
              })}
            </ul>
          </div>

          {/* Overall comment */}
          {overallComment && (
            <div className="bg-gradient-to-br from-academy-soft to-white rounded-2xl border p-5">
              <h2 className="font-bold text-academy-navy mb-2">সামগ্রিক মন্তব্য</h2>
              <ul className="space-y-1.5 text-sm text-academy-navy/90">
                {overallComment.map((line, i) => <li key={i}>• {line}</li>)}
              </ul>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-academy-soft/60 rounded-lg px-2 py-1.5 text-center">
      <div className="text-[10px] text-muted-foreground">{label}</div>
      <div className="font-bold text-academy-navy">{value}</div>
    </div>
  );
}
