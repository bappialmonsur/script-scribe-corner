import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSession } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { CalendarCheck, Loader2, Check, X, ChevronLeft, ChevronRight } from "lucide-react";
import { bnNum } from "@/lib/grading";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/student/attendance")({
  component: StudentAttendance,
});

const BN_MONTHS = ["জানুয়ারি","ফেব্রুয়ারি","মার্চ","এপ্রিল","মে","জুন","জুলাই","আগস্ট","সেপ্টেম্বর","অক্টোবর","নভেম্বর","ডিসেম্বর"];
const BN_DAYS = ["রবি","সোম","মঙ্গল","বুধ","বৃহঃ","শুক্র","শনি"];

function isoDate(d: Date) { return d.toISOString().slice(0, 10); }

function StudentAttendance() {
  const { user } = useSession();
  const [cursor, setCursor] = useState(() => { const d = new Date(); d.setDate(1); return d; });

  const { data: student } = useQuery({
    queryKey: ["my-student-att", user?.id],
    enabled: !!user,
    queryFn: async () => (await supabase.from("students").select("id").eq("user_id", user!.id).maybeSingle()).data,
  });

  const monthStart = useMemo(() => new Date(cursor.getFullYear(), cursor.getMonth(), 1), [cursor]);
  const monthEnd = useMemo(() => new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0), [cursor]);

  const { data: records, isLoading } = useQuery({
    queryKey: ["my-attendance", student?.id, isoDate(monthStart), isoDate(monthEnd)],
    enabled: !!student,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("attendance")
        .select("*")
        .eq("student_id", student!.id)
        .gte("date", isoDate(monthStart))
        .lte("date", isoDate(monthEnd))
        .order("date");
      if (error) throw error;
      return data;
    },
  });

  const map = useMemo(() => {
    const m = new Map<string, { status: string; reason: string | null }>();
    records?.forEach((r) => m.set(r.date, { status: r.status, reason: r.reason }));
    return m;
  }, [records]);

  // Build calendar grid
  const cells = useMemo(() => {
    const firstWeekday = monthStart.getDay();
    const totalDays = monthEnd.getDate();
    const arr: ({ date: Date; iso: string } | null)[] = [];
    for (let i = 0; i < firstWeekday; i++) arr.push(null);
    for (let d = 1; d <= totalDays; d++) {
      const dt = new Date(cursor.getFullYear(), cursor.getMonth(), d);
      arr.push({ date: dt, iso: isoDate(dt) });
    }
    return arr;
  }, [cursor, monthStart, monthEnd]);

  const presentCount = records?.filter((r) => r.status === "present").length ?? 0;
  const absentCount = records?.filter((r) => r.status === "absent").length ?? 0;

  const [selected, setSelected] = useState<string | null>(null);
  const sel = selected ? map.get(selected) : null;

  return (
    <div className="space-y-4 max-w-3xl">
      <div className="flex items-center gap-3">
        <div className="size-10 rounded-xl bg-green-500/15 text-green-600 flex items-center justify-center">
          <CalendarCheck />
        </div>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-academy-navy">উপস্থিতি</h1>
          <p className="text-sm text-muted-foreground">তারিখ অনুযায়ী আপনার হাজিরা</p>
        </div>
      </div>

      <div className="bg-white rounded-2xl border p-4">
        <div className="flex items-center justify-between mb-4">
          <Button variant="ghost" size="icon" onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1))}>
            <ChevronLeft />
          </Button>
          <div className="font-bold text-academy-navy">
            {BN_MONTHS[cursor.getMonth()]} {bnNum(cursor.getFullYear())}
          </div>
          <Button variant="ghost" size="icon" onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1))}>
            <ChevronRight />
          </Button>
        </div>

        <div className="flex gap-2 mb-4 text-xs">
          <span className="px-2 py-1 rounded-full bg-green-500/15 text-green-700">উপস্থিত: {bnNum(presentCount)}</span>
          <span className="px-2 py-1 rounded-full bg-red-500/15 text-red-700">অনুপস্থিত: {bnNum(absentCount)}</span>
        </div>

        {isLoading ? (
          <div className="p-8 flex justify-center"><Loader2 className="animate-spin" /></div>
        ) : (
          <>
            <div className="grid grid-cols-7 gap-1 text-center text-[10px] text-muted-foreground mb-1">
              {BN_DAYS.map((d) => <div key={d}>{d}</div>)}
            </div>
            <div className="grid grid-cols-7 gap-1">
              {cells.map((c, i) => {
                if (!c) return <div key={i} />;
                const rec = map.get(c.iso);
                const isSel = selected === c.iso;
                const bg = rec?.status === "present" ? "bg-green-500 text-white"
                  : rec?.status === "absent" ? "bg-red-500 text-white"
                  : "bg-academy-soft text-academy-navy/60";
                return (
                  <button
                    key={c.iso}
                    onClick={() => setSelected(c.iso === selected ? null : c.iso)}
                    className={`aspect-square rounded-lg text-sm font-medium flex flex-col items-center justify-center ${bg} ${isSel ? "ring-2 ring-academy-gold" : ""}`}
                  >
                    <span>{bnNum(c.date.getDate())}</span>
                    {rec?.status === "present" && <Check className="size-3" />}
                    {rec?.status === "absent" && <X className="size-3" />}
                  </button>
                );
              })}
            </div>
          </>
        )}
      </div>

      {selected && (
        <div className="bg-white rounded-2xl border p-4">
          <div className="text-sm text-muted-foreground">{new Date(selected).toLocaleDateString("bn-BD", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}</div>
          {sel ? (
            <div className="mt-2">
              <span className={`px-3 py-1 rounded-full text-sm font-bold ${sel.status === "present" ? "bg-green-500/15 text-green-700" : "bg-red-500/15 text-red-700"}`}>
                {sel.status === "present" ? "উপস্থিত" : "অনুপস্থিত"}
              </span>
              {sel.reason && <p className="mt-2 text-sm text-muted-foreground">কারণ: {sel.reason}</p>}
            </div>
          ) : (
            <div className="mt-2 text-sm text-muted-foreground">এই তারিখে হাজিরা নেওয়া হয়নি</div>
          )}
        </div>
      )}
    </div>
  );
}
