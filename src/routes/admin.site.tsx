import { createFileRoute } from "@tanstack/react-router";
import { useState, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Trash2, Upload, Loader2, Plus, Sparkles } from "lucide-react";
import { CLASS_LEVELS, bnClass } from "@/lib/grading";
import { useServerFn } from "@tanstack/react-start";
import { generateCourseCover } from "@/lib/course-cover.functions";

export const Route = createFileRoute("/admin/site")({
  component: SiteManagement,
});

const SITE_BUCKET = "site-assets";
const PDF_BUCKET = "pdf-notes";

function publicUrl(path: string) {
  const { data } = supabase.storage.from(SITE_BUCKET).getPublicUrl(path);
  return data.publicUrl;
}

function SiteManagement() {
  return (
    <div className="space-y-4 max-w-6xl">
      <div>
        <h1 className="text-2xl font-bold text-academy-navy">ওয়েবসাইট ম্যানেজমেন্ট</h1>
        <p className="text-sm text-muted-foreground">ফ্রন্টপেজের কনটেন্ট এখান থেকে কন্ট্রোল করুন</p>
      </div>
      <Tabs defaultValue="hero">
        <TabsList className="grid grid-cols-4 max-w-2xl">
          <TabsTrigger value="hero">ব্যানার</TabsTrigger>
          <TabsTrigger value="courses">কোর্স</TabsTrigger>
          <TabsTrigger value="pdfs">পিডিএফ</TabsTrigger>
          <TabsTrigger value="gallery">গ্যালারি</TabsTrigger>
        </TabsList>
        <TabsContent value="hero"><HeroManager /></TabsContent>
        <TabsContent value="courses"><CoursesManager /></TabsContent>
        <TabsContent value="pdfs"><PdfsManager /></TabsContent>
        <TabsContent value="gallery"><GalleryManager /></TabsContent>
      </Tabs>
    </div>
  );
}

