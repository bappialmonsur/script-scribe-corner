import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const inputSchema = z.object({
  title: z.string().trim().min(1).max(200),
  tag: z.string().trim().max(100).optional().default(""),
  class_level: z.string().trim().max(20).optional().default(""),
  duration: z.string().trim().max(50).optional().default(""),
  description: z.string().trim().max(800).optional().default(""),
});

function classBn(c: string) {
  const map: Record<string, string> = {
    "5": "পঞ্চম", "6": "ষষ্ঠ", "7": "সপ্তম", "8": "অষ্টম",
    "9": "নবম", "10": "দশম", "11": "একাদশ", "12": "দ্বাদশ",
  };
  return map[c] ?? c;
}

export const generateCourseCover = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => inputSchema.parse(input))
  .handler(async ({ data, context }) => {
    // Admin only
    const { data: roleRow } = await context.supabase
      .from("user_roles").select("role").eq("user_id", context.userId).eq("role", "admin").maybeSingle();
    if (!roleRow) throw new Error("শুধুমাত্র এডমিন এই কাজ করতে পারবেন");

    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("LOVABLE_API_KEY কনফিগার করা নেই");

    const classText = data.class_level ? `${classBn(data.class_level)} শ্রেণি` : "";
    const prompt = `Create an exclusive, premium course cover banner image (16:9 landscape) for an educational coaching center called "সমীকরণ শিক্ষা পরিবার" (Somikoron Shikkha Poribar — a Bangladeshi academy).

COURSE DETAILS TO FEATURE PROMINENTLY:
- Course title: "${data.title}"
${data.tag ? `- Tag/Batch: "${data.tag}"` : ""}
${classText ? `- Class: ${classText}` : ""}
${data.duration ? `- Duration: ${data.duration}` : ""}
${data.description ? `- About: ${data.description}` : ""}

DESIGN REQUIREMENTS:
- Render the course title "${data.title}" as the HERO TYPOGRAPHY in clean, bold Bangla script (Hind Siliguri / Noto Sans Bengali style). The Bangla text must be spelled EXACTLY as given, perfectly legible, no garbled characters.
- Sophisticated editorial composition: deep navy (#0B1F3A) + warm gold (#D4A24C) + soft ivory palette, subtle geometric accents, soft light gradients, premium academic feel — like a top-tier coaching brand poster.
- Include subtle subject-relevant iconography (books, formulas, atoms, graphs) as background motifs — never cartoonish.
- Add the small monogram "Σ" mark and label "সমীকরণ শিক্ষা পরিবার" as a discreet brand lockup in a corner.
${data.tag ? `- Place the tag "${data.tag}" as a small uppercase gold ribbon/chip.` : ""}
${classText ? `- Show "${classText}" subtly near the title.` : ""}
- Award-winning, museum-quality, magazine-cover craftsmanship. NOT generic stock art. NO watermark, NO lorem ipsum, NO misspellings.
- Aspect ratio strictly 16:9, edge-to-edge composition, safe margins for text.`;

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-3.1-flash-image-preview",
        messages: [{ role: "user", content: prompt }],
        modalities: ["image", "text"],
      }),
    });

    if (!res.ok) {
      const t = await res.text();
      if (res.status === 429) throw new Error("অনেক রিকোয়েস্ট হয়েছে, একটু পরে আবার চেষ্টা করুন");
      if (res.status === 402) throw new Error("AI ক্রেডিট শেষ — Workspace > Usage এ টপআপ করুন");
      throw new Error(`AI ছবি জেনারেট ব্যর্থ: ${t.slice(0, 200)}`);
    }

    const json: any = await res.json();
    // Find data URL in response (Gemini image models return as message.images[0].image_url.url)
    let dataUrl: string | undefined =
      json?.choices?.[0]?.message?.images?.[0]?.image_url?.url ??
      json?.choices?.[0]?.message?.images?.[0]?.url;
    if (!dataUrl) {
      // Fallback: search content parts
      const parts = json?.choices?.[0]?.message?.content;
      if (Array.isArray(parts)) {
        for (const p of parts) {
          const u = p?.image_url?.url ?? p?.url;
          if (typeof u === "string" && u.startsWith("data:image/")) { dataUrl = u; break; }
        }
      }
    }
    if (!dataUrl || !dataUrl.startsWith("data:image/")) {
      throw new Error("AI থেকে ছবি পাওয়া যায়নি");
    }

    const m = dataUrl.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
    if (!m) throw new Error("ছবির ফরম্যাট অজানা");
    const mime = m[1];
    const ext = mime.split("/")[1].split("+")[0].replace("jpeg", "jpg");
    const bytes = Uint8Array.from(atob(m[2]), (c) => c.charCodeAt(0));

    const safeSlug = data.title.replace(/[^a-zA-Z0-9\u0980-\u09FF]+/g, "_").slice(0, 40) || "course";
    const path = `courses/ai-${Date.now()}-${safeSlug}.${ext}`;
    const { error: upErr } = await supabaseAdmin.storage
      .from("site-assets")
      .upload(path, bytes, { contentType: mime, upsert: false });
    if (upErr) throw new Error(upErr.message);

    return { path };
  });
