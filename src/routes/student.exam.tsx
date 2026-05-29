import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useSession } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Loader2, BookOpenCheck, Timer, CheckCircle2, XCircle, Sparkles, RotateCcw } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { getSubjects } from "@/lib/curriculum";
import { getExamQuestions, type McqQuestion } from "@/lib/mcq-exam.functions";
import { bnClass, bnNum } from "@/lib/grading";
import { toast } from "sonner";
import { MathText } from "@/components/math-text";

export const Route = createFileRoute("/student/exam")({
  component: ExamPage,
});

type Stage = "select" | "loading" | "running" | "result";

function ExamPage() {
  const { user } = useSession();
  const generate = useServerFn(getExamQuestions);

  const { data: student } = useQuery({
    queryKey: ["my-student-exam", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase.from("students").select("class_level, full_name").eq("user_id", user!.id).maybeSingle();
      return data;
    },
  });

  const [stage, setStage] = useState<Stage>("select");
  const [subjectKey, setSubjectKey] = useState<string>("");
  const [chapter, setChapter] = useState<string>("");

  const [questions, setQuestions] = useState<McqQuestion[]>([]);
  const [answers, setAnswers] = useState<(number | null)[]>([]);
  const [current, setCurrent] = useState(0);

  // Deadline-based timer (tamper-resistant: derived from Date.now(),
  // not from a mutable countdown state that can be overridden via devtools).
  const DURATION_MS = 30 * 60 * 1000;
  const deadlineRef = useRef<number | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(30 * 60);
  const autoSubmittedRef = useRef(false);

  const subjects = useMemo(() => (student ? getSubjects(student.class_level) : []), [student]);
  const subject = subjects.find((s) => s.key === subjectKey);

  const finalize = useCallback(() => {
    if (autoSubmittedRef.current) return;
    autoSubmittedRef.current = true;
    deadlineRef.current = null;
    setSecondsLeft(0);
    setStage("result");
  }, []);

  // Timer loop — uses real wall-clock so backgrounded tabs / paused JS
  // still expire correctly when the user returns.
  useEffect(() => {
    if (stage !== "running" || deadlineRef.current == null) return;
    const tick = () => {
      const remaining = Math.max(0, Math.ceil((deadlineRef.current! - Date.now()) / 1000));
      setSecondsLeft(remaining);
      if (remaining <= 0) {
        finalize();
        toast.info("সময় শেষ — পরীক্ষা স্বয়ংক্রিয়ভাবে জমা হয়েছে");
      }
    };
    tick();
    const id = setInterval(tick, 500);
    const onVis = () => tick();
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("focus", onVis);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("focus", onVis);
    };
  }, [stage, finalize]);


  async function startExam() {
    if (!student || !subject || !chapter) {
      toast.error("বিষয় ও অধ্যায় নির্বাচন করুন");
      return;
    }
    setStage("loading");
    try {
      const res = await generate({
        data: {
          classLevel: student.class_level,
          subject: subject.name,
          chapter,
        },
      });
      setQuestions(res.questions);
      setAnswers(Array(res.questions.length).fill(null));
      setCurrent(0);
      autoSubmittedRef.current = false;
      deadlineRef.current = Date.now() + DURATION_MS;
      setSecondsLeft(Math.ceil(DURATION_MS / 1000));
      setStage("running");
    } catch (e: any) {
      toast.error(e?.message ?? "প্রশ্ন তৈরি করা যায়নি");
      setStage("select");
    }
  }

  function selectOption(i: number) {
    setAnswers((prev) => {
      const next = [...prev];
      next[current] = i;
      return next;
    });
  }

  function submit() {
    finalize();
  }

  function reset() {
    autoSubmittedRef.current = false;
    deadlineRef.current = null;
    setStage("select");
    setQuestions([]);
    setAnswers([]);
    setCurrent(0);
    setSecondsLeft(Math.ceil(DURATION_MS / 1000));
  }


  if (!student) {
    return <div className="p-12 flex justify-center"><Loader2 className="animate-spin" /></div>;
  }

  // ===== SELECT =====
  if (stage === "select") {
    return (
      <div className="space-y-5 max-w-3xl">
        <div className="flex items-center gap-3">
          <div className="size-11 rounded-2xl bg-gradient-to-br from-academy-navy to-academy-navy/80 text-academy-gold flex items-center justify-center shadow">
            <BookOpenCheck />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-academy-navy">অনলাইন পরীক্ষা</h1>
            <p className="text-sm text-muted-foreground">{bnClass(student.class_level)} শ্রেণি · NCTB ২০২৬ · ৩০ MCQ · ৩০ মিনিট</p>
          </div>
        </div>

        <div className="bg-gradient-to-br from-academy-gold/15 to-amber-100/40 border border-amber-200 rounded-2xl p-4 flex gap-3">
          <Sparkles className="size-5 text-amber-600 shrink-0 mt-0.5" />
          <div className="text-sm text-academy-navy">
            প্রশ্নব্যাংক থেকে <b>প্রতিবার ৩০টি র‍্যান্ডম প্রশ্ন</b> বেছে নেওয়া হয়—একই অধ্যায়ে বারবার পরীক্ষা দিলেও প্রশ্ন আলাদা হবে। শেষ হলে স্কোর ও সঠিক উত্তর দেখানো হবে।
          </div>
        </div>

        <div className="bg-white rounded-2xl border p-5 space-y-4">
          <div>
            <label className="text-sm font-bold text-academy-navy block mb-2">বিষয় নির্বাচন করুন</label>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
              {subjects.map((s) => (
                <button
                  key={s.key}
                  onClick={() => { setSubjectKey(s.key); setChapter(""); }}
                  className={`text-sm rounded-xl border p-3 text-left transition-all ${
                    subjectKey === s.key
                      ? "border-academy-gold bg-academy-gold/10 text-academy-navy font-bold shadow"
                      : "border-academy-navy/10 hover:border-academy-navy/30 text-academy-navy"
                  }`}
                >
                  {s.name}
                </button>
              ))}
            </div>
          </div>

          {subject && (
            <div>
              <label className="text-sm font-bold text-academy-navy block mb-2">অধ্যায় নির্বাচন করুন</label>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-80 overflow-auto">
                {subject.chapters.map((ch) => (
                  <button
                    key={ch}
                    onClick={() => setChapter(ch)}
                    className={`text-sm rounded-xl border p-3 text-left transition-all ${
                      chapter === ch
                        ? "border-academy-gold bg-academy-gold/10 text-academy-navy font-bold shadow"
                        : "border-academy-navy/10 hover:border-academy-navy/30 text-academy-navy"
                    }`}
                  >
                    {ch}
                  </button>
                ))}
              </div>
            </div>
          )}

          <Button
            onClick={startExam}
            disabled={!subject || !chapter}
            className="w-full bg-academy-navy text-white hover:bg-academy-navy/90 h-12 text-base font-bold"
          >
            পরীক্ষা শুরু করুন
          </Button>
        </div>
      </div>
    );
  }

  // ===== LOADING =====
  if (stage === "loading") {
    return (
      <div className="max-w-md mx-auto py-16 text-center space-y-4">
        <Loader2 className="size-12 mx-auto animate-spin text-academy-navy" />
        <div className="text-academy-navy font-bold">প্রশ্ন প্রস্তুত করা হচ্ছে…</div>
      </div>
    );
  }

  // ===== RUNNING =====
  if (stage === "running") {
    const q = questions[current];
    const mm = String(Math.floor(secondsLeft / 60)).padStart(2, "0");
    const ss = String(secondsLeft % 60).padStart(2, "0");
    const answeredCount = answers.filter((a) => a != null).length;
    const answeredPct = Math.round((answeredCount / questions.length) * 100);
    const timePct = Math.round((secondsLeft / (30 * 60)) * 100);

    return (
      <div className="space-y-4 max-w-3xl">
        <div className="bg-white rounded-2xl border p-4 sticky top-14 z-10 shadow-sm space-y-3">
          <div className="flex items-center gap-3">
            <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg font-bold ${secondsLeft < 60 ? "bg-red-100 text-red-700" : "bg-academy-soft text-academy-navy"}`}>
              <Timer className="size-4" />
              {bnNum(mm)}:{bnNum(ss)}
            </div>
            <div className="text-sm text-muted-foreground">
              প্রশ্ন {bnNum(current + 1)}/{bnNum(questions.length)} · উত্তর: {bnNum(answeredCount)}
            </div>
            <Button onClick={submit} variant="outline" className="ml-auto h-8 text-xs">জমা দিন</Button>
          </div>
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-[11px] text-muted-foreground">
              <span>অগ্রগতি</span>
              <span className="font-bold text-academy-navy">{bnNum(answeredPct)}%</span>
            </div>
            <Progress value={answeredPct} className="h-2" />
            <div className="flex items-center justify-between text-[11px] text-muted-foreground pt-1">
              <span>সময় বাকি</span>
              <span className={`font-bold ${secondsLeft < 60 ? "text-red-600" : "text-academy-navy"}`}>{bnNum(timePct)}%</span>
            </div>
            <Progress value={timePct} className={`h-2 ${secondsLeft < 60 ? "[&>div]:bg-red-500" : "[&>div]:bg-academy-gold"}`} />
          </div>
        </div>


        <div className="bg-white rounded-2xl border p-5">
          <div className="text-xs text-academy-gold font-bold mb-2">প্রশ্ন {bnNum(current + 1)}</div>
          <div className="font-bold text-academy-navy text-base leading-relaxed mb-4"><MathText>{q.question}</MathText></div>
          <div className="space-y-2">
            {q.options.map((opt, i) => {
              const selected = answers[current] === i;
              return (
                <button
                  key={i}
                  onClick={() => selectOption(i)}
                  className={`w-full text-left rounded-xl border p-3 flex items-center gap-3 transition-all ${
                    selected
                      ? "border-academy-gold bg-academy-gold/10 shadow"
                      : "border-academy-navy/10 hover:border-academy-navy/30 bg-white"
                  }`}
                >
                  <span className={`size-8 rounded-lg flex items-center justify-center font-bold shrink-0 ${
                    selected ? "bg-academy-gold text-academy-navy" : "bg-academy-soft text-academy-navy"
                  }`}>
                    {["ক", "খ", "গ", "ঘ"][i]}
                  </span>
                  <span className="text-sm text-academy-navy flex-1"><MathText>{opt}</MathText></span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex gap-2">
          <Button
            variant="outline"
            disabled={current === 0}
            onClick={() => setCurrent((c) => Math.max(0, c - 1))}
          >
            পূর্ববর্তী
          </Button>
          {current < questions.length - 1 ? (
            <Button
              className="ml-auto bg-academy-navy text-white hover:bg-academy-navy/90"
              onClick={() => setCurrent((c) => Math.min(questions.length - 1, c + 1))}
            >
              পরবর্তী
            </Button>
          ) : (
            <Button className="ml-auto bg-academy-gold text-academy-navy hover:bg-academy-gold/90 font-bold" onClick={submit}>
              পরীক্ষা জমা দিন
            </Button>
          )}
        </div>

        {/* Question grid */}
        <div className="bg-white rounded-2xl border p-4">
          <div className="text-xs text-muted-foreground mb-2">দ্রুত নেভিগেশন</div>
          <div className="grid grid-cols-10 gap-1.5">
            {questions.map((_, i) => {
              const ans = answers[i] != null;
              const isCur = i === current;
              return (
                <button
                  key={i}
                  onClick={() => setCurrent(i)}
                  className={`aspect-square rounded-md text-xs font-bold ${
                    isCur
                      ? "bg-academy-navy text-white ring-2 ring-academy-gold"
                      : ans
                      ? "bg-academy-gold/30 text-academy-navy"
                      : "bg-academy-soft text-academy-navy/70"
                  }`}
                >
                  {bnNum(i + 1)}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  // ===== RESULT =====
  const correct = questions.reduce((acc, q, i) => acc + (answers[i] === q.answerIndex ? 1 : 0), 0);
  const pct = Math.round((correct / questions.length) * 100);
  const grade =
    pct >= 80 ? { g: "A+", c: "text-green-600 bg-green-50" }
    : pct >= 70 ? { g: "A", c: "text-green-600 bg-green-50" }
    : pct >= 60 ? { g: "A-", c: "text-blue-600 bg-blue-50" }
    : pct >= 50 ? { g: "B", c: "text-blue-600 bg-blue-50" }
    : pct >= 40 ? { g: "C", c: "text-amber-600 bg-amber-50" }
    : pct >= 33 ? { g: "D", c: "text-amber-600 bg-amber-50" }
    : { g: "F", c: "text-red-600 bg-red-50" };

  return (
    <div className="space-y-5 max-w-3xl">
      <div className="bg-gradient-to-br from-academy-navy to-academy-navy/80 text-white rounded-2xl p-6 shadow">
        <div className="text-xs opacity-80">ফলাফল</div>
        <div className="text-3xl font-bold mt-1">{bnNum(correct)} / {bnNum(questions.length)}</div>
        <div className="flex items-center gap-3 mt-2">
          <span className={`px-2.5 py-0.5 rounded-lg font-bold ${grade.c}`}>{grade.g}</span>
          <span className="text-sm opacity-90">{bnNum(pct)}% সঠিক</span>
        </div>
        <div className="text-xs opacity-80 mt-2">{subject?.name} · {chapter}</div>
      </div>

      <div className="flex gap-2">
        <Button onClick={reset} className="bg-academy-gold text-academy-navy hover:bg-academy-gold/90 font-bold">
          <RotateCcw className="size-4 mr-1" /> নতুন পরীক্ষা
        </Button>
      </div>

      <div className="space-y-3">
        <h2 className="font-bold text-academy-navy">সঠিক উত্তরসহ পর্যালোচনা</h2>
        {questions.map((q, i) => {
          const my = answers[i];
          const isCorrect = my === q.answerIndex;
          return (
            <div key={i} className="bg-white rounded-2xl border p-4">
              <div className="flex items-start gap-2">
                {isCorrect ? (
                  <CheckCircle2 className="size-5 text-green-600 shrink-0 mt-0.5" />
                ) : (
                  <XCircle className="size-5 text-red-600 shrink-0 mt-0.5" />
                )}
                <div className="font-bold text-academy-navy text-sm leading-relaxed">
                  {bnNum(i + 1)}. <MathText>{q.question}</MathText>
                </div>
              </div>
              <div className="space-y-1.5 mt-3 ml-7">
                {q.options.map((opt, j) => {
                  const isAnswer = j === q.answerIndex;
                  const isMine = j === my;
                  return (
                    <div
                      key={j}
                      className={`text-sm rounded-lg px-3 py-2 border ${
                        isAnswer
                          ? "border-green-300 bg-green-50 text-green-800 font-medium"
                          : isMine
                          ? "border-red-300 bg-red-50 text-red-800"
                          : "border-academy-navy/10 text-academy-navy/80"
                      }`}
                    >
                      <span className="font-bold mr-1">{["ক", "খ", "গ", "ঘ"][j]}.</span>
                      <MathText>{opt}</MathText>
                      {isAnswer && <span className="ml-2 text-xs font-bold">✓ সঠিক</span>}
                      {isMine && !isAnswer && <span className="ml-2 text-xs font-bold">আপনার উত্তর</span>}
                    </div>
                  );
                })}
              </div>
              {q.explanation && (
                <div className="ml-7 mt-2 text-xs text-muted-foreground bg-academy-soft rounded-lg px-3 py-2">
                  <b className="text-academy-navy">ব্যাখ্যা:</b> <MathText>{q.explanation}</MathText>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
