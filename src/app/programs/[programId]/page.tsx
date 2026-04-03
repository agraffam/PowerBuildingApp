"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Loader2, Pencil, Copy } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { browserApiFetchInit } from "@/lib/browser-api-fetch";

type ProgramDetail = {
  id: string;
  name: string;
  durationWeeks: number;
  blocks: { blockType: string; startWeek: number; endWeek: number }[];
  days: {
    label: string;
    sortOrder: number;
    exercises: {
      sets: number;
      repTarget: number;
      targetRpe: number;
      pctOf1rm: number | null;
      restSec: number | null;
      exercise: { name: string; slug: string };
    }[];
  }[];
};

export default function ProgramDetailPage() {
  const params = useParams();
  const programId = params.programId as string;
  const qc = useQueryClient();

  const active = useQuery({
    queryKey: ["training-active"],
    queryFn: async () => {
      const r = await fetch("/api/training/active", browserApiFetchInit);
      if (!r.ok) throw new Error("Failed");
      return r.json() as Promise<{
        instance: { programId: string } | null;
      }>;
    },
  });

  const { data, isLoading } = useQuery({
    queryKey: ["program", programId],
    queryFn: async () => {
      const r = await fetch(`/api/programs/${programId}`, browserApiFetchInit);
      if (!r.ok) throw new Error("Failed");
      return r.json() as Promise<{ program: ProgramDetail; hasWorkoutHistory: boolean }>;
    },
  });

  const activate = useMutation({
    mutationFn: async () => {
      const r = await fetch(`/api/programs/${programId}/activate`, {
        method: "POST",
        ...browserApiFetchInit,
      });
      if (r.status === 401) {
        window.location.assign(`/login?next=/programs/${programId}`);
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

  const duplicate = useMutation({
    mutationFn: async () => {
      const r = await fetch(`/api/programs/${programId}/duplicate`, {
        method: "POST",
        ...browserApiFetchInit,
      });
      if (!r.ok) throw new Error("Duplicate failed");
      return r.json() as Promise<{ program: { id: string } }>;
    },
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ["programs"] });
      window.location.href = `/programs/${res.program.id}/edit`;
    },
  });

  if (isLoading || !data) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="size-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const { program, hasWorkoutHistory } = data;
  const isActive = active.data?.instance?.programId === programId;

  return (
    <div className="space-y-6 max-w-2xl">
      <Link
        href="/programs"
        className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "w-fit -ml-2 inline-flex")}
      >
        ← Programs
      </Link>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight font-heading">{program.name}</h1>
          <p className="text-muted-foreground text-sm">
            {program.durationWeeks} weeks · {program.days.length} days
          </p>
          <div className="flex flex-wrap gap-2 mt-2">
            {isActive && <Badge>Active</Badge>}
            {hasWorkoutHistory && <Badge variant="secondary">Has logged sessions</Badge>}
          </div>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
          {!isActive && (
            <Button
              className="rounded-xl gap-2 w-full sm:w-auto"
              disabled={activate.isPending}
              onClick={() => activate.mutate()}
            >
              {activate.isPending ? <Loader2 className="size-4 animate-spin" /> : null}
              Activate program
            </Button>
          )}
          <Link
            href={`/programs/${programId}/edit`}
            className={cn(
              buttonVariants({ variant: "default" }),
              "rounded-xl gap-2 inline-flex justify-center w-full sm:w-auto",
            )}
          >
            <Pencil className="size-4" />
            Edit
          </Link>
          <Button
            variant="outline"
            className="rounded-xl gap-2 w-full sm:w-auto"
            disabled={duplicate.isPending}
            onClick={() => duplicate.mutate()}
          >
            <Copy className="size-4" />
            Duplicate
          </Button>
        </div>
      </div>

      {activate.isError && (
        <p className="text-destructive text-sm" role="alert">
          {(activate.error as Error).message}
        </p>
      )}

      <Card className="rounded-2xl">
        <CardHeader>
          <CardTitle className="text-lg">Blocks</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2 text-sm">
            {program.blocks.map((b, i) => (
              <li key={i}>
                {b.blockType}: weeks {b.startWeek}–{b.endWeek}
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      <Card className="rounded-2xl">
        <CardHeader>
          <CardTitle className="text-lg">Template days</CardTitle>
          <CardDescription>Exercises and prescriptions</CardDescription>
        </CardHeader>
        <CardContent className="space-y-8">
          {program.days.map((d) => (
            <div key={d.sortOrder}>
              <h3 className="font-semibold mb-3">{d.label}</h3>
              <ul className="space-y-3">
                {d.exercises.map((ex, i) => (
                  <li key={i} className="rounded-xl border bg-muted/30 px-4 py-3 text-sm">
                    <div className="font-medium">{ex.exercise.name}</div>
                    <div className="text-muted-foreground mt-1">
                      {ex.sets}×{ex.repTarget} @ ~{ex.targetRpe} RPE
                      {ex.pctOf1rm != null ? ` · ${ex.pctOf1rm}% 1RM` : ""}
                      {ex.restSec != null ? ` · ${ex.restSec}s rest` : ""}
                    </div>
                  </li>
                ))}
              </ul>
              <Separator className="mt-6" />
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
