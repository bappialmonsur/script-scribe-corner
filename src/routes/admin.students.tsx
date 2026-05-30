import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Loader2, Search, Trash2, Users, UserPlus, Phone, PowerOff, Power, Pencil } from "lucide-react";

export const Route = createFileRoute("/admin/students")({
  component: StudentsPage,
});

const BATCH_LABEL: Record<string, string> = { morning: "সকাল", afternoon: "বিকাল", evening: "সন্ধ্যা" };
const DEPT_LABEL: Record<string, string> = { science: "বিজ্ঞান", business: "ব্যবসায়", none: "—" };
const CLASSES = ["5", "6", "7", "8", "9", "10", "11", "12"];
const toBn = (s: string) => s.replace(/[0-9]/g, (d) => "০১২৩৪৫৬৭৮৯"[+d]);

function StudentsPage() {
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [cls, setCls] = useState<string>("all");
  const [batch, setBatch] = useState<string>("all");
  const [dept, setDept] = useState<string>("all");
  const [status, setStatus] = useState<string>("active");
  const [editing, setEditing] = useState<any | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["students", cls, batch, dept, status],
    queryFn: async () => {
      let query = supabase.from("students").select("*").order("created_at", { ascending: false });
      if (cls !== "all") query = query.eq("class_level", cls as any);
      if (batch !== "all") query = query.eq("batch", batch as any);
      if (dept !== "all") query = query.eq("department", dept as any);
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

      <div className="bg-white rounded-2xl border p-4 grid sm:grid-cols-2 lg:grid-cols-5 gap-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input placeholder="নাম/ফোন খুঁজুন" className="pl-9" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <Select value={cls} onValueChange={setCls}>
          <SelectTrigger><SelectValue placeholder="শ্রেণি" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">সব শ্রেণি</SelectItem>
            {CLASSES.map(c => <SelectItem key={c} value={c}>{toBn(c)}ম</SelectItem>)}
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
        <Select value={dept} onValueChange={setDept}>
          <SelectTrigger><SelectValue placeholder="বিভাগ" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">সব বিভাগ</SelectItem>
            <SelectItem value="science">বিজ্ঞান</SelectItem>
            <SelectItem value="business">ব্যবসায়</SelectItem>
            <SelectItem value="none">বিভাগ নেই</SelectItem>
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
                  <TableCell>{toBn(String(s.class_level))}ম</TableCell>
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
                      <Button size="icon" variant="ghost" title="এডিট করুন" onClick={() => setEditing(s)}>
                        <Pencil className="size-4 text-blue-600" />
                      </Button>
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

      <EditStudentDialog
        student={editing}
        onClose={() => setEditing(null)}
        onSaved={() => {
          setEditing(null);
          qc.invalidateQueries({ queryKey: ["students"] });
        }}
      />
    </div>
  );
}

