import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { useServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Loader2, UserPlus } from "lucide-react";
import { createStudentAccount } from "@/lib/admin.functions";
import { normalizeBdPhone, defaultStudentPassword } from "@/lib/phone";

export const Route = createFileRoute("/admin/admission")({
  component: AdmissionPage,
});

const CLASSES = ["5", "6", "7", "8", "9", "10", "11", "12"] as const;
const BATCHES = [
  { value: "morning", label: "সকাল" },
  { value: "afternoon", label: "বিকাল" },
  { value: "evening", label: "সন্ধ্যা" },
] as const;
const DEPTS = [
  { value: "none", label: "প্রযোজ্য নয়" },
  { value: "science", label: "বিজ্ঞান" },
  { value: "business", label: "ব্যবসায় শিক্ষা" },
] as const;

const schema = z.object({
  full_name: z.string().trim().min(2, "নাম দিন").max(100),
  father_name: z.string().trim().max(100).optional(),
  mother_name: z.string().trim().max(100).optional(),
  father_occupation: z.string().trim().max(100).optional(),
  school_name: z.string().trim().max(150).optional(),
  phone: z.string().trim().min(11, "ফোন নম্বর আবশ্যক"),
  guardian_phone: z.string().trim().max(20).optional(),
  class_level: z.enum(CLASSES, { message: "শ্রেণি নির্বাচন করুন" }),
  batch: z.enum(["morning", "afternoon", "evening"], { message: "ব্যাচ নির্বাচন করুন" }),
  department: z.enum(["none", "science", "business"]),
  address: z.string().trim().max(500).optional(),
});

const empty = {
  full_name: "", father_name: "", mother_name: "", father_occupation: "", school_name: "",
  phone: "", guardian_phone: "",
  class_level: "" as any, batch: "" as any, department: "none" as const, address: "",
};

