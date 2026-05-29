import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useSession } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { getPdfDownloadUrl } from "@/lib/site.functions";
import { toast } from "sonner";
import { FileText, Loader2, BookOpen, X } from "lucide-react";
import { bnNum } from "@/lib/grading";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";

export const Route = createFileRoute("/student/pdfs")({
  component: StudentPdfs,
});

function StudentPdfs() {
  const { user } = useSession();
  const getUrl = useServerFn(getPdfDownloadUrl);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [viewer, setViewer] = useState<{ url: string; title: string } | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["my-pdfs", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data: s } = await supabase.from("students").select("class_level").eq("user_id", user!.id).maybeSingle();
      if (!s) return [];
      const { data, error } = await supabase
        .from("pdf_notes").select("*").eq("class_level", s.class_level).eq("is_active", true).order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const handleRead = async (id: string, title: string) => {
    setLoadingId(id);
    try {
      const res = await getUrl({ data: { noteId: id } });
      // Append PDF viewer params to hide toolbar (deters download in most browsers)
      const url = `${res.url}#toolbar=0&navpanes=0&view=FitH`;
      setViewer({ url, title });
    } catch (e: any) {
      toast.error(e.message ?? "খোলা যায়নি");
    } finally { setLoadingId(null); }
  };

  return (
    <div className="space-y-4 max-w-4xl">
      <div className="flex items-center gap-3">
        <div className="size-10 rounded-xl bg-indigo-500/15 text-indigo-600 flex items-center justify-center">
          <FileText />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-academy-navy">পিডিএফ নোটস</h1>
          <p className="text-sm text-muted-foreground">আপনার শ্রেণির জন্য প্রকাশিত নোট — এখান থেকে পড়ুন</p>
        </div>
      </div>

      {isLoading ? (
        <div className="p-12 flex justify-center"><Loader2 className="animate-spin" /></div>
      ) : (data?.length ?? 0) === 0 ? (
        <div className="bg-white rounded-2xl border p-12 text-center text-muted-foreground">কোনো পিডিএফ নেই</div>
      ) : (
        <div className="grid sm:grid-cols-2 gap-3">
          {data!.map((p) => (
            <div key={p.id} className="bg-white rounded-2xl border p-4 flex gap-3 items-center">
              <div className="size-12 rounded-lg bg-academy-navy text-academy-gold flex items-center justify-center shrink-0">
                <FileText />
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-bold text-academy-navy truncate">{p.title}</div>
                <div className="text-xs text-muted-foreground">
                  {p.subject && <>{p.subject} · </>}
                  {p.pages && <>{bnNum(p.pages)} পৃষ্ঠা · </>}
                  {p.file_size_kb && <>{(p.file_size_kb / 1024).toFixed(1)} MB</>}
                </div>
              </div>
              <button
                onClick={() => handleRead(p.id, p.title)}
                disabled={loadingId === p.id}
                className="h-10 px-3 rounded-lg bg-academy-soft hover:bg-academy-navy hover:text-white flex items-center justify-center gap-1.5 text-xs font-bold transition-colors disabled:opacity-50"
              >
                {loadingId === p.id ? <Loader2 className="size-4 animate-spin" /> : <BookOpen className="size-4" />}
                পড়ুন
              </button>
            </div>
          ))}
        </div>
      )}

      <Dialog open={!!viewer} onOpenChange={(o) => !o && setViewer(null)}>
        <DialogContent
          className="max-w-6xl w-[96vw] h-[90vh] p-0 flex flex-col gap-0 [&>button]:hidden"
          onContextMenu={(e) => e.preventDefault()}
        >
          <div className="flex items-center gap-2 px-4 h-12 border-b bg-academy-navy text-white rounded-t-lg shrink-0">
            <FileText className="size-4 text-academy-gold" />
            <DialogTitle className="text-sm font-bold truncate flex-1 text-white">{viewer?.title}</DialogTitle>
            <button onClick={() => setViewer(null)} className="size-8 rounded-md hover:bg-white/10 flex items-center justify-center" aria-label="বন্ধ করুন">
              <X className="size-4" />
            </button>
          </div>
          {viewer && (
            <iframe
              src={viewer.url}
              title={viewer.title}
              className="flex-1 w-full bg-neutral-100 rounded-b-lg"
              sandbox="allow-scripts allow-same-origin"
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