function EditStudentDialog({
  student,
  onClose,
  onSaved,
}: {
  student: any | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState<any>({});
  const [busy, setBusy] = useState(false);

  // sync form whenever a new student is opened
  const [lastId, setLastId] = useState<string | null>(null);
  if (student && student.id !== lastId) {
    setLastId(student.id);
    setForm({
      full_name: student.full_name ?? "",
      roll: student.roll ?? "",
      class_level: String(student.class_level ?? ""),
      batch: student.batch ?? "",
      department: student.department ?? "none",
      father_name: student.father_name ?? "",
      mother_name: student.mother_name ?? "",
      father_occupation: student.father_occupation ?? "",
      school_name: student.school_name ?? "",
      phone: student.phone ?? "",
      guardian_phone: student.guardian_phone ?? "",
      address: student.address ?? "",
    });
  }
  if (!student && lastId !== null) setLastId(null);

  const set = (k: string, v: any) => setForm((f: any) => ({ ...f, [k]: v }));
  const showDept = ["9", "10", "11", "12"].includes(String(form.class_level));

  const onSave = async () => {
    if (!form.full_name?.trim()) return toast.error("নাম আবশ্যক");
    setBusy(true);
    const payload: any = {
      full_name: form.full_name.trim(),
      roll: form.roll?.trim() || null,
      class_level: form.class_level,
      batch: form.batch,
      department: showDept ? form.department : "none",
      father_name: form.father_name?.trim() || null,
      mother_name: form.mother_name?.trim() || null,
      father_occupation: form.father_occupation?.trim() || null,
      school_name: form.school_name?.trim() || null,
      phone: form.phone?.trim() || null,
      guardian_phone: form.guardian_phone?.trim() || null,
      address: form.address?.trim() || null,
    };
    const { error } = await supabase.from("students").update(payload).eq("id", student.id);
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("তথ্য আপডেট হয়েছে");
    onSaved();
  };

  return (
    <Dialog open={!!student} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>শিক্ষার্থীর তথ্য এডিট</DialogTitle>
        </DialogHeader>
        <div className="grid md:grid-cols-2 gap-4">
          <Field label="পুরো নাম *">
            <Input value={form.full_name ?? ""} onChange={(e) => set("full_name", e.target.value)} />
          </Field>
          <Field label="রোল">
            <Input value={form.roll ?? ""} onChange={(e) => set("roll", e.target.value)} />
          </Field>
          <Field label="শ্রেণি">
            <Select value={form.class_level ?? ""} onValueChange={(v) => set("class_level", v)}>
              <SelectTrigger><SelectValue placeholder="বেছে নিন" /></SelectTrigger>
              <SelectContent>
                {CLASSES.map((c) => <SelectItem key={c} value={c}>{toBn(c)}ম শ্রেণি</SelectItem>)}
              </SelectContent>
            </Select>
          </Field>
          <Field label="ব্যাচ">
            <Select value={form.batch ?? ""} onValueChange={(v) => set("batch", v)}>
              <SelectTrigger><SelectValue placeholder="বেছে নিন" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="morning">সকাল</SelectItem>
                <SelectItem value="afternoon">বিকাল</SelectItem>
                <SelectItem value="evening">সন্ধ্যা</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          {showDept && (
            <Field label="বিভাগ">
              <Select value={form.department ?? "none"} onValueChange={(v) => set("department", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">প্রযোজ্য নয়</SelectItem>
                  <SelectItem value="science">বিজ্ঞান</SelectItem>
                  <SelectItem value="business">ব্যবসায় শিক্ষা</SelectItem>
                </SelectContent>
              </Select>
            </Field>
          )}
          <Field label="শিক্ষার্থীর ফোন">
            <Input value={form.phone ?? ""} onChange={(e) => set("phone", e.target.value)} placeholder="01XXXXXXXXX" />
          </Field>
          <Field label="অভিভাবকের ফোন">
            <Input value={form.guardian_phone ?? ""} onChange={(e) => set("guardian_phone", e.target.value)} />
          </Field>
          <Field label="বাবার নাম">
            <Input value={form.father_name ?? ""} onChange={(e) => set("father_name", e.target.value)} />
          </Field>
          <Field label="মায়ের নাম">
            <Input value={form.mother_name ?? ""} onChange={(e) => set("mother_name", e.target.value)} />
          </Field>
          <Field label="পিতার পেশা">
            <Input value={form.father_occupation ?? ""} onChange={(e) => set("father_occupation", e.target.value)} />
          </Field>
          <Field label="স্কুলের নাম">
            <Input value={form.school_name ?? ""} onChange={(e) => set("school_name", e.target.value)} />
          </Field>
        </div>
        <Field label="ঠিকানা">
          <Textarea value={form.address ?? ""} onChange={(e) => set("address", e.target.value)} rows={2} />
        </Field>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={busy}>বাতিল</Button>
          <Button className="bg-academy-navy text-white" onClick={onSave} disabled={busy}>
            {busy && <Loader2 className="animate-spin" />} সংরক্ষণ
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-sm">{label}</Label>
      {children}
    </div>
  );
}
