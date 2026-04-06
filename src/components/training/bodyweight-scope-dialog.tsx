"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  programExerciseId: string;
  exerciseName: string;
  /** When set, session scope calls session PATCH; otherwise only program scope (Train overview). */
  sessionId?: string | null;
  targetBodyweight: boolean;
  onSuccess?: () => void;
};

export function BodyweightScopeDialog({
  open,
  onOpenChange,
  programExerciseId,
  exerciseName,
  sessionId,
  targetBodyweight,
  onSuccess,
}: Props) {
  const qc = useQueryClient();

  const apply = useMutation({
    mutationFn: async (scope: "session" | "program") => {
      if (scope === "session" && sessionId) {
        const r = await fetch(`/api/training/sessions/${sessionId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            action: "setBodyweight",
            programExerciseId,
            useBodyweight: targetBodyweight,
            scope: "session",
          }),
        });
        if (r.status === 401) {
          window.location.assign("/login");
          throw new Error("Unauthorized");
        }
        if (!r.ok) {
          const j = (await r.json().catch(() => ({}))) as { error?: string };
          throw new Error(j.error ?? "Update failed");
        }
        return;
      }
      const r = await fetch("/api/training/instance/bodyweight", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          programExerciseId,
          useBodyweight: targetBodyweight,
        }),
      });
      if (r.status === 401) {
        window.location.assign("/login");
        throw new Error("Unauthorized");
      }
      if (!r.ok) {
        const j = (await r.json().catch(() => ({}))) as { error?: string };
        throw new Error(j.error ?? "Update failed");
      }
    },
    onSuccess: async () => {
      if (sessionId) {
        await qc.invalidateQueries({ queryKey: ["session", sessionId] });
      }
      await qc.invalidateQueries({ queryKey: ["training-active"] });
      onOpenChange(false);
      onSuccess?.();
    },
  });

  const modeLabel = targetBodyweight ? "bodyweight" : "external load";
  const sessionAvailable = Boolean(sessionId);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="rounded-2xl sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Log {exerciseName} as {modeLabel}</DialogTitle>
          <DialogDescription>
            Choose whether this applies only to the current workout or to every future session in your active
            program run.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 text-sm">
          {sessionAvailable && (
            <div className="rounded-xl border bg-muted/30 p-3 space-y-2">
              <Label className="text-xs text-muted-foreground">This workout only</Label>
              <Button
                type="button"
                className="w-full rounded-xl"
                variant="secondary"
                disabled={apply.isPending}
                onClick={() => apply.mutate("session")}
              >
                {apply.isPending ? <Loader2 className="size-4 animate-spin" /> : "Apply for this session"}
              </Button>
            </div>
          )}
          <div className="rounded-xl border bg-muted/30 p-3 space-y-2">
            <Label className="text-xs text-muted-foreground">Active program</Label>
            <Button
              type="button"
              className="w-full rounded-xl"
              disabled={apply.isPending}
              onClick={() => apply.mutate("program")}
            >
              {apply.isPending ? <Loader2 className="size-4 animate-spin" /> : "Save for rest of program"}
            </Button>
          </div>
        </div>
        <DialogFooter className="sm:justify-start">
          <Button type="button" variant="ghost" className="rounded-xl" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
        </DialogFooter>
        {apply.isError && (
          <p className="text-destructive text-sm">{(apply.error as Error).message}</p>
        )}
      </DialogContent>
    </Dialog>
  );
}
