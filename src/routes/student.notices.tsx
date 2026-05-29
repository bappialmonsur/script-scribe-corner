import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useSession } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { Bell, Loader2 } from "lucide-react";
import { bnClass } from "@/lib/grading";

export const Route = createFileRoute("/student/notices")({
  component: StudentNotices,
});

function StudentNotices() {
  const { user } = useSession();

  const { data: notices, isLoading } = useQuery({
    queryKey: ["student-notices", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data: student } = await supabase.from("students").select("class_level").eq("user_id", user!.id).maybeSingle();
      let q = supabase.from("notices").select("*").eq("is_active", true).order("created_at", { ascending: false });
      if (student?.class_level) {
        q = q.or(`class_level.is.null,class_level.eq.${student.class_level}`);
      } else {
        q = q.is("class_level", null);
      }
      const { data, error } = await q;
      if (error) throw error;
      return data;
    },
  });

  return (
    <div className="space-y-4 max-w-3xl">
      <div className="flex items-center gap-3">
        <div className="size-10 rounded-xl bg-amber-500/15 text-amber-600 flex items-center justify-center">
          <Bell />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-academy-navy">নোটিশ</h1>
          <p className="text-sm text-muted-foreground">সর্বশেষ ঘোষণা ও বার্তা</p>
        </div>
      </div>

      {isLoading ? (
        <div className="p-12 flex justify-center"><Loader2 className="animate-spin" /></div>
      ) : (notices?.length ?? 0) === 0 ? (
        <div className="bg-white rounded-2xl border p-12 text-center text-muted-foreground">কোনো নোটিশ নেই</div>
      ) : (
        <ul className="space-y-3">
          {notices!.map((n) => (
            <li key={n.id} className="bg-white rounded-2xl border p-4 hover:shadow-sm transition-shadow">
              <div className="flex items-start gap-3">
                <div className="size-9 rounded-lg bg-academy-gold/15 text-academy-gold flex items-center justify-center shrink-0">
                  <Bell className="size-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-bold text-academy-navy">{n.title}</div>
                  {n.body && <div className="text-sm text-muted-foreground mt-1 whitespace-pre-wrap">{n.body}</div>}
                  <div className="text-xs text-muted-foreground mt-2 flex gap-2 flex-wrap">
                    <span className="px-2 py-0.5 bg-academy-soft rounded-full">
                      {n.class_level ? `${bnClass(n.class_level)} শ্রেণি` : "সবার জন্য"}
                    </span>
                    <span>{new Date(n.created_at).toLocaleDateString("bn-BD")}</span>
                  </div>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
