import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { Loader2, Plus, Bell, Trash2, Pencil } from "lucide-react";
import { CLASS_LEVELS, bnClass } from "@/lib/grading";

export const Route = createFileRoute("/admin/notices")({
  component: NoticesAdmin,
});

function NoticesAdmin() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);

  const { data: notices, isLoading } = useQuery({
    queryKey: ["admin-notices"],
    queryFn: async () => {
      const { data, error } = await supabase.from("notices").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const handleDelete = async (id: string) => {
    if (!confirm("নোটিশটি মুছবেন?")) return;
    const { error } = await supabase.from("notices").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("মুছে ফেলা হয়েছে");
    qc.invalidateQueries({ queryKey: ["admin-notices"] });
  };

  const toggleActive = async (id: string, val: boolean) => {
    await supabase.from("notices").update({ is_active: val }).eq("id", id);
    qc.invalidateQueries({ queryKey: ["admin-notices"] });
  };

  return (
    <div className="space-y-4 max-w-5xl">
      <div className="flex items-center gap-3 flex-wrap">
        <div className="size-10 rounded-xl bg-amber-500/15 text-amber-600 flex items-center justify-center">
          <Bell />
        </div>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-academy-navy">নোটিশ ব্যবস্থাপনা</h1>
          <p className="text-sm text-muted-foreground">শিক্ষার্থীদের জন্য নোটিশ প্রকাশ করুন</p>
        </div>
        <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) setEditing(null); }}>
          <DialogTrigger asChild>
            <Button className="bg-academy-navy text-white"><Plus className="size-4 mr-1" /> নতুন নোটিশ</Button>
          </DialogTrigger>
          <NoticeDialog
            editing={editing}
            onDone={() => { setOpen(false); setEditing(null); qc.invalidateQueries({ queryKey: ["admin-notices"] }); }}
          />
        </Dialog>
      </div>

      <div className="bg-white rounded-2xl border overflow-hidden">
        {isLoading ? (
          <div className="p-12 flex justify-center"><Loader2 className="animate-spin" /></div>
        ) : (notices?.length ?? 0) === 0 ? (
          <div className="p-12 text-center text-muted-foreground">কোনো নোটিশ নেই</div>
        ) : (
          <ul className="divide-y">
            {notices!.map((n) => (
              <li key={n.id} className="p-4 flex gap-3 flex-wrap items-start">
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-academy-navy">{n.title}</div>
                  {n.body && <div className="text-sm text-muted-foreground mt-1 whitespace-pre-wrap">{n.body}</div>}
                  <div className="text-xs text-muted-foreground mt-2 flex gap-2 flex-wrap">
                    <span className="px-2 py-0.5 bg-academy-soft rounded-full">
                      {n.class_level ? `${bnClass(n.class_level)} শ্রেণি` : "সবার জন্য"}
                    </span>
                    <span>{new Date(n.created_at).toLocaleDateString("bn-BD")}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Switch checked={n.is_active} onCheckedChange={(v) => toggleActive(n.id, v)} />
                  <Button size="icon" variant="ghost" onClick={() => { setEditing(n); setOpen(true); }}>
                    <Pencil className="size-4" />
                  </Button>
                  <Button size="icon" variant="ghost" onClick={() => handleDelete(n.id)}>
                    <Trash2 className="size-4 text-red-500" />
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function NoticeDialog({ editing, onDone }: { editing: any | null; onDone: () => void }) {
  const [title, setTitle] = useState(editing?.title ?? "");
  const [body, setBody] = useState(editing?.body ?? "");
  const [classLevel, setClassLevel] = useState<string>(editing?.class_level ?? "all");
  const [saving, setSaving] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return toast.error("শিরোনাম দিন");
    setSaving(true);
    const payload = {
      title: title.trim(),
      body: body.trim() || null,
      class_level: classLevel === "all" ? null : (classLevel as any),
    };
    const { error } = editing
      ? await supabase.from("notices").update(payload).eq("id", editing.id)
      : await supabase.from("notices").insert(payload);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("সংরক্ষিত হয়েছে");
    onDone();
  };

  return (
    <DialogContent>
      <DialogHeader>
        <DialogTitle>{editing ? "নোটিশ সম্পাদনা" : "নতুন নোটিশ"}</DialogTitle>
      </DialogHeader>
      <form onSubmit={submit} className="space-y-3">
        <div>
          <Label>শিরোনাম *</Label>
          <Input value={title} onChange={(e) => setTitle(e.target.value)} />
        </div>
        <div>
          <Label>বিবরণ</Label>
          <Textarea rows={5} value={body} onChange={(e) => setBody(e.target.value)} />
        </div>
        <div>
          <Label>কাদের জন্য</Label>
          <Select value={classLevel} onValueChange={setClassLevel}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">সব শ্রেণি</SelectItem>
              {CLASS_LEVELS.map((c) => <SelectItem key={c} value={c}>{bnClass(c)} শ্রেণি</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <DialogFooter>
          <Button type="submit" disabled={saving} className="bg-academy-navy text-white w-full">
            {saving && <Loader2 className="size-4 mr-1 animate-spin" />}
            সংরক্ষণ
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  );
}
