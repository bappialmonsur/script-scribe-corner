import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const SMS_ENDPOINT = "https://bulksmsbd.net/api/smsapi";

const Input = z.object({
  message: z.string().min(1).max(1000),
  numbers: z.array(z.string().min(8).max(20)).min(1).max(1000),
});

function normalize(n: string) {
  // BulkSMSBD expects 8801XXXXXXXXX (no plus). Strip non-digits, ensure 880 prefix.
  let d = n.replace(/\D/g, "");
  if (d.startsWith("00")) d = d.slice(2);
  if (d.startsWith("880")) return d;
  if (d.startsWith("0")) return "880" + d.slice(1);
  if (d.startsWith("1") && d.length === 10) return "880" + d;
  return d;
}

export const sendBulkSms = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => Input.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    // Admin check
    const { data: isAdmin } = await supabase.rpc("has_role", {
      _user_id: userId,
      _role: "admin",
    });
    if (!isAdmin) {
      throw new Error("শুধু এডমিন SMS পাঠাতে পারবেন");
    }

    const apiKey = process.env.BULKSMSBD_API_KEY;
    const senderId = process.env.BULKSMSBD_SENDER_ID;
    if (!apiKey || !senderId) {
      throw new Error("SMS কনফিগারেশন পাওয়া যায়নি");
    }

    const uniqueNumbers = Array.from(new Set(data.numbers.map(normalize))).filter(
      (n) => n.length === 13,
    );
    if (uniqueNumbers.length === 0) {
      throw new Error("বৈধ কোনো নাম্বার নেই");
    }

    const body = new URLSearchParams({
      api_key: apiKey,
      senderid: senderId,
      number: uniqueNumbers.join(","),
      message: data.message,
      type: "text",
    });

    const res = await fetch(SMS_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    });

    const text = await res.text();
    let json: any = null;
    try {
      json = JSON.parse(text);
    } catch {
      // BulkSMSBD sometimes returns plain text
    }

    const code = json?.response_code ?? res.status;
    const success = code === 202;

    if (!success) {
      const msg =
        json?.error_message ||
        json?.message ||
        text?.slice(0, 200) ||
        `HTTP ${res.status}`;
      throw new Error(`SMS পাঠানো যায়নি: ${msg}`);
    }

    return {
      ok: true,
      sent: uniqueNumbers.length,
      messageId: json?.message_id ?? null,
    };
  });
