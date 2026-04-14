"use client";

import { useState } from "react";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function RegisterPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const r = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          email,
          password,
          ...(name.trim() ? { name: name.trim() } : {}),
        }),
      });
      const data = (await r.json()) as { error?: string };
      if (!r.ok) {
        setError(data.error ?? "Registration failed");
        return;
      }
      window.location.assign("/");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-[calc(100svh-8rem)] flex-col items-center justify-center px-3 py-10 sm:px-4">
      <Card className="mx-auto w-full max-w-md rounded-2xl border shadow-md ring-1 ring-foreground/5">
        <CardHeader className="space-y-1 pb-2">
          <CardTitle className="font-heading text-xl">Create account</CardTitle>
          <CardDescription className="leading-relaxed">Start tracking programs and workouts in one place.</CardDescription>
        </CardHeader>
        <CardContent className="pt-2">
          <form className="space-y-5" onSubmit={onSubmit}>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <div className="space-y-2">
              <Label htmlFor="reg-name">Name (optional)</Label>
              <Input
                id="reg-name"
                type="text"
                autoComplete="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="rounded-xl"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="reg-email">Email</Label>
              <Input
                id="reg-email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="rounded-xl"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="reg-password">Password</Label>
              <Input
                id="reg-password"
                type="password"
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={10}
                className="rounded-xl"
              />
              <p className="text-muted-foreground text-xs">At least 10 characters; avoid common passwords.</p>
            </div>
            <Button type="submit" className="h-12 w-full rounded-xl text-base" disabled={loading}>
              {loading ? <Loader2 className="size-4 animate-spin" /> : "Register"}
            </Button>
            <p className="text-muted-foreground text-center text-sm">
              Already have an account?{" "}
              <Link href="/login" className="text-foreground underline underline-offset-4">
                Sign in
              </Link>
            </p>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
