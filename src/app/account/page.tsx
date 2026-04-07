"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PASSWORD_MIN_LENGTH } from "@/lib/auth/password-policy";

export default function AccountPage() {
  const router = useRouter();
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["account"],
    queryFn: async () => {
      const r = await fetch("/api/account");
      if (!r.ok) throw new Error("Failed");
      return r.json() as Promise<{ user: { id: string; email: string; name: string | null } }>;
    },
  });

  const [nameDraft, setNameDraft] = useState("");
  const [emailDraft, setEmailDraft] = useState("");
  const [currentForEmail, setCurrentForEmail] = useState("");
  const [currentPw, setCurrentPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!data?.user) return;
    setNameDraft(data.user.name ?? "");
    setEmailDraft(data.user.email);
  }, [data]);

  const save = useMutation({
    mutationFn: async (body: Record<string, unknown>) => {
      const r = await fetch("/api/account", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const j = (await r.json().catch(() => ({}))) as { error?: string; user?: { email: string; name: string | null } };
      if (!r.ok) throw new Error(j.error ?? "Save failed");
      return j;
    },
    onSuccess: async (j) => {
      setErr(null);
      setMsg("Saved.");
      if (j.user) {
        setEmailDraft(j.user.email);
        setNameDraft(j.user.name ?? "");
      }
      await qc.invalidateQueries({ queryKey: ["account"] });
      await qc.invalidateQueries({ queryKey: ["auth", "me"] });
      setCurrentForEmail("");
      setCurrentPw("");
      setNewPw("");
    },
    onError: (e: Error) => {
      setMsg(null);
      setErr(e.message);
    },
  });

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    await qc.invalidateQueries({ queryKey: ["auth", "me"] });
    router.push("/login");
    router.refresh();
  }

  if (isLoading || !data) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="size-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight font-heading">Account</h1>
        <p className="text-muted-foreground text-sm">Profile, email, password, and sign out.</p>
        <Link href="/settings" className="text-xs text-primary underline-offset-4 hover:underline mt-1 inline-block">
          ← Back to Settings
        </Link>
      </div>

      {msg && <p className="text-sm text-emerald-600 dark:text-emerald-400">{msg}</p>}
      {err && <p className="text-sm text-destructive">{err}</p>}

      <Card className="rounded-2xl shadow-sm">
        <CardHeader>
          <CardTitle className="text-lg">Profile</CardTitle>
          <CardDescription>Display name shown in the header.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="acc-name">Name</Label>
            <Input
              id="acc-name"
              value={nameDraft}
              onChange={(e) => setNameDraft(e.target.value)}
              className="rounded-xl"
              autoComplete="name"
            />
          </div>
          <Button
            type="button"
            className="rounded-xl"
            disabled={save.isPending}
            onClick={() => {
              setMsg(null);
              setErr(null);
              save.mutate({ name: nameDraft.trim() === "" ? "" : nameDraft.trim() });
            }}
          >
            {save.isPending ? <Loader2 className="size-4 animate-spin" /> : "Save name"}
          </Button>
        </CardContent>
      </Card>

      <Card className="rounded-2xl shadow-sm">
        <CardHeader>
          <CardTitle className="text-lg">Email</CardTitle>
          <CardDescription>Enter your current password to change email.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="acc-email">Email</Label>
            <Input
              id="acc-email"
              type="email"
              value={emailDraft}
              onChange={(e) => setEmailDraft(e.target.value)}
              className="rounded-xl"
              autoComplete="email"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="acc-email-pw">Current password</Label>
            <Input
              id="acc-email-pw"
              type="password"
              value={currentForEmail}
              onChange={(e) => setCurrentForEmail(e.target.value)}
              className="rounded-xl"
              autoComplete="current-password"
            />
          </div>
          <Button
            type="button"
            variant="secondary"
            className="rounded-xl"
            disabled={save.isPending}
            onClick={() => {
              setMsg(null);
              setErr(null);
              save.mutate({
                email: emailDraft.trim().toLowerCase(),
                currentPassword: currentForEmail,
              });
            }}
          >
            {save.isPending ? <Loader2 className="size-4 animate-spin" /> : "Update email"}
          </Button>
        </CardContent>
      </Card>

      <Card className="rounded-2xl shadow-sm">
        <CardHeader>
          <CardTitle className="text-lg">Password</CardTitle>
          <CardDescription>At least {PASSWORD_MIN_LENGTH} characters; avoid very common passwords.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="acc-cur-pw">Current password</Label>
            <Input
              id="acc-cur-pw"
              type="password"
              value={currentPw}
              onChange={(e) => setCurrentPw(e.target.value)}
              className="rounded-xl"
              autoComplete="current-password"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="acc-new-pw">New password</Label>
            <Input
              id="acc-new-pw"
              type="password"
              value={newPw}
              onChange={(e) => setNewPw(e.target.value)}
              className="rounded-xl"
              autoComplete="new-password"
              minLength={PASSWORD_MIN_LENGTH}
            />
          </div>
          <Button
            type="button"
            variant="secondary"
            className="rounded-xl"
            disabled={save.isPending}
            onClick={() => {
              setMsg(null);
              setErr(null);
              save.mutate({
                currentPassword: currentPw,
                newPassword: newPw,
              });
            }}
          >
            {save.isPending ? <Loader2 className="size-4 animate-spin" /> : "Update password"}
          </Button>
        </CardContent>
      </Card>

      <Card className="rounded-2xl border-destructive/30 shadow-sm">
        <CardHeader>
          <CardTitle className="text-lg">Session</CardTitle>
          <CardDescription>Sign out on this device.</CardDescription>
        </CardHeader>
        <CardContent>
          <Button type="button" variant="outline" className="rounded-xl" onClick={() => void logout()}>
            Log out
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
