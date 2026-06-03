import { createFileRoute, Outlet, Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useSession } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent, SidebarGroupLabel,
  SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarProvider, SidebarTrigger,
  SidebarHeader, SidebarFooter,
} from "@/components/ui/sidebar";
import {
  Home, Bell, CalendarCheck, GraduationCap, BarChart3, FileText, LogOut, Loader2, ShieldAlert, BookOpenCheck, UserRound, Newspaper, MessageSquare,
} from "lucide-react";
import { bnClass } from "@/lib/grading";
import { NotificationsBell } from "@/components/notifications-bell";
import { PositionPill } from "@/components/class-merit";

export const Route = createFileRoute("/student")({
  head: () => ({
    meta: [{ title: "শিক্ষার্থী প্যানেল — সমীকরণ শিক্ষা পরিবার" }],
    links: [{
      rel: "stylesheet",
      href: "https://fonts.googleapis.com/css2?family=Hind+Siliguri:wght@400;500;600;700&display=swap",
    }],
  }),
  component: StudentLayout,
});

const menu = [
  { title: "নিউজফিড", url: "/student", icon: Newspaper, exact: true },
  { title: "ড্যাশবোর্ড", url: "/student/dashboard", icon: Home },
  { title: "মেসেজ", url: "/student/messages", icon: MessageSquare },
  { title: "অনলাইন পরীক্ষা", url: "/student/exam", icon: BookOpenCheck },
  { title: "নোটিশ", url: "/student/notices", icon: Bell },
  { title: "উপস্থিতি", url: "/student/attendance", icon: CalendarCheck },
  { title: "রেজাল্ট", url: "/student/results", icon: GraduationCap },
  { title: "রেজাল্ট এনালাইসিস", url: "/student/analysis", icon: BarChart3 },
  { title: "পিডিএফ নোটস", url: "/student/pdfs", icon: FileText },
  { title: "আমার প্রোফাইল", url: "/student/profile", icon: UserRound },
];

function StudentLayout() {
  const navigate = useNavigate();
  const { user, loading } = useSession();

  const { data: student, isLoading: sLoading } = useQuery({
    queryKey: ["my-student", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase.from("students").select("*").eq("user_id", user!.id).maybeSingle();
      return data;
    },
  });

  if (loading || (user && sLoading)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-academy-soft">
        <Loader2 className="size-8 animate-spin text-academy-navy" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-academy-soft p-4" style={{ fontFamily: "'Hind Siliguri', sans-serif" }}>
        <div className="text-center">
          <p className="mb-4 text-academy-navy">প্রবেশ করতে লগইন করুন</p>
          <Button onClick={() => navigate({ to: "/login" })} className="bg-academy-navy text-white">লগইন</Button>
        </div>
      </div>
    );
  }

  if (!student || !student.is_active) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-academy-soft p-4" style={{ fontFamily: "'Hind Siliguri', sans-serif" }}>
        <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 text-center border">
          <ShieldAlert className="size-12 mx-auto text-amber-500 mb-3" />
          <h1 className="text-xl font-bold text-academy-navy mb-2">শিক্ষার্থী অ্যাক্সেস নেই</h1>
          <p className="text-sm text-muted-foreground mb-6">
            আপনার একাউন্টে কোনো এক্টিভ শিক্ষার্থী প্রোফাইল পাওয়া যায়নি।
          </p>
          <Button onClick={async () => { await supabase.auth.signOut(); navigate({ to: "/login" }); }} variant="outline" className="w-full">
            লগআউট
          </Button>
        </div>
      </div>
    );
  }

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-academy-soft" style={{ fontFamily: "'Hind Siliguri', sans-serif" }}>
        <StudentSidebar
          name={student.full_name}
          classLabel={`${bnClass(student.class_level)} শ্রেণি`}
          onLogout={async () => { await supabase.auth.signOut(); navigate({ to: "/login" }); }}
        />
        <div className="flex-1 flex flex-col min-w-0">
          <header className="h-14 bg-white border-b border-academy-navy/10 flex items-center px-4 gap-2 sticky top-0 z-10">
            <SidebarTrigger />
            <div className="font-bold text-academy-navy truncate">শিক্ষার্থী প্যানেল</div>
            <div className="ml-auto flex items-center gap-2">
              <div className="text-xs text-muted-foreground hidden sm:block truncate">
                {student.full_name} · {bnClass(student.class_level)}
              </div>
              <PositionPill userId={user?.id} />
              <NotificationsBell />
            </div>
          </header>
          <main className="flex-1 p-4 md:p-6 overflow-x-hidden">
            <Outlet />
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}

function StudentSidebar({ name, classLabel, onLogout }: { name: string; classLabel: string; onLogout: () => void }) {
  const path = useRouterState({ select: (r) => r.location.pathname });
  const isActive = (url: string, exact?: boolean) =>
    exact ? path === url : path === url || path.startsWith(url + "/");
  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="border-b">
        <div className="flex items-center gap-2 px-2 py-2">
          <div className="size-9 rounded-lg bg-academy-gold text-academy-navy flex items-center justify-center font-bold shrink-0">স</div>
          <div className="text-sm leading-tight overflow-hidden">
            <div className="font-bold text-sidebar-foreground truncate">{name}</div>
            <div className="text-xs text-sidebar-foreground/70 truncate">{classLabel}</div>
          </div>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>মেনু</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {menu.map((item) => (
                <SidebarMenuItem key={item.url}>
                  <SidebarMenuButton asChild isActive={isActive(item.url, item.exact)}>
                    <Link to={item.url}>
                      <item.icon />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="border-t">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton onClick={onLogout}>
              <LogOut />
              <span>লগআউট</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
