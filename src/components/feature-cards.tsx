import { Link } from "@tanstack/react-router";
import { UserPlus, CalendarDays, BellRing, ArrowRight, GraduationCap, MessageSquare } from "lucide-react";

type Card = {
  to: string;
  title: string;
  desc: string;
  icon: React.ElementType;
  gradient: string;
  accent: string;
};

const adminCards: Card[] = [
  {
    to: "/admin/admission",
    title: "নতুন ভর্তি",
    desc: "নতুন শিক্ষার্থী যোগ করুন",
    icon: UserPlus,
    gradient: "from-academy-navy via-academy-navy/90 to-academy-navy/70",
    accent: "text-academy-gold",
  },
  {
    to: "/admin/site",
    title: "ক্লাস রুটিন",
    desc: "সাপ্তাহিক ক্লাসের সময়সূচি",
    icon: CalendarDays,
    gradient: "from-academy-gold via-amber-500 to-orange-500",
    accent: "text-white",
  },
  {
    to: "/admin/notices",
    title: "নোটিফিকেশন",
    desc: "নোটিশ ও ঘোষণা",
    icon: BellRing,
    gradient: "from-rose-700 via-rose-600 to-academy-navy",
    accent: "text-amber-200",
  },
];

const studentCards: Card[] = [
  {
    to: "/student/results",
    title: "রেজাল্ট",
    desc: "পরীক্ষার ফলাফল দেখুন",
    icon: GraduationCap,
    gradient: "from-emerald-600 via-teal-600 to-academy-navy",
    accent: "text-white",
  },
  {
    to: "/student/attendance",
    title: "ক্লাস রুটিন",
    desc: "ক্লাস ও উপস্থিতির সময়",
    icon: CalendarDays,
    gradient: "from-academy-gold via-amber-500 to-orange-500",
    accent: "text-white",
  },
  {
    to: "/student/notices",
    title: "নোটিশ",
    desc: "সর্বশেষ নোটিশ দেখুন",
    icon: BellRing,
    gradient: "from-rose-700 via-rose-600 to-academy-navy",
    accent: "text-amber-200",
  },
  {
    to: "/student/messages",
    title: "মেসেজ",
    desc: "এডমিনের সাথে চ্যাট",
    icon: MessageSquare,
    gradient: "from-indigo-600 via-blue-600 to-academy-navy",
    accent: "text-white",
  },
];

export function FeatureCards({ variant }: { variant: "admin" | "student" }) {
  const cards = variant === "admin" ? adminCards : studentCards;
  const gridCols = cards.length === 4 ? "grid-cols-2 lg:grid-cols-4" : "grid-cols-1 md:grid-cols-3";
  return (
    <div className={`grid ${gridCols} gap-4`}>
      {cards.map((c) => (
        <Link
          key={c.title}
          to={c.to}
          className={`group relative overflow-hidden rounded-2xl bg-gradient-to-br ${c.gradient} p-5 text-white shadow-lg hover:shadow-2xl hover:-translate-y-0.5 transition-all`}
        >
          <div className="absolute -right-6 -top-6 size-28 rounded-full bg-white/10 blur-2xl group-hover:bg-white/20 transition-colors" />
          <div className="absolute -right-2 -bottom-8 size-24 rounded-full bg-black/10 blur-xl" />
          <div className="relative flex items-start justify-between gap-3">
            <div className={`size-12 rounded-xl bg-white/15 backdrop-blur flex items-center justify-center ${c.accent}`}>
              <c.icon className="size-6" />
            </div>
            <ArrowRight className="size-5 opacity-70 group-hover:translate-x-1 group-hover:opacity-100 transition-all" />
          </div>
          <div className="relative mt-5">
            <div className="text-lg font-bold leading-tight">{c.title}</div>
            <div className="text-xs opacity-80 mt-1">{c.desc}</div>
          </div>
        </Link>
      ))}
    </div>
  );
}