/* ---------------- HERO ---------------- */
function HeroManager() {
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [title, setTitle] = useState("");
  const [subtitle, setSubtitle] = useState("");
  const [badge, setBadge] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["admin-hero"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("hero_slides").select("*").order("sort_order");
      if (error) throw error;
      return data ?? [];
    },
  });

  const onAdd = async () => {
    const file = fileRef.current?.files?.[0];
    if (!file || !title) return toast.error("ছবি ও টাইটেল দিন");
    setBusy(true);
    try {
      const path = `hero/${Date.now()}-${file.name.replace(/\s+/g, "_")}`;
      const { error: upErr } = await supabase.storage.from(SITE_BUCKET).upload(path, file);
      if (upErr) throw upErr;
      const { error } = await supabase.from("hero_slides").insert({
        title, subtitle: subtitle || null, badge: badge || null, image_path: path,
        sort_order: (data?.length ?? 0) + 1,
      });
      if (error) throw error;
      toast.success("যোগ হয়েছে");
      setTitle(""); setSubtitle(""); setBadge("");
      if (fileRef.current) fileRef.current.value = "";
      qc.invalidateQueries({ queryKey: ["admin-hero"] });
    } catch (e: any) { toast.error(e.message); }
    finally { setBusy(false); }
  };

  const onDelete = async (id: string, path: string) => {
    if (!confirm("মুছবেন?")) return;
    await supabase.storage.from(SITE_BUCKET).remove([path]);
    await supabase.from("hero_slides").delete().eq("id", id);
    qc.invalidateQueries({ queryKey: ["admin-hero"] });
  };

  return (
    <div className="space-y-4 mt-4">
      <div className="bg-white rounded-2xl border p-4 space-y-3">
        <div className="font-bold text-academy-navy">নতুন ব্যানার যোগ করুন</div>
        <div className="grid sm:grid-cols-2 gap-3">
          <div><Label>টাইটেল</Label><Input value={title} onChange={(e) => setTitle(e.target.value)} /></div>
          <div><Label>ব্যাজ (ঐচ্ছিক)</Label><Input value={badge} onChange={(e) => setBadge(e.target.value)} /></div>
          <div className="sm:col-span-2"><Label>সাবটাইটেল</Label><Input value={subtitle} onChange={(e) => setSubtitle(e.target.value)} /></div>
          <div className="sm:col-span-2"><Label>ছবি</Label><Input ref={fileRef} type="file" accept="image/*" /></div>
        </div>
        <Button onClick={onAdd} disabled={busy} className="bg-academy-navy text-white">
          {busy ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />} যোগ করুন
        </Button>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {isLoading && <Loader2 className="animate-spin" />}
        {data?.map((s) => (
          <div key={s.id} className="bg-white rounded-2xl border overflow-hidden">
            <img src={publicUrl(s.image_path)} alt={s.title} className="w-full aspect-video object-cover" />
            <div className="p-3 space-y-1">
              <div className="font-bold text-academy-navy">{s.title}</div>
              {s.subtitle && <div className="text-xs text-muted-foreground">{s.subtitle}</div>}
              <Button variant="destructive" size="sm" onClick={() => onDelete(s.id, s.image_path)}>
                <Trash2 className="size-3" /> মুছুন
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ---------------- COURSES ---------------- */
function CoursesManager() {
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [genBusy, setGenBusy] = useState(false);
  const [aiCoverPath, setAiCoverPath] = useState<string | null>(null);
  const [form, setForm] = useState({ title: "", description: "", tag: "", fee: "", duration: "", class_level: "" });
  const fileRef = useRef<HTMLInputElement>(null);
  const genCover = useServerFn(generateCourseCover);

  const { data } = useQuery({
    queryKey: ["admin-courses"],
    queryFn: async () => {
      const { data, error } = await supabase.from("courses").select("*").order("sort_order");
      if (error) throw error;
      return data ?? [];
    },
  });

  const onAdd = async () => {
    if (!form.title) return toast.error("নাম দিন");
    setBusy(true);
    try {
      let path: string | null = aiCoverPath;
      const file = fileRef.current?.files?.[0];
      if (file) {
        path = `courses/${Date.now()}-${file.name.replace(/\s+/g, "_")}`;
        const { error: upErr } = await supabase.storage.from(SITE_BUCKET).upload(path, file);
        if (upErr) throw upErr;
      }
      const { error } = await supabase.from("courses").insert({
        title: form.title,
        description: form.description || null,
        tag: form.tag || null,
        fee: form.fee || null,
        duration: form.duration || null,
        class_level: (form.class_level || null) as any,
        image_path: path,
        sort_order: (data?.length ?? 0) + 1,
      });
      if (error) throw error;
      toast.success("যোগ হয়েছে");
      setForm({ title: "", description: "", tag: "", fee: "", duration: "", class_level: "" });
      setAiCoverPath(null);
      if (fileRef.current) fileRef.current.value = "";
      qc.invalidateQueries({ queryKey: ["admin-courses"] });
    } catch (e: any) { toast.error(e.message); }
    finally { setBusy(false); }
  };

  const onGenerateCover = async () => {
    if (!form.title) return toast.error("আগে কোর্সের নাম দিন");
    setGenBusy(true);
    try {
      const res = await genCover({ data: {
        title: form.title,
        tag: form.tag,
        class_level: form.class_level,
        duration: form.duration,
        description: form.description,
      }});
      setAiCoverPath(res.path);
      if (fileRef.current) fileRef.current.value = "";
      toast.success("AI কভার তৈরি হয়েছে — যোগ করুন চাপুন");
    } catch (e: any) { toast.error(e.message ?? "ব্যর্থ"); }
    finally { setGenBusy(false); }
  };

  const onDelete = async (id: string, path: string | null) => {
    if (!confirm("মুছবেন?")) return;
    if (path) await supabase.storage.from(SITE_BUCKET).remove([path]);
    await supabase.from("courses").delete().eq("id", id);
    qc.invalidateQueries({ queryKey: ["admin-courses"] });
  };

  return (
    <div className="space-y-4 mt-4">
      <div className="bg-white rounded-2xl border p-4 space-y-3">
        <div className="font-bold text-academy-navy">নতুন কোর্স যোগ করুন</div>
        <div className="grid sm:grid-cols-2 gap-3">
          <div><Label>কোর্সের নাম</Label><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></div>
          <div><Label>ট্যাগ (যেমন SSC Batch)</Label><Input value={form.tag} onChange={(e) => setForm({ ...form, tag: e.target.value })} /></div>
          <div><Label>ফি</Label><Input value={form.fee} onChange={(e) => setForm({ ...form, fee: e.target.value })} placeholder="যেমন ১৫০০/মাস" /></div>
          <div><Label>সময়কাল</Label><Input value={form.duration} onChange={(e) => setForm({ ...form, duration: e.target.value })} placeholder="যেমন ৬ মাস" /></div>
          <div>
            <Label>শ্রেণি</Label>
            <Select value={form.class_level} onValueChange={(v) => setForm({ ...form, class_level: v })}>
              <SelectTrigger><SelectValue placeholder="বাছাই" /></SelectTrigger>
              <SelectContent>
                {CLASS_LEVELS.map((c) => <SelectItem key={c} value={c}>{bnClass(c)} শ্রেণি</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div><Label>কভার ছবি (আপলোড করুন অথবা AI দিয়ে তৈরি করুন)</Label><Input ref={fileRef} type="file" accept="image/*" onChange={() => setAiCoverPath(null)} /></div>
          <div className="sm:col-span-2"><Label>বিবরণ</Label><Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={3} /></div>
        </div>

        {aiCoverPath && (
          <div className="rounded-xl border border-academy-gold/40 bg-academy-soft p-3 flex gap-3 items-center">
            <img src={publicUrl(aiCoverPath)} alt="AI cover preview" className="w-32 aspect-video object-cover rounded-md border" />
            <div className="flex-1">
              <div className="text-xs font-bold text-academy-gold">AI দ্বারা তৈরি কভার প্রস্তুত</div>
              <div className="text-xs text-muted-foreground">"যোগ করুন" চাপলে এটি কোর্সের সাথে সেভ হবে।</div>
            </div>
            <Button variant="outline" size="sm" onClick={() => setAiCoverPath(null)}>বাতিল</Button>
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          <Button onClick={onAdd} disabled={busy || genBusy} className="bg-academy-navy text-white">
            {busy ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />} যোগ করুন
          </Button>
          <Button onClick={onGenerateCover} disabled={genBusy || busy} variant="outline" className="border-academy-gold text-academy-navy">
            {genBusy ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4 text-academy-gold" />}
            {genBusy ? "AI কভার তৈরি হচ্ছে…" : "AI দিয়ে এক্সক্লুসিভ কভার তৈরি করুন"}
          </Button>
        </div>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {data?.map((c) => (
          <div key={c.id} className="bg-white rounded-2xl border overflow-hidden">
            {c.image_path && <img src={publicUrl(c.image_path)} alt={c.title} className="w-full aspect-video object-cover" />}
            <div className="p-3 space-y-1">
              {c.tag && <div className="text-xs font-bold text-academy-gold">{c.tag}</div>}
              <div className="font-bold text-academy-navy">{c.title}</div>
              <div className="text-xs text-muted-foreground line-clamp-2">{c.description}</div>
              <div className="text-xs">{c.class_level && `${bnClass(c.class_level)} শ্রেণি`} {c.fee && ` • ${c.fee}`} {c.duration && ` • ${c.duration}`}</div>
              <Button variant="destructive" size="sm" onClick={() => onDelete(c.id, c.image_path)}>
                <Trash2 className="size-3" /> মুছুন
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ---------------- PDFs ---------------- */
function PdfsManager() {
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ title: "", subject: "", class_level: "", pages: "" });
  const fileRef = useRef<HTMLInputElement>(null);

  const { data } = useQuery({
    queryKey: ["admin-pdfs"],
    queryFn: async () => {
      const { data, error } = await supabase.from("pdf_notes").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const onAdd = async () => {
    const file = fileRef.current?.files?.[0];
    if (!file || !form.title || !form.class_level) return toast.error("টাইটেল, শ্রেণি ও ফাইল দিন");
    setBusy(true);
    try {
      const path = `${form.class_level}/${Date.now()}-${file.name.replace(/\s+/g, "_")}`;
      const { error: upErr } = await supabase.storage.from(PDF_BUCKET).upload(path, file);
      if (upErr) throw upErr;
      const { error } = await supabase.from("pdf_notes").insert({
        title: form.title,
        subject: form.subject || null,
        class_level: form.class_level as any,
        pages: form.pages ? Number(form.pages) : null,
        file_size_kb: Math.round(file.size / 1024),
        file_path: path,
      });
      if (error) throw error;
      toast.success("যোগ হয়েছে");
      setForm({ title: "", subject: "", class_level: "", pages: "" });
      if (fileRef.current) fileRef.current.value = "";
      qc.invalidateQueries({ queryKey: ["admin-pdfs"] });
    } catch (e: any) { toast.error(e.message); }
    finally { setBusy(false); }
  };

  const onDelete = async (id: string, path: string) => {
    if (!confirm("মুছবেন?")) return;
    await supabase.storage.from(PDF_BUCKET).remove([path]);
    await supabase.from("pdf_notes").delete().eq("id", id);
    qc.invalidateQueries({ queryKey: ["admin-pdfs"] });
  };

  return (
    <div className="space-y-4 mt-4">
      <div className="bg-white rounded-2xl border p-4 space-y-3">
        <div className="font-bold text-academy-navy">নতুন পিডিএফ নোট</div>
        <div className="grid sm:grid-cols-2 gap-3">
          <div><Label>টাইটেল</Label><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></div>
          <div><Label>বিষয়</Label><Input value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} /></div>
          <div>
            <Label>শ্রেণি</Label>
            <Select value={form.class_level} onValueChange={(v) => setForm({ ...form, class_level: v })}>
              <SelectTrigger><SelectValue placeholder="বাছাই" /></SelectTrigger>
              <SelectContent>
                {CLASS_LEVELS.map((c) => <SelectItem key={c} value={c}>{bnClass(c)} শ্রেণি</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div><Label>পৃষ্ঠা সংখ্যা</Label><Input value={form.pages} onChange={(e) => setForm({ ...form, pages: e.target.value })} type="number" /></div>
          <div className="sm:col-span-2"><Label>পিডিএফ ফাইল</Label><Input ref={fileRef} type="file" accept="application/pdf" /></div>
        </div>
        <Button onClick={onAdd} disabled={busy} className="bg-academy-navy text-white">
          {busy ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />} আপলোড করুন
        </Button>
      </div>

      <div className="bg-white rounded-2xl border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-academy-soft text-academy-navy">
            <tr><th className="p-2 text-left">টাইটেল</th><th className="p-2">বিষয়</th><th className="p-2">শ্রেণি</th><th className="p-2">পৃষ্ঠা</th><th className="p-2">সাইজ</th><th className="p-2"></th></tr>
          </thead>
          <tbody>
            {data?.map((n) => (
              <tr key={n.id} className="border-t">
                <td className="p-2">{n.title}</td>
                <td className="p-2 text-center">{n.subject}</td>
                <td className="p-2 text-center">{bnClass(n.class_level)}</td>
                <td className="p-2 text-center">{n.pages ?? "—"}</td>
                <td className="p-2 text-center">{n.file_size_kb ? `${(n.file_size_kb/1024).toFixed(1)} MB` : "—"}</td>
                <td className="p-2 text-right">
                  <Button variant="destructive" size="sm" onClick={() => onDelete(n.id, n.file_path)}><Trash2 className="size-3" /></Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ---------------- GALLERY ---------------- */
function GalleryManager() {
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [caption, setCaption] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const { data } = useQuery({
    queryKey: ["admin-gallery"],
    queryFn: async () => {
      const { data, error } = await supabase.from("gallery_images").select("*").order("sort_order");
      if (error) throw error;
      return data ?? [];
    },
  });

  const onAdd = async () => {
    const file = fileRef.current?.files?.[0];
    if (!file) return toast.error("ছবি দিন");
    setBusy(true);
    try {
      const path = `gallery/${Date.now()}-${file.name.replace(/\s+/g, "_")}`;
      const { error: upErr } = await supabase.storage.from(SITE_BUCKET).upload(path, file);
      if (upErr) throw upErr;
      const { error } = await supabase.from("gallery_images").insert({
        caption: caption || null, image_path: path, sort_order: (data?.length ?? 0) + 1,
      });
      if (error) throw error;
      toast.success("যোগ হয়েছে");
      setCaption("");
      if (fileRef.current) fileRef.current.value = "";
      qc.invalidateQueries({ queryKey: ["admin-gallery"] });
    } catch (e: any) { toast.error(e.message); }
    finally { setBusy(false); }
  };

  const onDelete = async (id: string, path: string) => {
    if (!confirm("মুছবেন?")) return;
    await supabase.storage.from(SITE_BUCKET).remove([path]);
    await supabase.from("gallery_images").delete().eq("id", id);
    qc.invalidateQueries({ queryKey: ["admin-gallery"] });
  };

  return (
    <div className="space-y-4 mt-4">
      <div className="bg-white rounded-2xl border p-4 space-y-3">
        <div className="font-bold text-academy-navy">নতুন ছবি</div>
        <div className="grid sm:grid-cols-2 gap-3">
          <div><Label>ক্যাপশন (ঐচ্ছিক)</Label><Input value={caption} onChange={(e) => setCaption(e.target.value)} /></div>
          <div><Label>ছবি</Label><Input ref={fileRef} type="file" accept="image/*" /></div>
        </div>
        <Button onClick={onAdd} disabled={busy} className="bg-academy-navy text-white">
          {busy ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />} যোগ করুন
        </Button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        {data?.map((g) => (
          <div key={g.id} className="relative group bg-white rounded-xl border overflow-hidden">
            <img src={publicUrl(g.image_path)} alt={g.caption ?? ""} className="w-full aspect-square object-cover" />
            {g.caption && <div className="p-2 text-xs">{g.caption}</div>}
            <Button variant="destructive" size="sm" className="absolute top-2 right-2 opacity-0 group-hover:opacity-100"
              onClick={() => onDelete(g.id, g.image_path)}>
              <Trash2 className="size-3" />
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}
