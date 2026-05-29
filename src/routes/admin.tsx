import { createFileRoute, Outlet, Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useSession } from "@/hooks/use-auth";
import { useMyAccess, type TeacherFeature } from "@/hooks/use-access";
import { useAdminNotifications, requestPushPermission, type AdminCounts } from "@/hooks/use-admin-notifications";
import { useEffect } from "react";
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
  Newspaper,
  UserCog,
  KeyRound,
} from "lucide-react";

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [{ title: "প্যানেল — সমীকরণ শিক্ষা পরিবার" }],
    links: [{
      rel: "stylesheet",
      href: "https://fonts.googleapis.com/css2?family=Hind+Siliguri:wght@400;500;600;700&display=swap",
    }],
  }),
  component: AdminLayout,
});

type MenuItem = {
  title: string;
  url: string;
  icon: typeof LayoutDashboard;
  exact?: boolean;
  feature?: TeacherFeature;
  badge?: "pending" | "messages";
};

const menu: MenuItem[] = [
  { title: "ড্যাশবোর্ড", url: "/admin", icon: LayoutDashboard, exact: true },
  { title: "আমার প্রোফাইল", url: "/admin/profile", icon: UserRound, exact: true },
  { title: "নিউজফিড", url: "/admin/newsfeed", icon: Newspaper, feature: "newsfeed", exact: true },
  { title: "নিউজফিড পোস্ট", url: "/admin/feed", icon: Newspaper, feature: "newsfeed", badge: "pending" },
  { title: "মেসেজ", url: "/admin/messages", icon: MessageSquare, badge: "messages" },
  { title: "ছাত্রছাত্রী ভর্তি", url: "/admin/admission", icon: UserPlus, feature: "admission" },
  { title: "সকল শিক্ষার্থী", url: "/admin/students", icon: Users, feature: "admission" },
  { title: "ফোনবুক", url: "/admin/phonebook", icon: BookUser, feature: "admission" },
  { title: "দৈনিক হাজিরা", url: "/admin/attendance", icon: ClipboardCheck, feature: "attendance" },
  { title: "অনুপস্থিতি ট্র্যাকার", url: "/admin/absent", icon: CalendarSearch, feature: "attendance" },
  { title: "পরীক্ষা ও ফলাফল", url: "/admin/results", icon: GraduationCap, feature: "results" },
  { title: "মার্কশীট প্রিন্ট", url: "/admin/marksheet", icon: Printer, feature: "results" },
  { title: "রেজাল্ট এনালাইসিস", url: "/admin/analysis", icon: BarChart3, feature: "results" },
  { title: "প্রশ্নব্যাংক (MCQ)", url: "/admin/question-bank", icon: Database },
  { title: "নোটিশ", url: "/admin/notices", icon: Bell, feature: "newsfeed" },
  { title: "শিক্ষক ব্যবস্থাপনা", url: "/admin/teachers", icon: UserCog },
  { title: "পাসওয়ার্ড পরিবর্তন", url: "/admin/security", icon: KeyRound },
  { title: "ওয়েবসাইট কন্ট্রোল", url: "/admin/site", icon: Globe },
  { title: "এস এম এস প্যানেল", url: "/admin/sms", icon: MessageSquare },
];

