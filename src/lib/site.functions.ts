import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

// Returns a short-lived signed download URL for a pdf_note.
// Admin can download any; students only their class.
export const getPdfDownloadUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ noteId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { userId } = context;

    const { data: note, error: noteErr } = await supabaseAdmin
      .from("pdf_notes")
      .select("id, file_path, class_level, is_active")
      .eq("id", data.noteId)
      .maybeSingle();
    if (noteErr) throw new Error(noteErr.message);
    if (!note || !note.is_active) throw new Error("নোটটি পাওয়া যায়নি");

    // Admin allowed
    const { data: isAdmin } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .eq("role", "admin")
      .maybeSingle();

    if (!isAdmin) {
      const { data: student } = await supabaseAdmin
        .from("students")
        .select("class_level, is_active")
        .eq("user_id", userId)
        .maybeSingle();
      if (!student || !student.is_active || student.class_level !== note.class_level) {
        throw new Error("এই পিডিএফ ডাউনলোডের অনুমতি নেই");
      }
    }

    const { data: signed, error: signErr } = await supabaseAdmin.storage
      .from("pdf-notes")
      .createSignedUrl(note.file_path, 60 * 10);
    if (signErr || !signed) throw new Error(signErr?.message ?? "URL তৈরি ব্যর্থ");
    return { url: signed.signedUrl };
  });
