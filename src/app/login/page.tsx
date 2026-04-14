"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

function LoginForm() {
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const r = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email, password }),
      });
      const data = (await r.json()) as { error?: string };
      if (!r.ok) {
        setError(data.error ?? "Sign in failed");
        return;
      }
      const raw = searchParams.get("next");
      const pathOnly = raw?.split("?")[0] ?? "";
      const authPaths = new Set(["/login", "/register"]);
      const next =
        raw && raw.startsWith("/") && !raw.startsWith("//") && !authPaths.has(pathOnly) ? raw : "/";
      // Full navigation: iOS Safari often does not send the new cookie on immediate client-side routing.
      window.location.assign(next);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card className="mx-auto w-full max-w-md rounded-2xl border shadow-md ring-1 ring-foreground/5">
      <CardHeader className="space-y-1 pb-2">
        <CardTitle className="font-heading text-xl">Sign in</CardTitle>
        <CardDescription className="leading-relaxed">Use your email and password to continue.</CardDescription>
      </CardHeader>
      <CardContent className="pt-2">
        <form className="space-y-5" onSubmit={onSubmit}>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <div className="space-y-2">
            <Label htmlFor="login-email">Email</Label>
            <Input
              id="login-email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="rounded-xl"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="login-password">Password</Label>
            <Input
              id="login-password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="rounded-xl"
            />
          </div>
          <Button type="submit" className="h-12 w-full rounded-xl text-base" disabled={loading}>
            {loading ? <Loader2 className="size-4 animate-spin" /> : "Sign in"}
          </Button>
          <p className="text-muted-foreground text-center text-sm">
            No account?{" "}
            <Link href="/register" className="text-foreground underline underline-offset-4">
              Create one
            </Link>
          </p>
        </form>
      </CardContent>
    </Card>
  );
}

export default function LoginPage() {
  return (
    <div className="flex min-h-[calc(100svh-8rem)] flex-col items-center justify-center px-3 py-10 sm:px-4">
      <Suspense
        fallback={
          <div className="flex justify-center py-20">
            <Loader2 className="size-8 animate-spin text-muted-foreground" />
          </div>
        }
      >
        <LoginForm />
      </Suspense>
    </div>
  );
}
