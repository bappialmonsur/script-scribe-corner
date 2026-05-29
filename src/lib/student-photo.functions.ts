import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

// Save the storage path of the caller's profile photo onto their own student row.
// Students cannot UPDATE the students table directly (admin-only RLS), so this
// runs server-side and only touches the authenticated user's own row + photo_path.
export const setMyPhoto = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({
      // path must live inside the caller's own folder (uid/...)
      photoPath: z.string().min(1).max(300).nullable(),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { userId } = context;

    const { data: me } = await supabaseAdmin
      .from("students").select("id, is_active").eq("user_id", userId).maybeSingle();
    if (!me || !me.is_active) throw new Error("অ্যাক্সেস নেই");

    if (data.photoPath && !data.photoPath.startsWith(`${userId}/`)) {
      throw new Error("অবৈধ ছবির পথ");
    }

    const { error } = await supabaseAdmin
      .from("students").update({ photo_path: data.photoPath }).eq("id", me.id);
    if (error) throw new Error(error.message);

    return { ok: true };
  });

// Return a short-lived signed URL for the caller's own profile photo.
export const getMyPhotoUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { userId } = context;
    const { data: me } = await supabaseAdmin
      .from("students").select("photo_path").eq("user_id", userId).maybeSingle();
    if (!me?.photo_path) return { url: null as string | null };

    const { data: signed } = await supabaseAdmin.storage
      .from("student-photos").createSignedUrl(me.photo_path, 60 * 60);
    return { url: signed?.signedUrl ?? null };
  });