function AdminLayout() {
  const navigate = useNavigate();
  const { user, loading } = useSession();
  const { data: access, isLoading: accessLoading } = useMyAccess(user);
  const path = useRouterState({ select: (r) => r.location.pathname });
  const isAdminUser = !!access?.isAdmin;
  const { data: counts } = useAdminNotifications(user, isAdminUser);
  useEffect(() => { if (isAdminUser) requestPushPermission(); }, [isAdminUser]);

  if (loading || (user && accessLoading)) {
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

  const isAdmin = !!access?.isAdmin;
  const isTeacher = !!access?.isTeacher;

  if (!isAdmin && !isTeacher) {
    return <NotAdmin />;
  }

  // Build the menu visible to this user
  const visibleMenu = isAdmin
    ? menu
    : menu.filter((m) => m.exact || (m.feature && access!.permissions.includes(m.feature)));

  // Access guard: teachers may only open pages they have permission for
  const isAllowedPath = (() => {
    if (isAdmin) return true;
    return visibleMenu.some((m) =>
      m.exact ? path === m.url : path === m.url || path.startsWith(m.url + "/"),
    );
  })();

  const panelLabel = isAdmin ? "এডমিন প্যানেল" : "শিক্ষক প্যানেল";

  const onLogout = async () => {
    await supabase.auth.signOut();
    navigate({ to: "/login" });
  };

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-academy-soft" style={{ fontFamily: "'Hind Siliguri', sans-serif" }}>
        <PanelSidebar items={visibleMenu} subtitle={isAdmin ? "শিক্ষা পরিবার" : "শিক্ষক"} onLogout={onLogout} counts={counts} />
        <div className="flex-1 flex flex-col min-w-0">
          <header className="h-14 bg-white border-b border-academy-navy/10 flex items-center px-4 gap-2 sticky top-0 z-10">
            <SidebarTrigger />
            <div className="font-bold text-academy-navy">{panelLabel}</div>
            <div className="ml-auto text-xs text-muted-foreground hidden sm:block">
              {user.phone ? "0" + user.phone.replace(/^\+?880/, "") : user.email}
            </div>
          </header>
          <main className="flex-1 p-4 md:p-6 overflow-x-hidden">
            {isAllowedPath ? (
              <Outlet />
            ) : (
              <div className="max-w-md mx-auto bg-white rounded-2xl shadow-sm p-8 text-center border mt-10">
                <ShieldCheck className="size-12 mx-auto text-academy-gold mb-3" />
                <h1 className="text-xl font-bold text-academy-navy mb-2">এই ফিচারের অনুমতি নেই</h1>
                <p className="text-sm text-muted-foreground mb-6">
                  এই অংশটি ব্যবহারের অনুমতি আপনাকে দেওয়া হয়নি। প্রয়োজন হলে এডমিনের সাথে যোগাযোগ করুন।
                </p>
                <Button onClick={() => navigate({ to: "/admin" })} variant="outline" className="w-full">
                  ড্যাশবোর্ডে ফিরে যান
                </Button>
              </div>
            )}
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}


function PanelSidebar({ items, subtitle, onLogout, counts }: { items: MenuItem[]; subtitle: string; onLogout: () => void; counts?: AdminCounts }) {
  const path = useRouterState({ select: (r) => r.location.pathname });
  const isActive = (url: string, exact?: boolean) =>
    exact ? path === url : path === url || path.startsWith(url + "/");

  const badgeCount = (b?: "pending" | "messages") => {
    if (!b || !counts) return 0;
    return b === "pending" ? counts.pendingPosts : counts.unreadMessages;
  };

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="border-b">
        <div className="flex items-center gap-2 px-2 py-2">
          <div className="size-9 rounded-lg bg-academy-gold text-academy-navy flex items-center justify-center font-bold shrink-0">স</div>
          <div className="text-sm leading-tight overflow-hidden">
            <div className="font-bold text-sidebar-foreground truncate">সমীকরণ</div>
            <div className="text-xs text-sidebar-foreground/70 truncate">{subtitle}</div>
          </div>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>মেনু</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((item) => {
                const bc = badgeCount(item.badge);
                return (
                  <SidebarMenuItem key={item.url}>
                    <SidebarMenuButton asChild isActive={isActive(item.url, item.exact)}>
                      <Link to={item.url}>
                        <item.icon />
                        <span className="flex-1">{item.title}</span>
                        {bc > 0 && (
                          <span className="text-[10px] font-bold text-white bg-red-500 rounded-full px-1.5 py-0.5 min-w-5 text-center leading-none">
                            {bc}
                          </span>
                        )}
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
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
