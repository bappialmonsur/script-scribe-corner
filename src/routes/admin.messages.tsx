import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useSession } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Send, Loader2, MessageSquare, ChevronLeft, GraduationCap } from "lucide-react";

export const Route = createFileRoute("/admin/messages")({
  component: AdminMessages,
});

type Msg = {
  id: string;
  student_user_id: string;
  sender_role: string;
  sender_name: string | null;
  sender_meta: string | null;
  body: string;
  is_read: boolean;
  created_at: string;
};

function AdminMessages() {
  const { user } = useSession();
  const qc = useQueryClient();
  const [active, setActive] = useState<string | null>(null);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  const { data: all, isLoading } = useQuery({
    queryKey: ["admin-conversations"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("messages")
        .select("*")
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data as Msg[];
    },
  });

  useEffect(() => {
    const channel = supabase
      .channel("admin-msg-rt")
      .on("postgres_changes", { event: "*", schema: "public", table: "messages" }, () => {
        qc.invalidateQueries({ queryKey: ["admin-conversations"] });
        qc.invalidateQueries({ queryKey: ["admin-notifications"] });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [qc]);

  const convos = useMemo(() => {
    const map = new Map<string, { id: string; name: string; meta: string; last: Msg; unread: number }>();
    for (const m of all ?? []) {
      const cur = map.get(m.student_user_id);
      const unread = (cur?.unread ?? 0) + (m.sender_role === "student" && !m.is_read ? 1 : 0);
      map.set(m.student_user_id, {
        id: m.student_user_id,
        name: m.sender_role === "student" ? (m.sender_name ?? "শিক্ষার্থী") : (cur?.name ?? "শিক্ষার্থী"),
        meta: m.sender_role === "student" ? (m.sender_meta ?? "") : (cur?.meta ?? ""),
        last: m,
        unread,
      });
    }
    return Array.from(map.values()).sort((a, b) => +new Date(b.last.created_at) - +new Date(a.last.created_at));
  }, [all]);

  const thread = useMemo(
    () => (all ?? []).filter((m) => m.student_user_id === active),
    [all, active],
  );

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
    if (active && thread.some((m) => m.sender_role === "student" && !m.is_read)) {
      supabase.from("messages").update({ is_read: true })
        .eq("student_user_id", active).eq("sender_role", "student").eq("is_read", false)
        .then(() => qc.invalidateQueries({ queryKey: ["admin-notifications"] }));
    }
  }, [active, thread, qc]);

  const send = async () => {
    if (!text.trim() || !active) return;
    setSending(true);
    try {
      const { error } = await supabase.from("messages").insert({
        student_user_id: active,
        sender_role: "admin",
        sender_name: "এডমিন",
        body: text.trim(),
      });
      if (error) throw error;
      setText("");
      qc.invalidateQueries({ queryKey: ["admin-conversations"] });
    } catch (e: any) {
      toast.error(e.message ?? "পাঠানো যায়নি");
    } finally {
      setSending(false);
    }
  };

  const activeConvo = convos.find((c) => c.id === active);

  return (
    <div className="max-w-4xl">
      <div className="flex items-center gap-2 mb-4">
        <div className="size-9 rounded-xl bg-academy-navy/10 text-academy-navy flex items-center justify-center">
          <MessageSquare className="size-5" />
        </div>
        <div>
          <h1 className="text-lg font-bold text-academy-navy leading-tight">শিক্ষার্থী মেসেজ</h1>
          <p className="text-xs text-muted-foreground">শিক্ষার্থীদের বার্তা ও উত্তর</p>
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16"><Loader2 className="animate-spin text-academy-gold" /></div>
      ) : (
        <div className="grid md:grid-cols-[260px_1fr] gap-4">
          {/* Conversation list */}
          <div className={`bg-white rounded-2xl border overflow-hidden ${active ? "hidden md:block" : ""}`}>
            {convos.length === 0 ? (
              <div className="p-8 text-center text-sm text-muted-foreground">কোনো মেসেজ নেই</div>
            ) : (
              <ul className="divide-y max-h-[70vh] overflow-y-auto">
                {convos.map((c) => (
                  <li key={c.id}>
                    <button
                      onClick={() => setActive(c.id)}
                      className={`w-full text-left p-3 hover:bg-academy-soft/60 transition-colors ${active === c.id ? "bg-academy-soft" : ""}`}
                    >
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-sm text-academy-navy truncate flex-1">{c.name}</span>
                        {c.unread > 0 && (
                          <span className="text-[10px] font-bold text-white bg-red-500 rounded-full px-1.5 py-0.5 min-w-5 text-center">{c.unread}</span>
                        )}
                      </div>
                      {c.meta && <div className="text-[11px] text-muted-foreground truncate">{c.meta}</div>}
                      <div className="text-xs text-muted-foreground truncate mt-0.5">{c.last.body}</div>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Thread */}
          <div className={`bg-white rounded-2xl border flex flex-col ${active ? "" : "hidden md:flex"}`} style={{ height: "70vh" }}>
            {!active ? (
              <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground">
                একটি কথোপকথন বেছে নিন
              </div>
            ) : (
              <>
                <div className="p-3 border-b flex items-center gap-2">
                  <Button size="icon" variant="ghost" className="md:hidden" onClick={() => setActive(null)}>
                    <ChevronLeft className="size-5" />
                  </Button>
                  <div className="size-8 rounded-full bg-academy-gold/30 flex items-center justify-center text-academy-navy">
                    <GraduationCap className="size-4" />
                  </div>
                  <div className="min-w-0">
                    <div className="font-semibold text-sm text-academy-navy truncate">{activeConvo?.name}</div>
                    {activeConvo?.meta && <div className="text-[11px] text-muted-foreground truncate">{activeConvo.meta}</div>}
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto p-3 space-y-2 bg-academy-soft/40">
                  {thread.map((m) => {
                    const mine = m.sender_role === "admin";
                    return (
                      <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                        <div className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm whitespace-pre-wrap ${
                          mine ? "bg-academy-navy text-white rounded-br-sm" : "bg-white border rounded-bl-sm text-academy-navy"
                        }`}>
                          {m.body}
                          <div className={`text-[10px] mt-1 ${mine ? "text-white/60" : "text-muted-foreground"}`}>
                            {new Date(m.created_at).toLocaleString("bn-BD")}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  <div ref={endRef} />
                </div>

                <div className="flex items-end gap-2 p-3 border-t">
                  <Textarea
                    rows={1}
                    placeholder="উত্তর লিখুন..."
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
                    className="resize-none min-h-10"
                  />
                  <Button onClick={send} disabled={sending || !text.trim()} className="bg-academy-navy text-white shrink-0">
                    {sending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
                  </Button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
