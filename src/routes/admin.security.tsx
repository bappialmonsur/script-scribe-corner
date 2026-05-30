import { createFileRoute } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { KeyRound, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/admin/security")({
  component: SecurityPage,
});

function SecurityPage() {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [busy, setBusy] = useState(false);

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (password.length < 6) {
      toast.error("পাসওয়ার্ড কমপক্ষে ৬ অক্ষর হতে হবে");
      return;
    }
    if (password !== confirmPassword) {
      toast.error("দুইবার একই পাসওয়ার্ড লিখুন");
      return;
    }

    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    setPassword("");
    setConfirmPassword("");
    toast.success("পাসওয়ার্ড পরিবর্তন হয়েছে");
  };

  return (
    <div className="max-w-xl mx-auto">
      <div className="mb-6 flex items-center gap-2">
        <KeyRound className="size-6 text-academy-navy" />
        <h1 className="text-2xl font-bold text-academy-navy">পাসওয়ার্ড পরিবর্তন</h1>
      </div>

      <form onSubmit={onSubmit} className="rounded-2xl border bg-white p-6 shadow-sm space-y-4">
        <div className="space-y-2">
          <Label htmlFor="new-password">নতুন পাসওয়ার্ড</Label>
          <PasswordInput
            id="new-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="কমপক্ষে ৬ অক্ষর"
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="confirm-password">আবার লিখুন</Label>
          <PasswordInput
            id="confirm-password"
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
            placeholder="নতুন পাসওয়ার্ড আবার লিখুন"
            required
          />
        </div>
        <Button type="submit" disabled={busy} className="w-full bg-academy-navy text-white hover:bg-academy-navy/90">
          {busy && <Loader2 className="animate-spin" />}
          পাসওয়ার্ড সেভ করুন
        </Button>
      </form>
    </div>
  );
}