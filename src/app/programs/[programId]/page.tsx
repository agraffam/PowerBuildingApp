"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Loader2, Pencil, Copy, Trash2 } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { browserApiFetchInit } from "@/lib/browser-api-fetch";

type ProgramDetail = {
  id: string;
  name: string;
  durationWeeks: number;
  deloadIntervalWeeks: number | null;
  autoBlockPrescriptions: boolean;
  blocks: { blockType: string; startWeek: number; endWeek: number }[];
  days: {
    label: string;
    sortOrder: number;
    exercises: {
      sets: number;
      repTarget: number | null;
      targetRpe: number | null;
      pctOf1rm: number | null;
      restSec: number | null;
      exercise: { name: string; slug: string };
    }[];
  }[];
};

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
  startedAt: string;
};

function hasResumableRunForProgram(instances: PausableInstance[] | undefined, pid: string) {
  return (instances ?? []).some((i) => i.programId === pid);
}

export default function ProgramDetailPage() {
  const params = useParams();
  const router = useRouter();
  const programId = params.programId as string;
  const qc = useQueryClient();
  const [switchOpen, setSwitchOpen] = useState(false);
  const [archivePausedOnSwitch, setArchivePausedOnSwitch] = useState(false);
  const [freshOpen, setFreshOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteAckInstances, setDeleteAckInstances] = useState(false);

  const active = useQuery({
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

  const { data, isLoading } = useQuery({
    queryKey: ["program", programId],
    queryFn: async () => {
      const r = await fetch(`/api/programs/${programId}`, browserApiFetchInit);
      if (!r.ok) throw new Error("Failed");
      return r.json() as Promise<{
        program: ProgramDetail;
        hasWorkoutHistory: boolean;
        canDeleteProgram: boolean;
        programInstanceCount: number;
      }>;
    },
  });

  const deleteProgram = useMutation({
    mutationFn: async (confirmDeleteInstances: boolean) => {
      const r = await fetch(`/api/programs/${programId}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirmDeleteInstances }),
        ...browserApiFetchInit,
      });
      const j = (await r.json().catch(() => ({}))) as { error?: string; code?: string };
      if (!r.ok) throw new Error(j.error ?? "Could not delete program");
    },
    onSuccess: async () => {
      setDeleteOpen(false);
      await qc.invalidateQueries({ queryKey: ["programs"] });
      await qc.invalidateQueries({ queryKey: ["training-active"] });
      await qc.invalidateQueries({ queryKey: ["training-instances"] });
      router.push("/programs");
    },
  });

  useEffect(() => {
    if (!switchOpen) return;
    const has = hasResumableRunForProgram(pausable.data?.instances, programId);
    setArchivePausedOnSwitch(has);
  }, [switchOpen, programId, pausable.data?.instances]);

  const activate = useMutation({
    mutationFn: async (opts: { confirmSwitch?: boolean; archivePausedRunsForProgram?: boolean }) => {
      const r = await fetch(`/api/programs/${programId}/activate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        ...browserApiFetchInit,
        body: JSON.stringify({
          confirmSwitch: opts.confirmSwitch === true,
          archivePausedRunsForProgram: opts.archivePausedRunsForProgram === true,
        }),
      });
      if (r.status === 401) {
        window.location.assign(`/login?next=/programs/${programId}`);
        throw new Error("Session expired — sign in again");
      }
      if (r.status === 409) {
        const j = (await r.json().catch(() => ({}))) as { code?: string; error?: string };
        if (j.code === "CONFIRM_SWITCH_REQUIRED") {
          setSwitchOpen(true);
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
      setSwitchOpen(false);
      setFreshOpen(false);
      void qc.invalidateQueries({ queryKey: ["training-active"] });
      void qc.invalidateQueries({ queryKey: ["programs"] });
      void qc.invalidateQueries({ queryKey: ["training-instances"] });
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

  const { program, hasWorkoutHistory, canDeleteProgram, programInstanceCount } = data;
  const isActive = active.data?.instance?.programId === programId;
  const current = active.data?.instance;
  const currentName = current?.program?.name ?? "your current program";

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
          <p className="text-muted-foreground text-xs mt-1">
            {program.deloadIntervalWeeks == null
              ? "Deload: off"
              : `Deload: every ${program.deloadIntervalWeeks} weeks`}
            {" · "}
            {program.autoBlockPrescriptions
              ? "Auto block prescriptions: on"
              : "Auto block prescriptions: off"}
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
              onClick={() => {
                if (current && current.programId !== programId) {
                  setSwitchOpen(true);
                  return;
                }
                if (!current && hasResumableRunForProgram(pausable.data?.instances, programId)) {
                  setFreshOpen(true);
                  return;
                }
                activate.mutate({});
              }}
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
          {canDeleteProgram && (
            <Button
              variant="outline"
              className="rounded-xl gap-2 w-full sm:w-auto border-destructive/40 text-destructive hover:bg-destructive/10"
              onClick={() => {
                setDeleteAckInstances(false);
                setDeleteOpen(true);
              }}
            >
              <Trash2 className="size-4" />
              Delete program
            </Button>
          )}
        </div>
      </div>

      {activate.isError && !switchOpen && !freshOpen && (
        <p className="text-destructive text-sm" role="alert">
          {(activate.error as Error).message}
        </p>
      )}

      <Dialog open={switchOpen} onOpenChange={setSwitchOpen}>
        <DialogContent className="rounded-2xl" showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>Switch active program?</DialogTitle>
            <DialogDescription className="space-y-2">
              <span className="block">
                Activating <span className="font-medium text-foreground">{program.name}</span> pauses{" "}
                <span className="font-medium text-foreground">{currentName}</span>. You can resume the paused run from
                Programs.
              </span>
              {hasResumableRunForProgram(pausable.data?.instances, programId) && (
                <label className="flex items-start gap-2 text-sm text-foreground cursor-pointer">
                  <input
                    type="checkbox"
                    className="mt-1 rounded border-input"
                    checked={archivePausedOnSwitch}
                    onChange={(e) => setArchivePausedOnSwitch(e.target.checked)}
                  />
                  <span>
                    Start fresh for <span className="font-medium">{program.name}</span> (archive paused runs of this
                    template).
                  </span>
                </label>
              )}
              {active.data?.inProgressSession && (
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
                activate.mutate({ confirmSwitch: true, archivePausedRunsForProgram: archivePausedOnSwitch })
              }
            >
              {activate.isPending ? <Loader2 className="size-4 animate-spin" /> : "Yes, switch"}
            </Button>
            <Button variant="outline" className="w-full rounded-xl" type="button" onClick={() => setSwitchOpen(false)}>
              Cancel
            </Button>
          </DialogFooter>
          {activate.isError && switchOpen && (
            <p className="text-destructive text-sm">{(activate.error as Error).message}</p>
          )}
        </DialogContent>
      </Dialog>

      <Dialog
        open={deleteOpen}
        onOpenChange={(o) => {
          setDeleteOpen(o);
          if (!o) setDeleteAckInstances(false);
        }}
      >
        <DialogContent className="rounded-2xl sm:max-w-md" showCloseButton>
          <DialogHeader>
            <DialogTitle>Delete this program?</DialogTitle>
            <DialogDescription className="space-y-3 text-foreground">
              <span className="block">
                <span className="font-medium">{program.name}</span> will be removed from your library
                permanently.
              </span>
              {programInstanceCount > 0 ? (
                <>
                  <span className="block text-destructive">
                    This will also delete {programInstanceCount} saved run
                    {programInstanceCount === 1 ? "" : "s"} (active, paused, or completed) and every logged
                    workout tied to {programInstanceCount === 1 ? "that run" : "those runs"}.
                  </span>
                  <label className="flex items-start gap-2 text-sm cursor-pointer">
                    <input
                      type="checkbox"
                      className="mt-1 rounded border-input"
                      checked={deleteAckInstances}
                      onChange={(e) => setDeleteAckInstances(e.target.checked)}
                    />
                    <span>I understand all runs and history for this program will be erased.</span>
                  </label>
                </>
              ) : (
                <span className="block text-muted-foreground text-sm">You have no saved runs of this template yet.</span>
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex-col gap-2 sm:flex-col">
            <Button
              variant="destructive"
              className="w-full rounded-xl"
              disabled={
                deleteProgram.isPending || (programInstanceCount > 0 && !deleteAckInstances)
              }
              onClick={() =>
                deleteProgram.mutate(programInstanceCount > 0 ? deleteAckInstances : false)
              }
            >
              {deleteProgram.isPending ? <Loader2 className="size-4 animate-spin" /> : "Delete forever"}
            </Button>
            <Button
              variant="outline"
              className="w-full rounded-xl"
              type="button"
              disabled={deleteProgram.isPending}
              onClick={() => setDeleteOpen(false)}
            >
              Cancel
            </Button>
          </DialogFooter>
          {deleteProgram.isError && (
            <p className="text-destructive text-sm">{(deleteProgram.error as Error).message}</p>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={freshOpen} onOpenChange={setFreshOpen}>
        <DialogContent className="rounded-2xl" showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>Paused run already on file</DialogTitle>
            <DialogDescription>
              You have a paused or completed run for this template on Programs. Start a <span className="font-medium text-foreground">new</span> run from week 1 (archives the paused one), or cancel and use Resume on the list.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex-col gap-2 sm:flex-col">
            <Button
              className="w-full rounded-xl"
              disabled={activate.isPending}
              onClick={() => activate.mutate({ archivePausedRunsForProgram: true })}
            >
              {activate.isPending ? <Loader2 className="size-4 animate-spin" /> : "Start new run"}
            </Button>
            <Button variant="outline" className="w-full rounded-xl" type="button" onClick={() => setFreshOpen(false)}>
              Cancel
            </Button>
          </DialogFooter>
          {activate.isError && freshOpen && (
            <p className="text-destructive text-sm">{(activate.error as Error).message}</p>
          )}
        </DialogContent>
      </Dialog>

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
