import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { toast } from "sonner";
import { Loader2, Search, Trash2, Users, UserPlus, Phone, PowerOff, Power } from "lucide-react";

export const Route = createFileRoute("/admin/students")({
  component: StudentsPage,
});

const BATCH_LABEL: Record<string, string> = { morning: "সকাল", afternoon: "বিকাল", evening: "সন্ধ্যা" };
const DEPT_LABEL: Record<string, string> = { science: "বিজ্ঞান", business: "ব্যবসায়", none: "—" };

function StudentsPage() {
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [cls, setCls] = useState<string>("all");
  const [batch, setBatch] = useState<string>("all");
  const [status, setStatus] = useState<string>("active");

  const { data, isLoading } = useQuery({
    queryKey: ["students", cls, batch, status],
    queryFn: async () => {
      let query = supabase.from("students").select("*").order("created_at", { ascending: false });
      if (cls !== "all") query = query.eq("class_level", cls as any);
      if (batch !== "all") query = query.eq("batch", batch as any);
      if (status === "active") query = query.eq("is_active", true);
      else if (status === "inactive") query = query.eq("is_active", false);
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });

  const filtered = data?.filter((s) =>
    !q || s.full_name.toLowerCase().includes(q.toLowerCase()) || (s.phone ?? "").includes(q),
  );

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`"${name}" কে স্থায়ীভাবে মুছে ফেলবেন? এই কাজ ফেরানো যাবে না।`)) return;
    const { error } = await supabase.from("students").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("মুছে ফেলা হয়েছে");
    qc.invalidateQueries({ queryKey: ["students"] });
  };

  const handleToggleActive = async (id: string, current: boolean, name: string) => {
    const next = !current;
    const msg = next
      ? `"${name}" কে আবার এক্টিভ করবেন?`
      : `"${name}" কে ইনএক্টিভ করবেন? উপস্থিতি ও ফলাফলে দেখা যাবে না (ডেটা থেকে যাবে)।`;
    if (!confirm(msg)) return;
    const { error } = await supabase.from("students").update({ is_active: next }).eq("id", id);
    if (error) return toast.error(error.message);
    toast.success(next ? "এক্টিভ করা হয়েছে" : "ইনএক্টিভ করা হয়েছে");
    qc.invalidateQueries({ queryKey: ["students"] });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 flex-wrap">
        <div className="size-10 rounded-xl bg-blue-500/15 text-blue-600 flex items-center justify-center">
          <Users />
        </div>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-academy-navy">সকল শিক্ষার্থী</h1>
          <p className="text-sm text-muted-foreground">{filtered?.length ?? 0} জন</p>
        </div>
        <Link to="/admin/admission">
          <Button className="bg-academy-navy text-white"><UserPlus /> নতুন ভর্তি</Button>
        </Link>
      </div>

      <div className="bg-white rounded-2xl border p-4 grid sm:grid-cols-4 gap-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input placeholder="নাম/ফোন খুঁজুন" className="pl-9" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <Select value={cls} onValueChange={setCls}>
          <SelectTrigger><SelectValue placeholder="শ্রেণি" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">সব শ্রেণি</SelectItem>
            {["5","6","7","8","9","10","11","12"].map(c => <SelectItem key={c} value={c}>{c.replace(/[0-9]/g,d=>"০১২৩৪৫৬৭৮৯"[+d])}ম</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={batch} onValueChange={setBatch}>
          <SelectTrigger><SelectValue placeholder="ব্যাচ" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">সব ব্যাচ</SelectItem>
            <SelectItem value="morning">সকাল</SelectItem>
            <SelectItem value="afternoon">বিকাল</SelectItem>
            <SelectItem value="evening">সন্ধ্যা</SelectItem>
          </SelectContent>
        </Select>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="active">শুধু এক্টিভ</SelectItem>
            <SelectItem value="inactive">শুধু ইনএক্টিভ</SelectItem>
            <SelectItem value="all">সবাই</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="bg-white rounded-2xl border overflow-hidden">
        {isLoading ? (
          <div className="p-12 flex justify-center"><Loader2 className="animate-spin" /></div>
        ) : (filtered?.length ?? 0) === 0 ? (
          <div className="p-12 text-center text-muted-foreground">কোনো শিক্ষার্থী পাওয়া যায়নি</div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>নাম</TableHead>
                <TableHead>শ্রেণি</TableHead>
                <TableHead>ব্যাচ</TableHead>
                <TableHead>বিভাগ</TableHead>
                <TableHead>ফোন</TableHead>
                <TableHead>স্ট্যাটাস</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered!.map((s: any) => (
                <TableRow key={s.id} className={s.is_active === false ? "opacity-60" : ""}>
                  <TableCell>
                    <div className="font-medium text-academy-navy">{s.full_name}</div>
                    {s.roll && <div className="text-xs text-muted-foreground">রোল: {s.roll}</div>}
                  </TableCell>
                  <TableCell>{String(s.class_level).replace(/[0-9]/g,d=>"০১২৩৪৫৬৭৮৯"[+d])}ম</TableCell>
                  <TableCell>{BATCH_LABEL[s.batch]}</TableCell>
                  <TableCell>{DEPT_LABEL[s.department]}</TableCell>
                  <TableCell>
                    {s.guardian_phone || s.phone ? (
                      <a href={`tel:${s.guardian_phone || s.phone}`} className="text-academy-navy hover:text-academy-gold flex items-center gap-1 text-sm">
                        <Phone className="size-3" /> {s.guardian_phone || s.phone}
                      </a>
                    ) : "—"}
                  </TableCell>
                  <TableCell>
                    {s.is_active === false ? (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-gray-200 text-gray-700">ইনএক্টিভ</span>
                    ) : (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700">এক্টিভ</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button
                        size="icon"
                        variant="ghost"
                        title={s.is_active === false ? "এক্টিভ করুন" : "ইনএক্টিভ করুন"}
                        onClick={() => handleToggleActive(s.id, s.is_active !== false, s.full_name)}
                      >
                        {s.is_active === false
                          ? <Power className="size-4 text-green-600" />
                          : <PowerOff className="size-4 text-amber-600" />}
                      </Button>
                      <Button size="icon" variant="ghost" title="মুছে ফেলুন" onClick={() => handleDelete(s.id, s.full_name)}>
                        <Trash2 className="size-4 text-red-500" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  );
}
