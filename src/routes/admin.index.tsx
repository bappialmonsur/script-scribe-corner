import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { UserPlus, Users, ClipboardCheck, CalendarSearch, BookUser, GraduationCap, Printer, MessageSquare } from "lucide-react";
import { FeatureCards } from "@/components/feature-cards";

export const Route = createFileRoute("/admin/")({
  component: Dashboard,
});

const today = () => new Date().toISOString().slice(0, 10);

function Dashboard() {
  const { data: stats } = useQuery({
    queryKey: ["admin-stats"],
    queryFn: async () => {
      const [studentsRes, todayRes, absentTodayRes] = await Promise.all([
        supabase.from("students").select("id", { count: "exact", head: true }).eq("is_active", true),
        supabase.from("attendance").select("id", { count: "exact", head: true }).eq("date", today()),
        supabase.from("attendance").select("id", { count: "exact", head: true }).eq("date", today()).eq("status", "absent"),
      ]);
      return {
        total: studentsRes.count ?? 0,
        marked: todayRes.count ?? 0,
        absent: absentTodayRes.count ?? 0,
      };
    },
  });

  const cards = [
    { label: "মোট শিক্ষার্থী", value: stats?.total ?? "—", icon: Users, color: "bg-blue-500" },
    { label: "আজ হাজিরা নেওয়া", value: stats?.marked ?? "—", icon: ClipboardCheck, color: "bg-green-500" },
    { label: "আজ অনুপস্থিত", value: stats?.absent ?? "—", icon: CalendarSearch, color: "bg-red-500" },
  ];

  const quickLinks = [
    { to: "/admin/admission", label: "নতুন ভর্তি", icon: UserPlus },
    { to: "/admin/attendance", label: "হাজিরা নিন", icon: ClipboardCheck },
    { to: "/admin/students", label: "শিক্ষার্থী তালিকা", icon: Users },
    { to: "/admin/phonebook", label: "ফোনবুক", icon: BookUser },
    { to: "/admin/absent", label: "অনুপস্থিতি দেখুন", icon: CalendarSearch },
    { to: "/admin/results", label: "পরীক্ষা ও ফলাফল", icon: GraduationCap },
    { to: "/admin/marksheet", label: "মার্কশীট প্রিন্ট", icon: Printer },
    { to: "/admin/sms", label: "এস এম এস", icon: MessageSquare },
  ];

  return (
    <div className="space-y-6 max-w-6xl">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold text-academy-navy">স্বাগতম</h1>
        <p className="text-muted-foreground">আজকের তারিখ: {new Date().toLocaleDateString("bn-BD")}</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {cards.map((c) => (
          <div key={c.label} className="bg-white p-5 rounded-2xl border shadow-sm flex items-center gap-4">
            <div className={`size-12 rounded-xl ${c.color} text-white flex items-center justify-center`}>
              <c.icon className="size-6" />
            </div>
            <div>
              <div className="text-xs text-muted-foreground">{c.label}</div>
              <div className="text-2xl font-bold text-academy-navy">{c.value}</div>
            </div>
          </div>
        ))}
      </div>

      <div>
        <h2 className="font-bold text-academy-navy mb-3">ফিচার্ড</h2>
        <FeatureCards variant="admin" />
      </div>

      <div>
        <h2 className="font-bold text-academy-navy mb-3">দ্রুত অ্যাক্সেস</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {quickLinks.map((l, i) => (
            <Link
              key={l.to}
              to={l.to}
              className="group relative overflow-hidden bg-white p-5 rounded-2xl border border-academy-navy/10 hover:border-academy-gold hover:shadow-xl hover:-translate-y-1 transition-all flex flex-col gap-3"
            >
              <div className="absolute -right-4 -top-4 size-20 rounded-full bg-academy-gold/10 group-hover:bg-academy-gold/20 transition-colors" />
              <div className="absolute right-3 top-3 text-[10px] font-bold text-academy-gold/60">
                ০{i + 1}
              </div>
              <div className="relative size-12 rounded-xl bg-gradient-to-br from-academy-navy to-academy-navy/80 text-academy-gold flex items-center justify-center shadow-md group-hover:scale-110 transition-transform">
                <l.icon className="size-6" />
              </div>
              <div className="relative">
                <div className="text-sm font-bold text-academy-navy leading-tight">{l.label}</div>
                <div className="text-xs text-muted-foreground mt-0.5 group-hover:text-academy-gold transition-colors">→</div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}

