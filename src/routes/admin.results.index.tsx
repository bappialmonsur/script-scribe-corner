import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { Loader2, Plus, FileText, Trash2, GraduationCap, Printer } from "lucide-react";
import { EXAM_TYPE_LABEL, EXAM_PATTERN_LABEL, CLASS_LEVELS, bnClass, DEPT_LABEL, BATCH_LABEL, DEPT_CLASS_LEVELS } from "@/lib/grading";

export const Route = createFileRoute("/admin/results/")({
  component: ResultsPage,
});

function ResultsPage() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [cls, setCls] = useState<string>("all");
  const [open, setOpen] = useState(false);

  const { data: exams, isLoading } = useQuery({
    queryKey: ["exams", cls],
    queryFn: async () => {
      let q = supabase.from("exams").select("*").order("exam_date", { ascending: false });
      if (cls !== "all") q = q.eq("class_level", cls as any);
      const { data, error } = await q;
      if (error) throw error;
      return data;
    },
  });

  const handleDelete = async (id: string, title: string) => {
    if (!confirm(`"${title}" পরীক্ষা ও সব ফলাফল মুছবেন?`)) return;
    const { error } = await supabase.from("exams").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("মুছে ফেলা হয়েছে");
    qc.invalidateQueries({ queryKey: ["exams"] });
  };

  return (
    <div className="space-y-4 max-w-6xl">
      <div className="flex items-center gap-3 flex-wrap">
        <div className="size-10 rounded-xl bg-purple-500/15 text-purple-600 flex items-center justify-center">
          <GraduationCap />
        </div>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-academy-navy">পরীক্ষা ও ফলাফল</h1>
          <p className="text-sm text-muted-foreground">ক্লাস ওয়াইজ পরীক্ষা তৈরি ও নাম্বার এন্ট্রি</p>
        </div>
        <Link to="/admin/marksheet">
          <Button variant="outline"><Printer className="size-4 mr-1" /> মার্কশীট প্রিন্ট</Button>
        </Link>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="bg-academy-navy text-white"><Plus className="size-4 mr-1" /> নতুন পরীক্ষা</Button>
          </DialogTrigger>
          <NewExamDialog onDone={() => { setOpen(false); qc.invalidateQueries({ queryKey: ["exams"] }); }} />
        </Dialog>
      </div>

      <div className="bg-white rounded-2xl border p-4 flex gap-3 flex-wrap items-center">
        <Label className="text-sm">শ্রেণি ফিল্টার:</Label>
        <Select value={cls} onValueChange={setCls}>
          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">সব শ্রেণি</SelectItem>
            {CLASS_LEVELS.map((c) => <SelectItem key={c} value={c}>{bnClass(c)} শ্রেণি</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <div className="bg-white rounded-2xl border overflow-hidden">
        {isLoading ? (
          <div className="p-12 flex justify-center"><Loader2 className="animate-spin" /></div>
        ) : (exams?.length ?? 0) === 0 ? (
          <div className="p-12 text-center text-muted-foreground">
            কোনো পরীক্ষা নেই। উপরে "নতুন পরীক্ষা" থেকে তৈরি করুন।
          </div>
        ) : (
          <ul className="divide-y">
            {exams!.map((e: any) => (
              <li key={e.id} className="p-4 flex items-center gap-3 flex-wrap">
                <div className="size-10 rounded-lg bg-academy-soft text-academy-navy flex items-center justify-center shrink-0">
                  <FileText className="size-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-academy-navy">
                    {e.subject}
                    {e.title && <span className="text-muted-foreground"> — {e.title}</span>}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {bnClass(e.class_level)} শ্রেণি · {EXAM_TYPE_LABEL[e.exam_type]} · {EXAM_PATTERN_LABEL[e.pattern ?? "written"]} · পূর্ণমান {e.full_marks} ·{" "}
                    {new Date(e.exam_date).toLocaleDateString("bn-BD")}
                  </div>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => navigate({ to: "/admin/results/$examId", params: { examId: e.id } })}
                >
                  নাম্বার এন্ট্রি
                </Button>
                <Button size="icon" variant="ghost" onClick={() => handleDelete(e.id, e.subject)}>
                  <Trash2 className="size-4 text-red-500" />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function NewExamDialog({ onDone }: { onDone: () => void }) {
  const [classLevel, setClassLevel] = useState("");
  const [examType, setExamType] = useState("");
  const [pattern, setPattern] = useState("written");
  const [subject, setSubject] = useState("");
  const [fullMarks, setFullMarks] = useState("100");
  const [examDate, setExamDate] = useState(new Date().toISOString().slice(0, 10));
  const [title, setTitle] = useState("");
  const [saving, setSaving] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!classLevel || !examType || !pattern || !subject.trim() || !fullMarks || !examDate) {
      return toast.error("সব ঘর পূরণ করুন");
    }
    setSaving(true);
    const { error } = await supabase.from("exams").insert({
      class_level: classLevel as any,
      exam_type: examType as any,
      pattern: pattern as any,
      subject: subject.trim(),
      full_marks: Number(fullMarks),
      exam_date: examDate,
      title: title.trim() || null,
    });
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("পরীক্ষা তৈরি হয়েছে");
    onDone();
  };

  return (
    <DialogContent>
      <DialogHeader>
        <DialogTitle>নতুন পরীক্ষা তৈরি</DialogTitle>
      </DialogHeader>
      <form onSubmit={submit} className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>শ্রেণি *</Label>
            <Select value={classLevel} onValueChange={setClassLevel}>
              <SelectTrigger><SelectValue placeholder="বাছাই করুন" /></SelectTrigger>
              <SelectContent>
                {CLASS_LEVELS.map((c) => <SelectItem key={c} value={c}>{bnClass(c)}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>ধরন *</Label>
            <Select value={examType} onValueChange={setExamType}>
              <SelectTrigger><SelectValue placeholder="বাছাই করুন" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="daily">দৈনিক</SelectItem>
                <SelectItem value="weekly">সাপ্তাহিক</SelectItem>
                <SelectItem value="model_test">মডেল টেস্ট</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>প্যাটার্ন *</Label>
            <Select value={pattern} onValueChange={setPattern}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="written">লিখিত</SelectItem>
                <SelectItem value="mcq">বহুনির্বাচনি</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>বিষয় *</Label>
            <Input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="যেমন: গণিত" />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>পূর্ণমান *</Label>
            <Input type="number" value={fullMarks} onChange={(e) => setFullMarks(e.target.value)} min={1} />
          </div>
          <div>
            <Label>তারিখ *</Label>
            <Input type="date" value={examDate} onChange={(e) => setExamDate(e.target.value)} />
          </div>
        </div>
        <div>
          <Label>শিরোনাম (ঐচ্ছিক)</Label>
          <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="যেমন: ১ম সপ্তাহ" />
        </div>
        <DialogFooter>
          <Button type="submit" disabled={saving} className="bg-academy-navy text-white w-full">
            {saving && <Loader2 className="size-4 mr-1 animate-spin" />}
            পরীক্ষা তৈরি করুন
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  );
}
