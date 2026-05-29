import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { CalendarSearch, MessageSquare, Loader2, Phone } from "lucide-react";

export const Route = createFileRoute("/admin/absent")({
  component: AbsentPage,
});

const today = () => new Date().toISOString().slice(0, 10);
const BATCH: Record<string, string> = { morning: "সকাল", afternoon: "বিকাল", evening: "সন্ধ্যা" };

function AbsentPage() {
  const [date, setDate] = useState(today());
  const [cls, setCls] = useState<string>("all");

  const { data, isLoading } = useQuery({
    queryKey: ["absent", date, cls],
    queryFn: async () => {
      let q = supabase
        .from("attendance")
        .select("id, reason, class_level, students!inner(id, full_name, roll, batch, phone, guardian_phone, is_active)")
        .eq("date", date)
        .eq("status", "absent")
        .eq("students.is_active", true);
      if (cls !== "all") q = q.eq("class_level", cls as any);
      const { data, error } = await q;
      if (error) throw error;
      return data;
    },
  });

  const grouped = (data ?? []).reduce<Record<string, any[]>>((acc, r) => {
    const k = r.class_level;
    (acc[k] ??= []).push(r);
    return acc;
  }, {});

  const sendSMS = (phone: string | null, name: string) => {
    if (!phone) return;
    const msg = encodeURIComponent(`প্রিয় অভিভাবক, ${date} তারিখে ${name} অনুপস্থিত ছিল। — সমীকরণ শিক্ষা পরিবার`);
    window.open(`sms:${phone}?body=${msg}`, "_blank");
  };

  return (
    <div className="space-y-4 max-w-5xl">
      <div className="flex items-center gap-3">
        <div className="size-10 rounded-xl bg-red-500/15 text-red-600 flex items-center justify-center">
          <CalendarSearch />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-academy-navy">অনুপস্থিতি ট্র্যাকার</h1>
          <p className="text-sm text-muted-foreground">তারিখ অনুযায়ী অনুপস্থিতের তালিকা</p>
        </div>
      </div>

      <div className="bg-white rounded-2xl border p-4 grid sm:grid-cols-2 gap-3">
        <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        <Select value={cls} onValueChange={setCls}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">সব শ্রেণি</SelectItem>
            {["5","6","7","8","9","10","11","12"].map(c => <SelectItem key={c} value={c}>{c.replace(/[0-9]/g,d=>"০১২৩৪৫৬৭৮৯"[+d])}ম শ্রেণি</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="bg-white p-12 rounded-2xl border flex justify-center"><Loader2 className="animate-spin" /></div>
      ) : (data?.length ?? 0) === 0 ? (
        <div className="bg-white p-12 rounded-2xl border text-center text-muted-foreground">
          এই তারিখে কোনো অনুপস্থিতির রেকর্ড নেই
        </div>
      ) : (
        Object.entries(grouped).sort().map(([cls, items]) => (
          <div key={cls} className="bg-white rounded-2xl border overflow-hidden">
            <div className="bg-academy-soft px-4 py-2 font-bold text-academy-navy flex items-center justify-between">
              <span>{cls.replace(/[0-9]/g,d=>"০১২৩৪৫৬৭৮৯"[+d])}ম শ্রেণি</span>
              <span className="text-sm text-muted-foreground">{items.length} জন অনুপস্থিত</span>
            </div>
            <div className="divide-y">
              {items.map((r: any) => {
                const s = r.students;
                if (!s) return null;
                const phone = s.guardian_phone || s.phone;
                return (
                  <div key={r.id} className="p-3 flex flex-col sm:flex-row sm:items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-academy-navy">{s.full_name}</div>
                      <div className="text-xs text-muted-foreground">
                        {s.roll && `রোল: ${s.roll} • `}{BATCH[s.batch]}
                      </div>
                      {r.reason && <div className="text-sm mt-1 text-red-600">কারণ: {r.reason}</div>}
                    </div>
                    {phone && (
                      <div className="flex gap-2">
                        <a href={`tel:${phone}`}>
                          <Button size="sm" variant="outline"><Phone className="size-3" /> কল</Button>
                        </a>
                        <Button size="sm" variant="outline" onClick={() => sendSMS(phone, s.full_name)}>
                          <MessageSquare className="size-3" /> SMS
                        </Button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))
      )}
    </div>
  );
}
