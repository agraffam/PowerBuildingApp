"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Loader2, Plus } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { browserApiFetchInit } from "@/lib/browser-api-fetch";

type TrainingActivePayload = {
  instance: {
    id: string;
    programId: string;
    program?: { name: string };
  } | null;
  inProgressSession: { id: string } | null;
};

type PausableInstance = {
  id: string;
  programId: string;
  programName: string;
  status: string;
  weekIndex: number;
  nextDaySortOrder: number;
  startedAt: string;
  lastSessionAt: string | null;
};

function hasResumableRunForProgram(instances: PausableInstance[] | undefined, programId: string) {
  return (instances ?? []).some((i) => i.programId === programId);
}

export default function ProgramsPage() {
  const qc = useQueryClient();
  const [switchTargetId, setSwitchTargetId] = useState<string | null>(null);
  const [archivePausedOnSwitch, setArchivePausedOnSwitch] = useState(false);
  const [freshStartProgramId, setFreshStartProgramId] = useState<string | null>(null);
  const [endConfirm, setEndConfirm] = useState<{ id: string; name: string } | null>(null);

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
      return r.json() as Promise<TrainingActivePayload>;
    },
  });

  const pausable = useQuery({
    queryKey: ["training-instances"],
    queryFn: async () => {
      const r = await fetch("/api/training/instances", browserApiFetchInit);
      if (!r.ok) throw new Error("Failed");
      return r.json() as Promise<{ instances: PausableInstance[] }>;
    },
  });

  useEffect(() => {
    if (switchTargetId == null) return;
    const has = hasResumableRunForProgram(pausable.data?.instances, switchTargetId);
    setArchivePausedOnSwitch(has);
  }, [switchTargetId, pausable.data?.instances]);

  const activate = useMutation({
    mutationFn: async (opts: {
      programId: string;
      confirmSwitch?: boolean;
      archivePausedRunsForProgram?: boolean;
    }) => {
      const r = await fetch(`/api/programs/${opts.programId}/activate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        ...browserApiFetchInit,
        body: JSON.stringify({
          confirmSwitch: opts.confirmSwitch === true,
          archivePausedRunsForProgram: opts.archivePausedRunsForProgram === true,
        }),
      });
      if (r.status === 401) {
        window.location.assign("/login?next=/programs");
        throw new Error("Session expired — sign in again");
      }
      if (r.status === 409) {
        const j = (await r.json().catch(() => ({}))) as { code?: string; error?: string };
        if (j.code === "CONFIRM_SWITCH_REQUIRED") {
          setSwitchTargetId(opts.programId);
          throw new Error(j.error ?? "Confirmation required");
        }
      }
      if (!r.ok) {
        const j = (await r.json().catch(() => ({}))) as { error?: string };
        throw new Error(j.error ?? `Could not activate (${r.status})`);
      }
      return r.json();
    },
    onSuccess: () => {
      setSwitchTargetId(null);
      setFreshStartProgramId(null);
      void qc.invalidateQueries({ queryKey: ["training-active"] });
      void qc.invalidateQueries({ queryKey: ["programs"] });
      void qc.invalidateQueries({ queryKey: ["training-instances"] });
    },
  });

  const resume = useMutation({
    mutationFn: async (instanceId: string) => {
      const r = await fetch(`/api/training/instances/${instanceId}/resume`, {
        method: "POST",
        ...browserApiFetchInit,
      });
      if (r.status === 401) {
        window.location.assign("/login?next=/programs");
        throw new Error("Session expired — sign in again");
      }
      if (!r.ok) {
        const j = (await r.json().catch(() => ({}))) as { error?: string };
        throw new Error(j.error ?? `Could not resume (${r.status})`);
      }
      return r.json();
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["training-active"] });
      void qc.invalidateQueries({ queryKey: ["training-instances"] });
    },
  });

  const endRun = useMutation({
    mutationFn: async (instanceId: string) => {
      const r = await fetch(`/api/training/instances/${instanceId}/archive`, {
        method: "POST",
        ...browserApiFetchInit,
      });
      if (r.status === 401) {
        window.location.assign("/login?next=/programs");
        throw new Error("Session expired — sign in again");
      }
      if (!r.ok) {
        const j = (await r.json().catch(() => ({}))) as { error?: string };
        throw new Error(j.error ?? `Could not end run (${r.status})`);
      }
      return r.json();
    },
    onSuccess: () => {
      setEndConfirm(null);
      void qc.invalidateQueries({ queryKey: ["training-instances"] });
      void qc.invalidateQueries({ queryKey: ["training-active"] });
    },
  });

  const current = activeProgram.data?.instance;
  const switchTargetName = (data ?? []).find((p) => p.id === switchTargetId)?.name ?? "this program";
  const currentName = current?.program?.name ?? "your current program";
  const freshStartName =
    (data ?? []).find((p) => p.id === freshStartProgramId)?.name ?? "this program";

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
          <Link href="/settings" className="text-xs text-primary underline-offset-4 hover:underline mt-1 inline-block">
            ← Back to Settings
          </Link>
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

      {pausable.data && pausable.data.instances.length > 0 && (
        <Card className="rounded-2xl border-dashed">
          <CardHeader>
            <CardTitle className="text-lg">Resume a program</CardTitle>
            <CardDescription>
              One entry per template (your most recent paused or finished run). Resuming makes it active and archives other
              paused runs for that same template. Use End run to remove a row without resuming.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {pausable.data.instances.map((inst) => (
              <div
                key={inst.id}
                className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between rounded-xl border bg-muted/20 px-4 py-3"
              >
                <div className="min-w-0 space-y-0.5">
                  <p className="font-medium truncate">{inst.programName}</p>
                  <p className="text-xs text-muted-foreground">
                    Week index {inst.weekIndex} · next template slot {inst.nextDaySortOrder}
                    {inst.lastSessionAt
                      ? ` · last session ${new Date(inst.lastSessionAt).toLocaleDateString()}`
                      : ""}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2 shrink-0">
                  <Button
                    size="sm"
                    variant="secondary"
                    className="rounded-xl"
                    disabled={resume.isPending}
                    onClick={() => resume.mutate(inst.id)}
                  >
                    {resume.isPending ? <Loader2 className="size-4 animate-spin" /> : null}
                    Resume
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="rounded-xl text-muted-foreground"
                    disabled={endRun.isPending}
                    onClick={() => setEndConfirm({ id: inst.id, name: inst.programName })}
                  >
                    End run
                  </Button>
                </div>
              </div>
            ))}
            {resume.isError && (
              <p className="text-destructive text-sm" role="alert">
                {(resume.error as Error).message}
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {activate.isError && switchTargetId == null && freshStartProgramId == null && (
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
                  disabled={activate.isPending || activeProgram.data?.instance?.programId === p.id}
                  onClick={() => {
                    const cur = activeProgram.data?.instance;
                    if (cur && cur.programId !== p.id) {
                      setSwitchTargetId(p.id);
                      return;
                    }
                    if (!cur && hasResumableRunForProgram(pausable.data?.instances, p.id)) {
                      setFreshStartProgramId(p.id);
                      return;
                    }
                    activate.mutate({ programId: p.id });
                  }}
                >
                  {activeProgram.data?.instance?.programId === p.id ? "Active" : "Activate"}
                </Button>
              </CardHeader>
              <CardContent />
            </Card>
          </li>
        ))}
      </ul>

      <Dialog open={switchTargetId != null} onOpenChange={(o) => !o && setSwitchTargetId(null)}>
        <DialogContent className="rounded-2xl" showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>Switch active program?</DialogTitle>
            <DialogDescription className="space-y-2">
              <span className="block">
                Activating <span className="font-medium text-foreground">{switchTargetName}</span> pauses{" "}
                <span className="font-medium text-foreground">{currentName}</span>. You can resume the paused run later
                from this page.
              </span>
              {hasResumableRunForProgram(pausable.data?.instances, switchTargetId ?? "") && (
                <label className="flex items-start gap-2 text-sm text-foreground cursor-pointer">
                  <input
                    type="checkbox"
                    className="mt-1 rounded border-input"
                    checked={archivePausedOnSwitch}
                    onChange={(e) => setArchivePausedOnSwitch(e.target.checked)}
                  />
                  <span>
                    Start fresh for <span className="font-medium">{switchTargetName}</span> (archive paused runs of this
                    template so you don&apos;t stack duplicates).
                  </span>
                </label>
              )}
              {activeProgram.data?.inProgressSession && (
                <span className="block text-amber-600 dark:text-amber-500">
                  You have an unfinished workout on your current program—finish or cancel it from Train if you need a
                  clean handoff.
                </span>
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex-col gap-2 sm:flex-col">
            <Button
              className="w-full rounded-xl"
              disabled={activate.isPending}
              onClick={() =>
                switchTargetId &&
                activate.mutate({
                  programId: switchTargetId,
                  confirmSwitch: true,
                  archivePausedRunsForProgram: archivePausedOnSwitch,
                })
              }
            >
              {activate.isPending ? <Loader2 className="size-4 animate-spin" /> : "Yes, switch"}
            </Button>
            <Button variant="outline" className="w-full rounded-xl" type="button" onClick={() => setSwitchTargetId(null)}>
              Cancel
            </Button>
          </DialogFooter>
          {activate.isError && switchTargetId != null && (
            <p className="text-destructive text-sm">{(activate.error as Error).message}</p>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={freshStartProgramId != null} onOpenChange={(o) => !o && setFreshStartProgramId(null)}>
        <DialogContent className="rounded-2xl" showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>Paused run already on file</DialogTitle>
            <DialogDescription>
              You have a paused or completed run for <span className="font-medium text-foreground">{freshStartName}</span>{" "}
              in the list above. Activate anyway to start a <span className="font-medium text-foreground">new</span> run
              from week 1 (the paused run for that template will be archived), or cancel and tap Resume instead.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex-col gap-2 sm:flex-col">
            <Button
              className="w-full rounded-xl"
              disabled={activate.isPending}
              onClick={() =>
                freshStartProgramId &&
                activate.mutate({
                  programId: freshStartProgramId,
                  archivePausedRunsForProgram: true,
                })
              }
            >
              {activate.isPending ? <Loader2 className="size-4 animate-spin" /> : "Start new run"}
            </Button>
            <Button
              variant="outline"
              className="w-full rounded-xl"
              type="button"
              onClick={() => setFreshStartProgramId(null)}
            >
              Cancel
            </Button>
          </DialogFooter>
          {activate.isError && freshStartProgramId != null && (
            <p className="text-destructive text-sm">{(activate.error as Error).message}</p>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={endConfirm != null} onOpenChange={(o) => !o && setEndConfirm(null)}>
        <DialogContent className="rounded-2xl" showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>End this run?</DialogTitle>
            <DialogDescription>
              <span className="font-medium text-foreground">{endConfirm?.name}</span> will disappear from the resume list.
              Logged workouts stay in history; this only clears the saved program position for that run.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex-col gap-2 sm:flex-col">
            <Button
              variant="destructive"
              className="w-full rounded-xl"
              disabled={endRun.isPending}
              onClick={() => endConfirm && endRun.mutate(endConfirm.id)}
            >
              {endRun.isPending ? <Loader2 className="size-4 animate-spin" /> : "End run"}
            </Button>
            <Button variant="outline" className="w-full rounded-xl" type="button" onClick={() => setEndConfirm(null)}>
              Cancel
            </Button>
          </DialogFooter>
          {endRun.isError && (
            <p className="text-destructive text-sm">{(endRun.error as Error).message}</p>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
