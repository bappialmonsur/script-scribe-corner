import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { sendBulkSms } from "@/lib/sms.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { Phone, Send, Copy, MessageSquare, Search, Loader2 } from "lucide-react";

export const Route = createFileRoute("/admin/phonebook")({
  component: PhonebookPage,
});

type Row = {
  id: string;
  full_name: string;
  phone: string | null;
  guardian_phone: string | null;
  class_level: string;
  is_active: boolean;
};

function formatPhoneDisplay(phone?: string | null) {
  if (!phone) return "—";
  return "0" + phone.replace(/^\+?880/, "");
}

function PhonebookPage() {
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState<"active" | "inactive">("active");
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const sendSmsApi = useServerFn(sendBulkSms);

  const { data, isLoading } = useQuery({
    queryKey: ["phonebook"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("students")
        .select("id, full_name, phone, guardian_phone, class_level, is_active")
        .order("full_name");
      if (error) throw error;
      return data as Row[];
    },
  });

  const filtered = useMemo(() => {
    const rows = (data ?? []).filter((r) => r.is_active === (tab === "active"));
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(
      (r) =>
        r.full_name.toLowerCase().includes(q) ||
        (r.phone ?? "").includes(q) ||
        (r.guardian_phone ?? "").includes(q),
    );
  }, [data, tab, search]);

  const allNumbers = useMemo(() => {
    const nums = new Set<string>();
    filtered.forEach((r) => {
      if (r.phone) nums.add(r.phone);
      if (r.guardian_phone) nums.add(r.guardian_phone);
    });
    return Array.from(nums);
  }, [filtered]);

  const counts = useMemo(() => {
    const all = data ?? [];
    return {
      active: all.filter((r) => r.is_active).length,
      inactive: all.filter((r) => !r.is_active).length,
    };
  }, [data]);

  const sendSms = async () => {
    if (allNumbers.length === 0) {
      toast.error("কোনো নাম্বার নেই");
      return;
    }
    if (!message.trim()) {
      toast.error("মেসেজ লিখুন");
      return;
    }
    setSending(true);
    try {
      const res = await sendSmsApi({
        data: { message: message.trim(), numbers: allNumbers },
      });
      toast.success(`${res.sent}টি নাম্বারে SMS পাঠানো হয়েছে`);
      setMessage("");
      setOpen(false);
    } catch (e: any) {
      toast.error(e?.message ?? "SMS পাঠানো যায়নি");
    } finally {
      setSending(false);
    }
  };


  const copyNumbers = async () => {
    if (allNumbers.length === 0) return;
    await navigator.clipboard.writeText(allNumbers.join(", "));
    toast.success(`${allNumbers.length}টি নাম্বার কপি হয়েছে`);
  };

  const openWhatsApp = async () => {
    if (allNumbers.length === 0) return;
    try {
      // WhatsApp doesn't support multi-recipient via URL — copy + open
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(allNumbers.join(", "));
        toast.info("নাম্বারগুলো কপি হয়েছে। WhatsApp এ ব্রডকাস্ট লিস্টে পেস্ট করুন।");
      } else {
        toast.info("WhatsApp খোলা হচ্ছে। নাম্বার ম্যানুয়ালি পেস্ট করুন।");
      }
    } catch {
      toast.info("WhatsApp খোলা হচ্ছে।");
    }
    // top-level navigation works inside sandboxed iframes where window.open is blocked
    const win = window.open("https://web.whatsapp.com/", "_blank", "noopener,noreferrer");
    if (!win) {
      // popup blocked — fall back to top-level navigation
      window.location.href = "https://web.whatsapp.com/";
    }
  };

  return (
    <div className="space-y-6 max-w-6xl">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-academy-navy">ফোনবুক</h1>
          <p className="text-muted-foreground text-sm">
            সকল শিক্ষার্থীর নাম ও ফোন নাম্বার
          </p>
        </div>
        <Button
          onClick={() => setOpen(true)}
          className="bg-academy-navy text-white hover:bg-academy-navy/90"
        >
          <Send className="size-4 mr-2" />
          সবাইকে মেসেজ পাঠান
        </Button>
      </div>

      <div className="flex gap-2 flex-wrap">
        <button
          onClick={() => setTab("active")}
          className={`px-4 py-2 rounded-xl text-sm font-medium border transition ${
            tab === "active"
              ? "bg-academy-navy text-white border-academy-navy"
              : "bg-white text-academy-navy border-academy-navy/20 hover:border-academy-navy/40"
          }`}
        >
          একটিভ ({counts.active})
        </button>
        <button
          onClick={() => setTab("inactive")}
          className={`px-4 py-2 rounded-xl text-sm font-medium border transition ${
            tab === "inactive"
              ? "bg-academy-navy text-white border-academy-navy"
              : "bg-white text-academy-navy border-academy-navy/20 hover:border-academy-navy/40"
          }`}
        >
          ইনএকটিভ ({counts.inactive})
        </button>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="নাম বা ফোন দিয়ে খুঁজুন..."
          className="pl-9"
        />
      </div>

      <div className="bg-white rounded-2xl border overflow-hidden">
        {isLoading ? (
          <div className="p-10 flex justify-center">
            <Loader2 className="size-6 animate-spin text-academy-navy" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-10 text-center text-muted-foreground text-sm">
            কোনো শিক্ষার্থী পাওয়া যায়নি
          </div>
        ) : (
          <ul className="divide-y">
            {filtered.map((r) => (
              <li key={r.id} className="p-4 flex items-center justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="font-medium text-academy-navy truncate">{r.full_name}</div>
                  <div className="text-xs text-muted-foreground">
                    ক্লাস {r.class_level} · {formatPhoneDisplay(r.phone)}
                    {r.guardian_phone && (
                      <> · অভিভাবক: {formatPhoneDisplay(r.guardian_phone)}</>
                    )}
                  </div>
                </div>
                {r.phone && (
                  <a
                    href={`tel:${r.phone}`}
                    className="size-9 rounded-full bg-academy-soft hover:bg-academy-navy hover:text-white flex items-center justify-center transition shrink-0"
                    aria-label="কল করুন"
                  >
                    <Phone className="size-4" />
                  </a>
                )}
                {r.phone && (
                  <a
                    href={`sms:${r.phone}`}
                    className="size-9 rounded-full bg-academy-soft hover:bg-academy-navy hover:text-white flex items-center justify-center transition shrink-0"
                    aria-label="মেসেজ পাঠান"
                  >
                    <MessageSquare className="size-4" />
                  </a>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              সবাইকে মেসেজ পাঠান ({allNumbers.length}টি নাম্বার)
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground">
              বর্তমান ফিল্টার ({tab === "active" ? "একটিভ" : "ইনএকটিভ"}) অনুযায়ী
              শিক্ষার্থী ও অভিভাবকের নাম্বারগুলোতে SMS API দিয়ে মেসেজ যাবে।
            </p>
            <Textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="আপনার মেসেজ লিখুন..."
              rows={5}
              maxLength={1000}
            />
            <div className="text-xs text-muted-foreground text-right">
              {message.length}/1000
            </div>
            <Button
              onClick={sendSms}
              disabled={sending || !message.trim() || allNumbers.length === 0}
              className="bg-academy-navy text-white hover:bg-academy-navy/90 w-full"
            >
              {sending ? (
                <Loader2 className="size-4 mr-2 animate-spin" />
              ) : (
                <Send className="size-4 mr-2" />
              )}
              {sending ? "পাঠানো হচ্ছে..." : `SMS পাঠান (${allNumbers.length})`}
            </Button>
            <div className="grid grid-cols-2 gap-2">
              <Button onClick={openWhatsApp} variant="outline" size="sm">
                <MessageSquare className="size-4 mr-2" /> WhatsApp
              </Button>
              <Button onClick={copyNumbers} variant="outline" size="sm">
                <Copy className="size-4 mr-2" /> নাম্বার কপি
              </Button>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>বন্ধ</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
