import { createFileRoute, Outlet, Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useSession, useIsAdmin } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";

import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
  SidebarHeader,
  SidebarFooter,
} from "@/components/ui/sidebar";
import {
  LayoutDashboard,
  UserPlus,
  Users,
  ClipboardCheck,
  CalendarSearch,
  LogOut,
  Loader2,
  ShieldCheck,
  BookUser,
  GraduationCap,
  Printer,
  MessageSquare,
  Globe,
  Bell,
  BarChart3,
  Database,
} from "lucide-react";

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [{ title: "এডমিন প্যানেল — সমীকরণ শিক্ষা পরিবার" }],
    links: [{
      rel: "stylesheet",
      href: "https://fonts.googleapis.com/css2?family=Hind+Siliguri:wght@400;500;600;700&display=swap",
    }],
  }),
  component: AdminLayout,
});

const menu = [
  { title: "ড্যাশবোর্ড", url: "/admin", icon: LayoutDashboard, exact: true },
  { title: "ছাত্রছাত্রী ভর্তি", url: "/admin/admission", icon: UserPlus },
  { title: "সকল শিক্ষার্থী", url: "/admin/students", icon: Users },
  { title: "ফোনবুক", url: "/admin/phonebook", icon: BookUser },
  { title: "দৈনিক হাজিরা", url: "/admin/attendance", icon: ClipboardCheck },
  { title: "অনুপস্থিতি ট্র্যাকার", url: "/admin/absent", icon: CalendarSearch },
  { title: "পরীক্ষা ও ফলাফল", url: "/admin/results", icon: GraduationCap },
  { title: "মার্কশীট প্রিন্ট", url: "/admin/marksheet", icon: Printer },
  { title: "রেজাল্ট এনালাইসিস", url: "/admin/analysis", icon: BarChart3 },
  { title: "প্রশ্নব্যাংক (MCQ)", url: "/admin/question-bank", icon: Database },
  { title: "নোটিশ", url: "/admin/notices", icon: Bell },
  { title: "ওয়েবসাইট কন্ট্রোল", url: "/admin/site", icon: Globe },
  { title: "এস এম এস প্যানেল", url: "/admin/sms", icon: MessageSquare },
];

function AdminLayout() {
  const navigate = useNavigate();
  const { user, loading } = useSession();
  const { data: isAdmin, isLoading: roleLoading } = useIsAdmin(user);

  if (loading || (user && roleLoading)) {
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

  if (!isAdmin) {
    return <NotAdmin />;
  }

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-academy-soft" style={{ fontFamily: "'Hind Siliguri', sans-serif" }}>
        <AdminSidebar onLogout={async () => {
          await supabase.auth.signOut();
          navigate({ to: "/login" });
        }} />
        <div className="flex-1 flex flex-col min-w-0">
          <header className="h-14 bg-white border-b border-academy-navy/10 flex items-center px-4 gap-2 sticky top-0 z-10">
            <SidebarTrigger />
            <div className="font-bold text-academy-navy">এডমিন প্যানেল</div>
            <div className="ml-auto text-xs text-muted-foreground hidden sm:block">
              {user.phone ? "0" + user.phone.replace(/^\+?880/, "") : user.email}
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

function AdminSidebar({ onLogout }: { onLogout: () => void }) {
  const path = useRouterState({ select: (r) => r.location.pathname });
  const isActive = (url: string, exact?: boolean) =>
    exact ? path === url : path === url || path.startsWith(url + "/");

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="border-b">
        <div className="flex items-center gap-2 px-2 py-2">
          <div className="size-9 rounded-lg bg-academy-gold text-academy-navy flex items-center justify-center font-bold shrink-0">স</div>
          <div className="text-sm leading-tight overflow-hidden">
            <div className="font-bold text-sidebar-foreground truncate">সমীকরণ</div>
            <div className="text-xs text-sidebar-foreground/70 truncate">শিক্ষা পরিবার</div>
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

function NotAdmin() {
  const navigate = useNavigate();
  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate({ to: "/login" });
  };
  return (
    <div className="min-h-screen flex items-center justify-center bg-academy-soft p-4" style={{ fontFamily: "'Hind Siliguri', sans-serif" }}>
      <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 text-center border">
        <ShieldCheck className="size-12 mx-auto text-academy-gold mb-3" />
        <h1 className="text-xl font-bold text-academy-navy mb-2">এডমিন অ্যাক্সেস নেই</h1>
        <p className="text-sm text-muted-foreground mb-6">
          আপনার একাউন্টে এডমিন পারমিশন নেই। শিক্ষার্থী হলে স্টুডেন্ট প্যানেলে যান।
        </p>
        <Button onClick={handleLogout} variant="outline" className="w-full">লগআউট</Button>
      </div>
    </div>
  );
}
