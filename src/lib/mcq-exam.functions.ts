import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

// Throws unless the given user has the admin role. Uses supabaseAdmin so the
// check cannot be bypassed even though writes below also use supabaseAdmin.
async function assertAdmin(userId: string) {
  const { data: isAdminRow } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();
  if (!isAdminRow) throw new Error("শুধু অ্যাডমিন এই কাজ করতে পারে");
}

export type McqQuestion = {
  question: string;
  options: string[];
  answerIndex: number;
  explanation?: string;
};

/* =========================================================
   STUDENT: get 30 random questions for an exam from DB
   No AI call → no credits used per exam.
   ========================================================= */
const getInputSchema = z.object({
  classLevel: z.string().min(1).max(3),
  subject: z.string().min(1).max(120),
  chapter: z.string().min(1).max(160),
});

export const getExamQuestions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => getInputSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase } = context;

    // Pull a generous pool then shuffle in-memory & take 30 — gives ~90%
    // variation between attempts when pool >= ~60.
    const { data: rows, error } = await supabase
      .from("mcq_questions")
      .select("id, question, options, correct_index, explanation")
      .eq("class_level", data.classLevel as any)
      .eq("subject", data.subject)
      .eq("chapter", data.chapter)
      .eq("is_active", true)
      .limit(500);

    if (error) throw new Error(error.message);
    const pool = rows ?? [];
    if (pool.length < 10) {
      throw new Error(
        `এই অধ্যায়ে এখনো যথেষ্ট প্রশ্ন নেই (${pool.length}টি আছে, কমপক্ষে ১০টি দরকার)। অ্যাডমিন প্রশ্ন যোগ করলে পরীক্ষা দেওয়া যাবে।`,
      );
    }

    // Fisher–Yates shuffle
    const arr = [...pool];
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    const picked = arr.slice(0, Math.min(30, arr.length));

    const questions: McqQuestion[] = picked.map((r: any) => ({
      question: r.question,
      options: Array.isArray(r.options) ? r.options : [],
      answerIndex: r.correct_index,
      explanation: r.explanation ?? undefined,
    }));

    return { questions };
  });

/* =========================================================
   ADMIN: list / count questions per class/subject/chapter
   ========================================================= */
const listInputSchema = z.object({
  classLevel: z.string().min(1).max(3),
  subject: z.string().min(1).max(120),
  chapter: z.string().min(1).max(160),
});

export const listQuestions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => listInputSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: isAdminRow } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .eq("role", "admin")
      .maybeSingle();
    if (!isAdminRow) throw new Error("শুধু অ্যাডমিন এই কাজ করতে পারে");

    const { data: rows, error } = await supabase
      .from("mcq_questions")
      .select("id, question, options, correct_index, explanation, source, created_at")
      .eq("class_level", data.classLevel as any)
      .eq("subject", data.subject)
      .eq("chapter", data.chapter)
      .eq("is_active", true)
      .order("created_at", { ascending: false })
      .limit(500);

    if (error) throw new Error(error.message);
    return { questions: rows ?? [] };
  });

/* =========================================================
   ADMIN: add a manual question
   ========================================================= */
const manualSchema = z.object({
  classLevel: z.string().min(1).max(3),
  subject: z.string().min(1).max(120),
  chapter: z.string().min(1).max(160),
  question: z.string().min(3).max(2000),
  options: z.array(z.string().min(1).max(500)).length(4),
  correctIndex: z.number().int().min(0).max(3),
  explanation: z.string().max(2000).optional(),
});