function AdmissionPage() {
  const navigate = useNavigate();
  const [form, setForm] = useState<any>(empty);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ roll: string; phone: string; password: string } | null>(null);
  const set = (k: string, v: any) => setForm((f: any) => ({ ...f, [k]: v }));
  const submitFn = useServerFn(createStudentAccount);

  const showDept = ["9", "10", "11", "12"].includes(form.class_level);
  const phoneE164 = normalizeBdPhone(form.phone);
  const previewPassword = phoneE164 ? defaultStudentPassword(phoneE164) : "";

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const parsed = schema.safeParse(form);
    if (!parsed.success) {
      toast.error(parsed.error.issues[0].message);
      return;
    }
    if (!normalizeBdPhone(parsed.data.phone)) {
      toast.error("সঠিক ১১ ডিজিটের ফোন দিন (০১...)");
      return;
    }
    setBusy(true);
    try {
      const res = await submitFn({
        data: {
          ...parsed.data,
          father_name: parsed.data.father_name ?? "",
          mother_name: parsed.data.mother_name ?? "",
          father_occupation: parsed.data.father_occupation ?? "",
          school_name: parsed.data.school_name ?? "",
          guardian_phone: parsed.data.guardian_phone ?? "",
          address: parsed.data.address ?? "",
          department: showDept ? parsed.data.department : "none",
        } as any,
      });
      setResult({ roll: res.roll ?? "", phone: res.phone, password: res.password });
      toast.success(`ভর্তি সম্পন্ন — রোল: ${res.roll}`);
    } catch (err: any) {
      toast.error(err.message ?? "ত্রুটি হয়েছে");
    } finally {
      setBusy(false);
    }
  };

  if (result) {
    return (
      <div className="max-w-xl">
        <div className="bg-white p-6 rounded-2xl border shadow-sm">
          <div className="size-12 rounded-full bg-green-100 text-green-700 flex items-center justify-center mx-auto mb-3">
            ✓
          </div>
          <h1 className="text-xl font-bold text-academy-navy text-center mb-2">ভর্তি সফল হয়েছে</h1>
          <div className="mt-4 space-y-2 text-sm bg-academy-soft p-4 rounded-lg">
            <div className="flex justify-between"><span className="text-muted-foreground">রোল নম্বর</span><span className="font-bold text-academy-navy">{result.roll}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">লগইন ফোন</span><span className="font-mono">{result.phone}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">পাসওয়ার্ড</span><span className="font-mono font-bold text-academy-gold">{result.password}</span></div>
          </div>
          <p className="text-xs text-muted-foreground mt-3 text-center">
            পাসওয়ার্ড = মোবাইল নম্বরের শেষ ৬ ডিজিট। শিক্ষার্থীকে জানিয়ে দিন।
          </p>
          <div className="flex gap-2 mt-5">
            <Button onClick={() => { setResult(null); setForm(empty); }} className="bg-academy-navy text-white flex-1">আরো ভর্তি</Button>
            <Button variant="outline" onClick={() => navigate({ to: "/admin/students" })} className="flex-1">সকল শিক্ষার্থী</Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl">
      <div className="flex items-center gap-3 mb-6">
        <div className="size-10 rounded-xl bg-academy-gold/15 text-academy-gold flex items-center justify-center">
          <UserPlus />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-academy-navy">ছাত্রছাত্রী ভর্তি</h1>
          <p className="text-sm text-muted-foreground">রোল নম্বর স্বয়ংক্রিয়ভাবে তৈরি হবে</p>
        </div>
      </div>

      <form onSubmit={onSubmit} className="bg-white p-6 rounded-2xl border shadow-sm space-y-5">
        <div className="grid md:grid-cols-2 gap-4">
          <Field label="পুরো নাম *">
            <Input value={form.full_name} onChange={(e) => set("full_name", e.target.value)} required />
          </Field>
          <Field label="শ্রেণি *">
            <Select value={form.class_level} onValueChange={(v) => set("class_level", v)}>
              <SelectTrigger><SelectValue placeholder="বেছে নিন" /></SelectTrigger>
              <SelectContent>
                {CLASSES.map((c) => <SelectItem key={c} value={c}>{c.replace(/[0-9]/g,d=>"০১২৩৪৫৬৭৮৯"[+d])}ম শ্রেণি</SelectItem>)}
              </SelectContent>
            </Select>
          </Field>
          <Field label="ব্যাচ *">
            <Select value={form.batch} onValueChange={(v) => set("batch", v)}>
              <SelectTrigger><SelectValue placeholder="বেছে নিন" /></SelectTrigger>
              <SelectContent>
                {BATCHES.map((b) => <SelectItem key={b.value} value={b.value}>{b.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </Field>
          {showDept && (
            <Field label="বিভাগ">
              <Select value={form.department} onValueChange={(v) => set("department", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {DEPTS.map((d) => <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>
          )}
          <Field label="বাবার নাম">
            <Input value={form.father_name} onChange={(e) => set("father_name", e.target.value)} />
          </Field>
          <Field label="মায়ের নাম">
            <Input value={form.mother_name} onChange={(e) => set("mother_name", e.target.value)} />
          </Field>
          <Field label="শিক্ষার্থীর ফোন (লগইনের জন্য) *">
            <Input value={form.phone} onChange={(e) => set("phone", e.target.value)} placeholder="01XXXXXXXXX" required />
          </Field>
          <Field label="অভিভাবকের ফোন">
            <Input value={form.guardian_phone} onChange={(e) => set("guardian_phone", e.target.value)} />
          </Field>
          <Field label="পিতার পেশা">
            <Input value={form.father_occupation} onChange={(e) => set("father_occupation", e.target.value)} />
          </Field>
          <Field label="স্কুলের নাম">
            <Input value={form.school_name} onChange={(e) => set("school_name", e.target.value)} />
          </Field>
        </div>

        <Field label="ঠিকানা">
          <Textarea value={form.address} onChange={(e) => set("address", e.target.value)} rows={2} />
        </Field>

        <div className="border-t pt-4 bg-academy-soft -mx-6 px-6 py-4 rounded-b-2xl">
          <p className="text-sm font-semibold text-academy-navy">স্বয়ংক্রিয় পাসওয়ার্ড</p>
          <p className="text-xs text-muted-foreground mt-1">
            পাসওয়ার্ড = মোবাইল নম্বরের শেষ ৬ ডিজিট
            {previewPassword && <> — যেমন: <span className="font-mono font-bold text-academy-gold">{previewPassword}</span></>}
          </p>
        </div>

        <div className="flex gap-3 pt-2">
          <Button type="submit" disabled={busy} className="bg-academy-navy text-white">
            {busy && <Loader2 className="animate-spin" />}
            ভর্তি সম্পন্ন করুন
          </Button>
          <Button type="button" variant="outline" onClick={() => setForm(empty)}>রিসেট</Button>
        </div>
      </form>
    </div>
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
