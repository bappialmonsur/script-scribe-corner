import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Loader2, ShieldCheck, Phone } from "lucide-react";
import { normalizeBdPhone } from "@/lib/phone";
import { bootstrapAdminAccount, checkAdminExists } from "@/lib/admin.functions";
import { teacherSignup } from "@/lib/teacher.functions";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [{ title: "লগইন — সমীকরণ শিক্ষা পরিবার" }],
    links: [{
      rel: "stylesheet",
      href: "https://fonts.googleapis.com/css2?family=Hind+Siliguri:wght@400;500;600;700&display=swap",
    }],
  }),
  component: LoginPage,
});

function LoginPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"login" | "bootstrap" | "teacher">("login");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [busy, setBusy] = useState(false);
  const [adminExists, setAdminExists] = useState<boolean | null>(null);

  const callBootstrap = useServerFn(bootstrapAdminAccount);
  const callCheckAdmin = useServerFn(checkAdminExists);
  const callTeacherSignup = useServerFn(teacherSignup);

  useEffect(() => {
    callCheckAdmin()
      .then((r) => setAdminExists(r.exists))
      .catch(() => setAdminExists(true));
  }, [callCheckAdmin]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const phoneE164 = normalizeBdPhone(phone);
    if (!phoneE164) {
      toast.error("সঠিক ১১ ডিজিটের ফোন নম্বর দিন (যেমন: 01712345678)");
      return;
    }
    if (password.length < 6) {
      toast.error("পাসওয়ার্ড কমপক্ষে ৬ অক্ষর");
      return;
    }

    setBusy(true);
    const syntheticEmail = `${phoneE164.replace(/\D/g, "")}@somikoron.local`;
    try {
      if (mode === "bootstrap") {
        if (fullName.trim().length < 2) {
          toast.error("পুরো নাম দিন");
          setBusy(false);
          return;
        }
        await callBootstrap({ data: { phone: phoneE164, password, full_name: fullName } });
        const { error } = await supabase.auth.signInWithPassword({ email: syntheticEmail, password });
        if (error) throw error;
        toast.success("এডমিন একাউন্ট তৈরি হয়েছে!");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email: syntheticEmail, password });
        if (error) throw error;
        toast.success("সফলভাবে লগইন হয়েছেন");
      }
      // Route by role
      const { data: { user } } = await supabase.auth.getUser();
      let dest: "/admin" | "/student" = "/student";
      if (user) {
        const { data: roleRow } = await supabase.from("user_roles").select("role").eq("user_id", user.id).eq("role", "admin").maybeSingle();
        if (roleRow) dest = "/admin";
      }
      navigate({ to: dest });
    } catch (err: any) {
      toast.error(err.message ?? "ত্রুটি হয়েছে");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center bg-academy-soft p-4"
      style={{ fontFamily: "'Hind Siliguri', sans-serif" }}
    >
      <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl p-8 border border-academy-navy/10">
        <Link to="/" className="flex items-center gap-2 mb-6 text-academy-navy">
          <div className="size-10 rounded-xl bg-academy-navy text-white flex items-center justify-center font-bold">স</div>
          <div>
            <div className="font-bold">সমীকরণ শিক্ষা পরিবার</div>
            <div className="text-xs text-muted-foreground">লগইন প্যানেল</div>
          </div>
        </Link>

        {adminExists === false ? (
          <Tabs value={mode} onValueChange={(v) => setMode(v as any)}>
            <TabsList className="grid grid-cols-2 w-full mb-6">
              <TabsTrigger value="login">লগইন</TabsTrigger>
              <TabsTrigger value="bootstrap">প্রথম এডমিন তৈরি</TabsTrigger>
            </TabsList>
            <FormBody {...{ mode, phone, setPhone, password, setPassword, fullName, setFullName, busy, handleSubmit }} />
          </Tabs>
        ) : (
          <FormBody {...{ mode: "login", phone, setPhone, password, setPassword, fullName, setFullName, busy, handleSubmit }} />
        )}

        <div className="mt-6 p-3 bg-academy-soft rounded-lg flex gap-2 text-xs text-muted-foreground">
          <ShieldCheck className="size-4 text-academy-gold shrink-0 mt-0.5" />
          <p>
            শিক্ষার্থী: ভর্তি ফরমে দেওয়া ফোন নম্বর ও এডমিন কর্তৃক সেট করা পাসওয়ার্ড দিয়ে লগইন করুন।
          </p>
        </div>
      </div>
    </div>
  );
}

function FormBody(props: {
  mode: "login" | "bootstrap";
  phone: string; setPhone: (v: string) => void;
  password: string; setPassword: (v: string) => void;
  fullName: string; setFullName: (v: string) => void;
  busy: boolean;
  handleSubmit: (e: FormEvent) => void;
}) {
  const { mode, phone, setPhone, password, setPassword, fullName, setFullName, busy, handleSubmit } = props;
  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {mode === "bootstrap" && (
        <div className="space-y-2">
          <Label htmlFor="name">পুরো নাম</Label>
          <Input id="name" value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="আপনার নাম" />
        </div>
      )}
      <div className="space-y-2">
        <Label htmlFor="phone">ফোন নম্বর</Label>
        <div className="relative">
          <Phone className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            id="phone"
            inputMode="numeric"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="01712345678"
            className="pl-9"
            required
          />
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="password">পাসওয়ার্ড</Label>
        <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" required />
      </div>
      <Button type="submit" disabled={busy} className="w-full bg-academy-navy hover:bg-academy-navy/90 text-white">
        {busy && <Loader2 className="animate-spin" />}
        {mode === "bootstrap" ? "এডমিন একাউন্ট তৈরি করুন" : "লগইন করুন"}
      </Button>
    </form>
  );
}