export const addManualQuestion = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => manualSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { userId } = context;
    await assertAdmin(userId);
    const { error } = await supabaseAdmin.from("mcq_questions").insert({
      class_level: data.classLevel as any,
      subject: data.subject,
      chapter: data.chapter,
      question: data.question,
      options: data.options,
      correct_index: data.correctIndex,
      explanation: data.explanation || null,
      source: "manual",
      created_by: userId,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/* =========================================================
   ADMIN: delete a question (soft delete via is_active=false)
   ========================================================= */
const deleteSchema = z.object({ id: z.string().uuid() });

export const deleteQuestion = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => deleteSchema.parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const { error } = await supabaseAdmin
      .from("mcq_questions")
      .update({ is_active: false })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/* =========================================================
   ADMIN: AI-generate a batch of questions and save to DB
   Charges credits ONLY when admin presses the button.
   Students taking the exam never trigger this.
   ========================================================= */
const aiBatchSchema = z.object({
  classLevel: z.string().min(1).max(3),
  subject: z.string().min(1).max(120),
  chapter: z.string().min(1).max(160),
  count: z.number().int().min(5).max(50),
});

export const aiGenerateQuestions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => aiBatchSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { userId } = context;
    await assertAdmin(userId);
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("AI কনফিগারেশন পাওয়া যায়নি");

    const system = `তুমি বাংলাদেশের NCTB ২০২৬ সালের পাঠ্যবইয়ের একজন অভিজ্ঞ শিক্ষক। প্রশ্ন বাংলায় হবে (English বিষয় হলে ইংরেজিতে)। অধ্যায়ভিত্তিক, পাঠ্যবইয়ের তথ্যনির্ভর বহুনির্বাচনি (MCQ)। প্রতি প্রশ্নে ঠিক ৪টি অপশন, একটি সঠিক উত্তর। মান ও ভাষা শ্রেণি অনুযায়ী মানানসই।`;

    const user = `ঠিক ${data.count}টি বহুনির্বাচনি প্রশ্ন তৈরি করো:
- শ্রেণি: ${data.classLevel}ম
- বিষয়: ${data.subject}
- অধ্যায়: ${data.chapter}
- পাঠ্যক্রম: NCTB ২০২৬
- সহজ, মাঝারি, কঠিন মিশ্রিত
- প্রতি প্রশ্নে ৪টি অপশন, answerIndex 0..3
- explanation এক বাক্যে`;

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
        tools: [{
          type: "function",
          function: {
            name: "submit_mcq",
            parameters: {
              type: "object",
              properties: {
                questions: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      question: { type: "string" },
                      options: { type: "array", items: { type: "string" }, minItems: 4, maxItems: 4 },
                      answerIndex: { type: "integer", minimum: 0, maximum: 3 },
                      explanation: { type: "string" },
                    },
                    required: ["question", "options", "answerIndex"],
                  },
                },
              },
              required: ["questions"],
            },
          },
        }],
        tool_choice: { type: "function", function: { name: "submit_mcq" } },
      }),
    });

    if (!res.ok) {
      if (res.status === 429) throw new Error("অনেকবার অনুরোধ — পরে চেষ্টা করুন");
      if (res.status === 402) throw new Error("AI ক্রেডিট শেষ। ওয়ার্কস্পেস সেটিংসে ক্রেডিট যোগ করুন।");
      const t = await res.text().catch(() => "");
      throw new Error(`AI ত্রুটি (${res.status}): ${t.slice(0, 200)}`);
    }

    const body = await res.json();
    const argsStr = body?.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
    if (!argsStr) throw new Error("AI প্রশ্ন তৈরি করতে পারেনি");
    let parsed: { questions: McqQuestion[] };
    try { parsed = JSON.parse(argsStr); } catch { throw new Error("AI উত্তর পার্স করা যায়নি"); }

    const valid = (parsed.questions ?? []).filter(
      (q) => q && typeof q.question === "string" &&
        Array.isArray(q.options) && q.options.length === 4 &&
        Number.isInteger(q.answerIndex) && q.answerIndex >= 0 && q.answerIndex <= 3,
    );
    if (valid.length === 0) throw new Error("কোনো বৈধ প্রশ্ন পাওয়া যায়নি");

    const rows = valid.map((q) => ({
      class_level: data.classLevel as any,
      subject: data.subject,
      chapter: data.chapter,
      question: q.question,
      options: q.options,
      correct_index: q.answerIndex,
      explanation: q.explanation || null,
      source: "ai" as const,
      created_by: userId,
    }));

    const { error } = await supabaseAdmin.from("mcq_questions").insert(rows);
    if (error) throw new Error(error.message);
    return { saved: rows.length };
  });
