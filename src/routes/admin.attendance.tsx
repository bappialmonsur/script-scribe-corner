import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Loader2, ClipboardCheck, MessageSquare, Check, X } from "lucide-react";

export const Route = createFileRoute("/admin/attendance")({
  component: AttendancePage,
});

const today = () => new Date().toISOString().slice(0, 10);

type Status = "present" | "absent" | null;
type Row = { status: Status; reason: string };

function AttendancePage() {
  const qc = useQueryClient();
  const [cls, setCls] = useState<string>("");
  const [date, setDate] = useState(today());
  const [rows, setRows] = useState<Record<string, Row>>({});
  const [saving, setSaving] = useState(false);

  const { data: students, isLoading } = useQuery({
    enabled: !!cls,
    queryKey: ["attendance-students", cls],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("students").select("*").eq("class_level", cls as any).eq("is_active", true).order("full_name");
      if (error) throw error;
      return data;
    },
  });

  // Load existing attendance for the date
  const { data: existing } = useQuery({
    enabled: !!cls && !!date,
    queryKey: ["attendance-existing", cls, date],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("attendance").select("*").eq("class_level", cls as any).eq("date", date);
      if (error) throw error;
      const map: Record<string, Row> = {};
      data?.forEach((a) => { map[a.student_id] = { status: a.status as Status, reason: a.reason ?? "" }; });
      setRows(map);
      return data;
    },
  });

  const setRow = (id: string, patch: Partial<Row>) =>
    setRows((r) => ({ ...r, [id]: { status: r[id]?.status ?? null, reason: r[id]?.reason ?? "", ...patch } }));

  const summary = useMemo(() => {
    const arr = Object.values(rows);
    return {
      present: arr.filter((r) => r.status === "present").length,
      absent: arr.filter((r) => r.status === "absent").length,
    };
  }, [rows]);

  const saveAll = async () => {
    if (!students?.length) return;
    const entries = students
      .filter((s) => rows[s.id]?.status)
      .map((s) => ({
        student_id: s.id,
        class_level: cls as any,
        date,
        status: rows[s.id].status!,
        reason: rows[s.id].status === "absent" ? rows[s.id].reason || null : null,
      }));
    if (!entries.length) return toast.error("কমপক্ষে একজনের হাজিরা চিহ্নিত করুন");
    setSaving(true);
    const { error } = await supabase.from("attendance").upsert(entries, { onConflict: "student_id,date" });
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("হাজিরা সংরক্ষিত হয়েছে");
    qc.invalidateQueries({ queryKey: ["admin-stats"] });
  };

  const sendSMS = (phone: string | null, name: string) => {
    if (!phone) return toast.error("ফোন নম্বর নেই");
    const msg = encodeURIComponent(`প্রিয় অভিভাবক, আজ ${date} তারিখে ${name} অনুপস্থিত ছিল। — সমীকরণ শিক্ষা পরিবার`);
    window.open(`sms:${phone}?body=${msg}`, "_blank");
  };

  return (
    <div className="space-y-4 max-w-5xl">
      <div className="flex items-center gap-3">
        <div className="size-10 rounded-xl bg-green-500/15 text-green-600 flex items-center justify-center">
          <ClipboardCheck />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-academy-navy">দৈনিক হাজিরা</h1>
          <p className="text-sm text-muted-foreground">শ্রেণি ও তারিখ বেছে হাজিরা নিন</p>
        </div>
      </div>

      <div className="bg-white rounded-2xl border p-4 grid sm:grid-cols-3 gap-3">
        <Select value={cls} onValueChange={setCls}>
          <SelectTrigger><SelectValue placeholder="শ্রেণি নির্বাচন করুন" /></SelectTrigger>
          <SelectContent>
            {["5","6","7","8","9","10","11","12"].map(c => <SelectItem key={c} value={c}>{c.replace(/[0-9]/g,d=>"০১২৩৪৫৬৭৮৯"[+d])}ম শ্রেণি</SelectItem>)}
          </SelectContent>
        </Select>
        <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        <div className="flex items-center gap-3 text-sm">
          <span className="px-3 py-1 rounded-full bg-green-100 text-green-700">উপস্থিত: {summary.present}</span>
          <span className="px-3 py-1 rounded-full bg-red-100 text-red-700">অনুপস্থিত: {summary.absent}</span>
        </div>
      </div>

      {!cls ? (
        <div className="bg-white p-12 rounded-2xl border text-center text-muted-foreground">শ্রেণি নির্বাচন করুন</div>
      ) : isLoading ? (
        <div className="bg-white p-12 rounded-2xl border flex justify-center"><Loader2 className="animate-spin" /></div>
      ) : !students?.length ? (
        <div className="bg-white p-12 rounded-2xl border text-center text-muted-foreground">এই শ্রেণিতে কোনো শিক্ষার্থী নেই</div>
      ) : (
        <>
          <div className="bg-white rounded-2xl border divide-y">
            {students.map((s) => {
              const row = rows[s.id] ?? { status: null, reason: "" };
              return (
                <div key={s.id} className="p-3 flex flex-col sm:flex-row sm:items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-academy-navy truncate">{s.full_name}</div>
                    {s.roll && <div className="text-xs text-muted-foreground">রোল: {s.roll}</div>}
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant={row.status === "present" ? "default" : "outline"}
                      className={row.status === "present" ? "bg-green-600 hover:bg-green-700 text-white" : ""}
                      onClick={() => setRow(s.id, { status: "present", reason: "" })}
                    >
                      <Check /> উপস্থিত
                    </Button>
                    <Button
                      size="sm"
                      variant={row.status === "absent" ? "default" : "outline"}
                      className={row.status === "absent" ? "bg-red-600 hover:bg-red-700 text-white" : ""}
                      onClick={() => setRow(s.id, { status: "absent" })}
                    >
                      <X /> অনুপস্থিত
                    </Button>
                  </div>
                  {row.status === "absent" && (
                    <>
                      <Input
                        placeholder="কারণ"
                        value={row.reason}
                        onChange={(e) => setRow(s.id, { reason: e.target.value })}
                        className="sm:w-48"
                      />
                      <Button
                        size="icon"
                        variant="outline"
                        title="অভিভাবককে এসএমএস পাঠান"
                        onClick={() => sendSMS(s.guardian_phone || s.phone, s.full_name)}
                      >
                        <MessageSquare className="size-4" />
                      </Button>
                    </>
                  )}
                </div>
              );
            })}
          </div>

          <div className="flex justify-end gap-2 sticky bottom-2">
            <Button onClick={saveAll} disabled={saving} className="bg-academy-navy text-white shadow-lg">
              {saving && <Loader2 className="animate-spin" />}
              হাজিরা সংরক্ষণ করুন
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
