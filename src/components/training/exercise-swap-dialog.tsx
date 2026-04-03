"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Loader2, Replace } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

type ExerciseHit = { id: string; name: string; slug: string; muscleTags: string };

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  programExerciseId: string;
  currentExerciseName: string;
  /** When set (e.g. on the workout screen), user can choose this session vs rest of program. */
  sessionId?: string | null;
  onSuccess?: () => void;
};

export function ExerciseSwapDialog({
  open,
  onOpenChange,
  programExerciseId,
  currentExerciseName,
  sessionId,
  onSuccess,
}: Props) {
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [pickedId, setPickedId] = useState<string | null>(null);
  const [scope, setScope] = useState<"session" | "program">("session");

  useEffect(() => {
    if (!open) {
      setQ("");
      setPickedId(null);
      setScope(sessionId ? "session" : "program");
    }
  }, [open, sessionId]);

  const exercises = useQuery({
    queryKey: ["exercises", q],
    queryFn: async () => {
      const r = await fetch(`/api/exercises?q=${encodeURIComponent(q)}`, { credentials: "include" });
      if (r.status === 401) {
        window.location.assign("/login");
        throw new Error("Unauthorized");
      }
      if (!r.ok) throw new Error("Failed");
      return r.json() as Promise<ExerciseHit[]>;
    },
    enabled: open,
  });

  const swap = useMutation({
    mutationFn: async (payload: {
      replacementExerciseId: string;
      scope: "session" | "program";
    }) => {
      if (payload.scope === "session" && sessionId) {
        const r = await fetch(`/api/training/sessions/${sessionId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            action: "swapExercise",
            programExerciseId,
            replacementExerciseId: payload.replacementExerciseId,
            scope: "session",
          }),
        });
        if (r.status === 401) {
          window.location.assign("/login");
          throw new Error("Unauthorized");
        }
        if (!r.ok) {
          const j = (await r.json().catch(() => ({}))) as { error?: string };
          throw new Error(j.error ?? "Swap failed");
        }
        return;
      }
      const r = await fetch("/api/training/instance/replacements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          programExerciseId,
          replacementExerciseId: payload.replacementExerciseId,
        }),
      });
      if (r.status === 401) {
        window.location.assign("/login");
        throw new Error("Unauthorized");
      }
      if (!r.ok) {
        const j = (await r.json().catch(() => ({}))) as { error?: string };
        throw new Error(j.error ?? "Swap failed");
      }
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["training-active"] });
      onSuccess?.();
      onOpenChange(false);
    },
  });

  const canSessionScope = Boolean(sessionId);
  const effectiveScope = canSessionScope ? scope : "program";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="rounded-2xl max-h-[85dvh] flex flex-col gap-0 p-0 overflow-hidden">
        <DialogHeader className="px-6 pt-6 pb-2 shrink-0">
          <DialogTitle className="flex items-center gap-2 text-lg">
            <Replace className="size-5 shrink-0" />
            Swap exercise
          </DialogTitle>
          <DialogDescription>
            Replacing <span className="font-medium text-foreground">{currentExerciseName}</span>. Search the
            catalog and choose a lift. Your program template stays shared; only your active copy changes.
          </DialogDescription>
        </DialogHeader>

        <div className="px-6 pb-3 space-y-3 shrink-0">
          {canSessionScope && (
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Apply to</Label>
              <div className="flex rounded-xl border p-1 bg-muted/40 gap-1">
                <button
                  type="button"
                  className={cn(
                    "flex-1 rounded-lg py-2 text-sm font-medium transition-colors",
                    effectiveScope === "session" ? "bg-background shadow-sm" : "text-muted-foreground",
                  )}
                  onClick={() => setScope("session")}
                >
                  This workout
                </button>
                <button
                  type="button"
                  className={cn(
                    "flex-1 rounded-lg py-2 text-sm font-medium transition-colors",
                    effectiveScope === "program" ? "bg-background shadow-sm" : "text-muted-foreground",
                  )}
                  onClick={() => setScope("program")}
                >
                  Rest of program
                </button>
              </div>
            </div>
          )}
          <div className="space-y-2">
            <Label htmlFor="swap-search" className="text-xs text-muted-foreground">
              Search exercises
            </Label>
            <Input
              id="swap-search"
              className="rounded-xl"
              placeholder="e.g. bench, row, squat…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              autoComplete="off"
            />
          </div>
        </div>

        <ScrollArea className="flex-1 min-h-[200px] max-h-[40dvh] border-y">
          <ul className="px-2 py-2 space-y-1">
            {exercises.isLoading && (
              <li className="flex justify-center py-8 text-muted-foreground text-sm">
                <Loader2 className="size-5 animate-spin" />
              </li>
            )}
            {(exercises.data ?? []).map((e) => (
              <li key={e.id}>
                <button
                  type="button"
                  className={cn(
                    "w-full text-left rounded-xl px-3 py-2.5 text-sm transition-colors",
                    pickedId === e.id ? "bg-primary/15 ring-1 ring-primary/30" : "hover:bg-muted/80",
                  )}
                  onClick={() => setPickedId(e.id)}
                >
                  <span className="font-medium">{e.name}</span>
                </button>
              </li>
            ))}
            {!exercises.isLoading && (exercises.data?.length ?? 0) === 0 && (
              <li className="text-center text-muted-foreground text-sm py-8">No matches</li>
            )}
          </ul>
        </ScrollArea>

        <DialogFooter className="px-6 py-4 border-t shrink-0 flex-col sm:flex-col gap-2">
          {swap.isError && (
            <p className="text-destructive text-sm w-full text-left">
              {(swap.error as Error).message}
            </p>
          )}
          <div className="flex gap-2 w-full">
            <Button variant="outline" className="flex-1 rounded-xl" type="button" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button
              className="flex-1 rounded-xl"
              disabled={!pickedId || swap.isPending}
              onClick={() => {
                if (!pickedId) return;
                swap.mutate({ replacementExerciseId: pickedId, scope: effectiveScope });
              }}
            >
              {swap.isPending ? <Loader2 className="size-4 animate-spin" /> : "Apply swap"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
