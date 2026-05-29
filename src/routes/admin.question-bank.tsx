import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  listQuestions,
  addManualQuestion,
  deleteQuestion,
  aiGenerateQuestions,
} from "@/lib/mcq-exam.functions";
import { CURRICULUM } from "@/lib/curriculum";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Trash2, Sparkles, Database, ListChecks, Plus } from "lucide-react";
import { toast } from "sonner";
import { bnClass, bnNum } from "@/lib/grading";
import { MathText } from "@/components/math-text";

export const Route = createFileRoute("/admin/question-bank")({
  component: QuestionBankPage,
});

function QuestionBankPage() {
  const [classLevel, setClassLevel] = useState<string>("5");
  const [subjectKey, setSubjectKey] = useState<string>("");
  const [chapter, setChapter] = useState<string>("");

  const subjects = useMemo(() => CURRICULUM[classLevel] ?? [], [classLevel]);
  const subject = subjects.find((s) => s.key === subjectKey);

  return (
    <div className="space-y-5 max-w-5xl">
      <div className="flex items-center gap-3">
        <div className="size-11 rounded-2xl bg-gradient-to-br from-academy-navy to-academy-navy/80 text-academy-gold flex items-center justify-center shadow">
          <Database />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-academy-navy">প্রশ্নব্যাংক</h1>
          <p className="text-sm text-muted-foreground">বহুনির্বাচনি প্রশ্ন যোগ ও পরিচালনা করুন। শিক্ষার্থীরা এখান থেকেই পরীক্ষা দেবে।</p>
        </div>
      </div>

      <div className="bg-white rounded-2xl border p-4 grid grid-cols-1 md:grid-cols-3 gap-3">
        <div>
          <Label className="text-xs">শ্রেণি</Label>
          <Select value={classLevel} onValueChange={(v) => { setClassLevel(v); setSubjectKey(""); setChapter(""); }}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {Object.keys(CURRICULUM).map((c) => (
                <SelectItem key={c} value={c}>{bnClass(c)} শ্রেণি</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs">বিষয়</Label>
          <Select value={subjectKey} onValueChange={(v) => { setSubjectKey(v); setChapter(""); }}>
            <SelectTrigger><SelectValue placeholder="বিষয় নির্বাচন করুন" /></SelectTrigger>
            <SelectContent>
              {subjects.map((s) => <SelectItem key={s.key} value={s.key}>{s.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs">অধ্যায়</Label>
          <Select value={chapter} onValueChange={setChapter} disabled={!subject}>
            <SelectTrigger><SelectValue placeholder="অধ্যায় নির্বাচন করুন" /></SelectTrigger>
            <SelectContent>
              {subject?.chapters.map((ch) => <SelectItem key={ch} value={ch}>{ch}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      {subject && chapter ? (
        <BankTabs classLevel={classLevel} subjectName={subject.name} chapter={chapter} />
      ) : (
        <div className="bg-academy-soft border border-dashed rounded-2xl p-8 text-center text-sm text-muted-foreground">
          শ্রেণি, বিষয় ও অধ্যায় নির্বাচন করলে প্রশ্ন তালিকা ও যোগ করার অপশন আসবে।
        </div>
      )}
    </div>
  );
}

function BankTabs({ classLevel, subjectName, chapter }: { classLevel: string; subjectName: string; chapter: string }) {
  const qc = useQueryClient();
  const list = useServerFn(listQuestions);
  const add = useServerFn(addManualQuestion);
  const del = useServerFn(deleteQuestion);
  const ai = useServerFn(aiGenerateQuestions);

  const queryKey = ["mcq-bank", classLevel, subjectName, chapter];

  const { data, isLoading, refetch } = useQuery({
    queryKey,
    queryFn: () => list({ data: { classLevel, subject: subjectName, chapter } }),
  });

  const questions = data?.questions ?? [];

  const aiMut = useMutation({
    mutationFn: (count: number) => ai({ data: { classLevel, subject: subjectName, chapter, count } }),
    onSuccess: (r) => { toast.success(`${bnNum(r.saved)}টি প্রশ্ন সেভ হয়েছে`); qc.invalidateQueries({ queryKey }); },
    onError: (e: any) => toast.error(e?.message ?? "ত্রুটি"),
  });

  const delMut = useMutation({
    mutationFn: (id: string) => del({ data: { id } }),
    onSuccess: () => { toast.success("ডিলিট হয়েছে"); qc.invalidateQueries({ queryKey }); },
    onError: (e: any) => toast.error(e?.message ?? "ত্রুটি"),
  });

  return (
    <Tabs defaultValue="list">
      <TabsList>
        <TabsTrigger value="list"><ListChecks className="size-4 mr-1" /> তালিকা ({bnNum(questions.length)})</TabsTrigger>
        <TabsTrigger value="manual"><Plus className="size-4 mr-1" /> ম্যানুয়াল</TabsTrigger>
        <TabsTrigger value="ai"><Sparkles className="size-4 mr-1" /> AI জেনারেট</TabsTrigger>
      </TabsList>

      <TabsContent value="list" className="space-y-3 mt-4">
        {isLoading ? (
          <div className="py-10 text-center"><Loader2 className="animate-spin mx-auto" /></div>
        ) : questions.length === 0 ? (
          <div className="bg-academy-soft border border-dashed rounded-2xl p-8 text-center text-sm text-muted-foreground">
            এখনো কোনো প্রশ্ন নেই। ম্যানুয়াল বা AI ট্যাব থেকে যোগ করুন।
          </div>
        ) : (
          questions.map((q: any, i: number) => (
            <div key={q.id} className="bg-white rounded-2xl border p-4">
              <div className="flex items-start gap-2">
                <div className="flex-1">
                  <div className="text-xs text-academy-gold font-bold mb-1">প্রশ্ন {bnNum(i + 1)} · {q.source === "ai" ? "AI" : "ম্যানুয়াল"}</div>
                  <div className="font-bold text-academy-navy text-sm"><MathText>{q.question}</MathText></div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 mt-2">
                    {(q.options as string[]).map((opt, j) => (
                      <div key={j} className={`text-xs rounded-lg px-2 py-1.5 border ${j === q.correct_index ? "border-green-300 bg-green-50 text-green-800 font-medium" : "border-academy-navy/10 text-academy-navy/80"}`}>
                        <b>{["ক","খ","গ","ঘ"][j]}.</b> <MathText>{opt}</MathText> {j === q.correct_index && "✓"}
                      </div>
                    ))}
                  </div>
                  {q.explanation && <div className="text-xs text-muted-foreground mt-2">ব্যাখ্যা: <MathText>{q.explanation}</MathText></div>}
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => { if (confirm("এই প্রশ্নটি ডিলিট করবেন?")) delMut.mutate(q.id); }}
                  disabled={delMut.isPending}
                >
                  <Trash2 className="size-4 text-red-600" />
                </Button>
              </div>
            </div>
          ))
        )}
      </TabsContent>

      <TabsContent value="manual" className="mt-4">
        <ManualForm
          classLevel={classLevel}
          subjectName={subjectName}
          chapter={chapter}
          onSaved={() => { refetch(); }}
          addFn={add}
        />
      </TabsContent>

      <TabsContent value="ai" className="mt-4">
        <div className="bg-white rounded-2xl border p-5 space-y-4">
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-900">
            <b>মনে রাখবেন:</b> AI জেনারেট করলে শুধু <b>একবারের</b> জন্য ক্রেডিট কাটবে। এরপর প্রশ্ন ডাটাবেসে সেভ থাকবে — শিক্ষার্থীরা পরীক্ষা দিলে আর কোনো ক্রেডিট লাগবে না।
          </div>
          <p className="text-sm">AI স্বয়ংক্রিয়ভাবে ২০২৬-এর বই অনুযায়ী প্রশ্ন তৈরি করে সেভ করবে। একসাথে কত টি প্রশ্ন তৈরি করতে চান?</p>
          <div className="flex gap-2 flex-wrap">
            {[10, 20, 30, 50].map((n) => (
              <Button
                key={n}
                onClick={() => aiMut.mutate(n)}
                disabled={aiMut.isPending}
                className="bg-academy-navy text-white hover:bg-academy-navy/90"
              >
                {aiMut.isPending && <Loader2 className="size-4 mr-1 animate-spin" />}
                {bnNum(n)}টি জেনারেট করুন
              </Button>
            ))}
          </div>
        </div>
      </TabsContent>
    </Tabs>
  );
}

function ManualForm({
  classLevel, subjectName, chapter, onSaved, addFn,
}: {
  classLevel: string; subjectName: string; chapter: string;
  onSaved: () => void;
  addFn: ReturnType<typeof useServerFn<typeof addManualQuestion>>;
}) {
  const [question, setQuestion] = useState("");
  const [options, setOptions] = useState(["", "", "", ""]);
  const [correctIndex, setCorrectIndex] = useState(0);
  const [explanation, setExplanation] = useState("");
  const [saving, setSaving] = useState(false);

  const reset = () => { setQuestion(""); setOptions(["","","",""]); setCorrectIndex(0); setExplanation(""); };

  const submit = async () => {
    if (question.trim().length < 3) { toast.error("প্রশ্ন লিখুন"); return; }
    if (options.some((o) => o.trim().length === 0)) { toast.error("৪টি অপশনই পূরণ করুন"); return; }
    setSaving(true);
    try {
      await addFn({ data: { classLevel, subject: subjectName, chapter, question: question.trim(), options: options.map((o) => o.trim()), correctIndex, explanation: explanation.trim() || undefined } });
      toast.success("প্রশ্ন সেভ হয়েছে");
      reset();
      onSaved();
    } catch (e: any) {
      toast.error(e?.message ?? "ত্রুটি");
    } finally { setSaving(false); }
  };

  return (
    <div className="bg-white rounded-2xl border p-5 space-y-4">
      <div>
        <Label>প্রশ্ন</Label>
        <Textarea value={question} onChange={(e) => setQuestion(e.target.value)} rows={3} placeholder="প্রশ্ন লিখুন..." />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {options.map((opt, i) => (
          <div key={i}>
            <Label className="flex items-center gap-2">
              <input type="radio" checked={correctIndex === i} onChange={() => setCorrectIndex(i)} />
              অপশন {["ক","খ","গ","ঘ"][i]} {correctIndex === i && <span className="text-green-700 text-xs font-bold">(সঠিক)</span>}
            </Label>
            <Input value={opt} onChange={(e) => { const n = [...options]; n[i] = e.target.value; setOptions(n); }} placeholder={`অপশন ${["ক","খ","গ","ঘ"][i]}`} />
          </div>
        ))}
      </div>
      <div>
        <Label>ব্যাখ্যা (ঐচ্ছিক)</Label>
        <Textarea value={explanation} onChange={(e) => setExplanation(e.target.value)} rows={2} placeholder="সঠিক উত্তরের সংক্ষিপ্ত ব্যাখ্যা..." />
      </div>
      <Button onClick={submit} disabled={saving} className="bg-academy-navy text-white hover:bg-academy-navy/90 w-full">
        {saving && <Loader2 className="size-4 mr-1 animate-spin" />}
        প্রশ্ন সেভ করুন
      </Button>
    </div>
  );
}
