"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { Loader2, Plus } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { browserApiFetchInit } from "@/lib/browser-api-fetch";

export default function ProgramsPage() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["programs"],
    queryFn: async () => {
      const r = await fetch("/api/programs", browserApiFetchInit);
      if (!r.ok) throw new Error("Failed");
      return r.json() as Promise<
        {
          id: string;
          name: string;
          durationWeeks: number;
          _count: { days: number; blocks: number };
        }[]
      >;
    },
  });

  const activeProgram = useQuery({
    queryKey: ["training-active"],
    queryFn: async () => {
      const r = await fetch("/api/training/active", browserApiFetchInit);
      if (!r.ok) throw new Error("Failed");
      return r.json() as Promise<{ instance: { programId: string } | null }>;
    },
  });

  const activate = useMutation({
    mutationFn: async (programId: string) => {
      const r = await fetch(`/api/programs/${programId}/activate`, {
        method: "POST",
        ...browserApiFetchInit,
      });
      if (r.status === 401) {
        window.location.assign("/login?next=/programs");
        throw new Error("Session expired — sign in again");
      }
      if (!r.ok) {
        const j = (await r.json().catch(() => ({}))) as { error?: string };
        throw new Error(j.error ?? `Could not activate (${r.status})`);
      }
      return r.json();
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["training-active"] });
      void qc.invalidateQueries({ queryKey: ["programs"] });
    },
  });

  if (isLoading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="size-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight font-heading">Programs</h1>
          <p className="text-muted-foreground text-sm">Mesocycle templates and activation</p>
          <p className="text-muted-foreground text-xs mt-1 max-w-xl">
            Prebuilts range from 2–6 training templates per cycle. You choose how many sessions to do each calendar week;
            the app advances one template per workout. Fewer weekly sessions = longer to finish one full pass.
          </p>
        </div>
        <Link
          href="/programs/new"
          className={cn(buttonVariants({ size: "default" }), "rounded-xl gap-2 inline-flex")}
        >
          <Plus className="size-4" />
          New program
        </Link>
      </div>

      {activate.isError && (
        <p className="text-destructive text-sm" role="alert">
          {(activate.error as Error).message}
        </p>
      )}

      <ul className="space-y-3">
        {(data ?? []).map((p) => (
          <li key={p.id}>
            <Card className="rounded-2xl">
              <CardHeader className="flex flex-row items-start justify-between gap-4">
                <div className="space-y-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <Link href={`/programs/${p.id}`} className="hover:underline">
                      <CardTitle className="text-lg">{p.name}</CardTitle>
                    </Link>
                    {activeProgram.data?.instance?.programId === p.id && (
                      <span className="text-xs font-medium rounded-full bg-primary/15 text-primary px-2 py-0.5">
                        Active
                      </span>
                    )}
                  </div>
                  <CardDescription>
                    {p.durationWeeks} weeks · {p._count.days} training days · {p._count.blocks} blocks
                  </CardDescription>
                  <Link
                    href={`/programs/${p.id}`}
                    className="text-xs text-muted-foreground hover:text-foreground"
                  >
                    View template →
                  </Link>
                </div>
                <Button
                  size="sm"
                  variant="secondary"
                  className="rounded-xl shrink-0"
                  disabled={activate.isPending}
                  onClick={() => activate.mutate(p.id)}
                >
                  Activate
                </Button>
              </CardHeader>
              <CardContent />
            </Card>
          </li>
        ))}
      </ul>
    </div>
  );
}
