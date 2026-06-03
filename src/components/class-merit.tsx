import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Trophy, Medal, Loader2 } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { bnNum } from "@/lib/grading";
import { getMonthlyClassMerit } from "@/lib/student-stats.functions";

export function useMonthlyMerit(userId?: string) {
  const fetchMerit = useServerFn(getMonthlyClassMerit);
  return useQuery({
    queryKey: ["monthly-class-merit", userId],
    enabled: !!userId,
    queryFn: () => fetchMerit(),
    staleTime: 60_000,
  });
}

const RANK_STYLE = [
  "bg-academy-gold text-academy-navy",
  "bg-slate-300 text-slate-700",
  "bg-amber-700 text-white",
];

function pct(total: number, full: number) {
  return full > 0 ? ((total / full) * 100).toFixed(1) : null;
}

/** Slim featured strip showing the class top-5 merit positions for the month. */
export function ClassMeritStrip({ userId }: { userId?: string }) {
  const { data, isLoading } = useMonthlyMerit(userId);

  if (isLoading) {
    return (
      <div className="bg-card rounded-3xl border border-border/70 shadow-sm p-6 flex justify-center">
        <Loader2 className="size-5 animate-spin text-academy-navy" />
      </div>
    );
  }
  if (!data || data.top.length === 0) return null;

  return (
    <div className="bg-card rounded-3xl border border-border/70 shadow-sm overflow-hidden">
      <div className="flex items-center gap-2 px-4 pt-3.5 pb-2">
        <Trophy className="size-4 text-academy-gold" />
        <span className="text-sm font-bold text-academy-navy">শ্রেণির মেধাতালিকা</span>
        <span className="ml-auto text-[11px] text-muted-foreground">
          {data.monthLabel} · মোট নম্বর অনুযায়ী
        </span>
      </div>
      <div className="divide-y divide-border/60">
        {data.top.map((m) => {
          const p = pct(m.total, m.fullTotal);
          const isMe = data.me && m.position === data.me.position && m.total === data.me.total;
          return (
            <div
              key={m.student_id}
              className={`flex items-center gap-3 px-4 py-2 ${isMe ? "bg-academy-gold/10" : ""}`}
            >
              <div
                className={`size-6 shrink-0 rounded-full grid place-items-center text-[11px] font-bold ${
                  RANK_STYLE[m.position - 1] ?? "bg-academy-soft text-academy-navy"
                }`}
              >
                {bnNum(m.position)}
              </div>
              <Avatar className="size-9 shrink-0">
                {m.photoUrl && <AvatarImage src={m.photoUrl} alt={m.name} />}
                <AvatarFallback className="text-xs bg-academy-soft text-academy-navy">
                  {m.name.slice(0, 1)}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-semibold text-academy-navy truncate">{m.name}</div>
                <div className="text-[11px] text-muted-foreground truncate">
                  {m.roll ? `রোল ${bnNum(m.roll)}` : ""}
                </div>
              </div>
              <div className="text-right shrink-0">
                <div className="text-sm font-bold text-academy-navy leading-none">
                  {bnNum(m.total)}
                  <span className="text-[11px] font-normal text-muted-foreground">
                    /{bnNum(m.fullTotal)}
                  </span>
                </div>
                {p && <div className="text-[10px] text-muted-foreground mt-0.5">{bnNum(p)}%</div>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** Compact position pill shown next to the notifications bell. */
export function PositionPill({ userId }: { userId?: string }) {
  const { data } = useMonthlyMerit(userId);
  if (!data?.me || data.me.position == null) return null;
  const { me } = data;
  const p = pct(me.total, me.fullTotal);
  return (
    <div
      className="flex items-center gap-1.5 rounded-full bg-academy-gold/15 border border-academy-gold/40 px-2.5 h-9 text-academy-navy"
      title={`${data.monthLabel} · মোট ${bnNum(me.total)}/${bnNum(me.fullTotal)}`}
    >
      <Medal className="size-4 text-academy-gold" />
      <span className="text-sm font-bold leading-none">
        {bnNum(me.position)}
        <span className="text-[11px] font-normal text-muted-foreground">/{bnNum(me.classSize)}</span>
      </span>
      {p && <span className="text-[10px] text-muted-foreground hidden sm:inline">· {bnNum(p)}%</span>}
    </div>
  );
}
