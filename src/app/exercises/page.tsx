"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Loader2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type CatalogExercise = {
  id: string;
  name: string;
  slug: string;
  muscleTags: string;
  barIncrementLb: number | null;
  isBodyweight: boolean;
  kind: "STRENGTH" | "CARDIO";
};

export default function ExercisesPage() {
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [tags, setTags] = useState("");
  const [newKind, setNewKind] = useState<"STRENGTH" | "CARDIO">("STRENGTH");

  const { data: me } = useQuery({
    queryKey: ["auth-me"],
    queryFn: async () => {
      const r = await fetch("/api/auth/me");
      if (r.status === 401) return { user: null as null };
      if (!r.ok) throw new Error("Failed");
      return r.json() as Promise<{
        user: { isAdmin?: boolean; isSuperAdmin?: boolean } | null;
      }>;
    },
  });
  const canEditCatalog =
    me?.user?.isAdmin === true || me?.user?.isSuperAdmin === true;

  const { data, isLoading } = useQuery({
    queryKey: ["exercises-catalog", q],
    queryFn: async () => {
      const r = await fetch(`/api/exercises?q=${encodeURIComponent(q)}`);
      if (!r.ok) throw new Error("Failed");
      return r.json() as Promise<CatalogExercise[]>;
    },
  });

  const patchExercise = useMutation({
    mutationFn: async (p: {
      id: string;
      barIncrementLb?: number | null;
      isBodyweight?: boolean;
      kind?: "STRENGTH" | "CARDIO";
    }) => {
      const body: Record<string, unknown> = {};
      if (p.barIncrementLb !== undefined) body.barIncrementLb = p.barIncrementLb;
      if (p.isBodyweight !== undefined) body.isBodyweight = p.isBodyweight;
      if (p.kind !== undefined) body.kind = p.kind;
      const r = await fetch(`/api/exercises/${p.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!r.ok) {
        const j = await r.json().catch(() => ({}));
        throw new Error((j as { error?: string }).error ?? "Update failed");
      }
      return r.json();
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["exercises-catalog"] }),
  });

  const add = useMutation({
    mutationFn: async () => {
      const r = await fetch("/api/exercises", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, muscleTags: tags, kind: newKind }),
      });
      if (!r.ok) {
        const j = await r.json().catch(() => ({}));
        throw new Error((j as { error?: string }).error ?? "Failed");
      }
      return r.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["exercises-catalog"] });
      qc.invalidateQueries({ queryKey: ["exercises"] });
      setOpen(false);
      setName("");
      setTags("");
      setNewKind("STRENGTH");
    },
  });

  return (
    <div className="page-stack">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <PageHeader
          className="min-w-0 flex-1"
          title="Exercise library"
          description="Built-in catalog plus your custom movements for programs."
          backLink={{ href: "/settings", label: "← Back to Settings" }}
        />
        <Dialog open={open} onOpenChange={setOpen}>
          <Button className="h-11 w-full shrink-0 gap-2 rounded-xl sm:h-10 sm:w-auto" onClick={() => setOpen(true)}>
            <Plus className="size-4" />
            Add exercise
          </Button>
          <DialogContent className="rounded-2xl">
            <DialogHeader>
              <DialogTitle>New exercise</DialogTitle>
            </DialogHeader>
            <div className="space-y-3 pt-2">
              <div className="space-y-2">
                <Label>Name</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} className="rounded-xl" />
              </div>
              <div className="space-y-2">
                <Label>Muscle tags (comma-separated)</Label>
                <Input
                  value={tags}
                  onChange={(e) => setTags(e.target.value)}
                  placeholder="e.g. chest, triceps"
                  className="rounded-xl"
                />
              </div>
              <div className="space-y-2">
                <Label>Movement type</Label>
                <Select
                  value={newKind}
                  onValueChange={(v) => v && setNewKind(v as "STRENGTH" | "CARDIO")}
                >
                  <SelectTrigger className="rounded-xl">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="STRENGTH">Strength (weight & reps)</SelectItem>
                    <SelectItem value="CARDIO">Cardio (time & calories)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {add.isError && (
                <p className="text-destructive text-sm">{(add.error as Error).message}</p>
              )}
              <Button
                className="w-full rounded-xl"
                disabled={add.isPending || !name.trim()}
                onClick={() => add.mutate()}
              >
                {add.isPending ? <Loader2 className="animate-spin" /> : "Save"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Input
        placeholder="Search…"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        className="w-full max-w-md rounded-xl"
      />

      {isLoading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="size-8 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <ScrollArea className="h-[calc(100svh-18rem)] pr-3 sm:h-[calc(100svh-14rem)]">
          <ul className="grid gap-4 pb-8 sm:grid-cols-2 sm:gap-3">
            {(data ?? []).map((ex) => (
              <li key={ex.id}>
                <Card className="rounded-2xl">
                  <CardHeader className="py-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <CardTitle className="text-base">{ex.name}</CardTitle>
                      <Badge variant={ex.kind === "CARDIO" ? "default" : "secondary"} className="text-xs">
                        {ex.kind === "CARDIO" ? "Cardio" : "Strength"}
                      </Badge>
                    </div>
                    <CardDescription className="text-xs font-mono">{ex.slug}</CardDescription>
                  </CardHeader>
                  <CardContent className="pt-0 space-y-3">
                    {canEditCatalog && (
                      <div className="space-y-1.5">
                        <Label className="text-xs text-muted-foreground">Movement type (catalog)</Label>
                        <Select
                          value={ex.kind}
                          onValueChange={(v) => {
                            if (!v || patchExercise.isPending) return;
                            patchExercise.mutate({
                              id: ex.id,
                              kind: v as "STRENGTH" | "CARDIO",
                            });
                          }}
                          disabled={patchExercise.isPending}
                        >
                          <SelectTrigger className="rounded-xl h-9 text-sm">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="STRENGTH">Strength</SelectItem>
                            <SelectItem value="CARDIO">Cardio</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                    <div className="space-y-1.5">
                      <Label className="text-xs text-muted-foreground">Bar step (lb) — for lb sessions</Label>
                      <Select
                        value={ex.barIncrementLb == null ? "default" : String(ex.barIncrementLb)}
                        onValueChange={(v) => {
                          if (!v || patchExercise.isPending) return;
                          const barIncrementLb = v === "default" ? null : Number(v);
                          patchExercise.mutate({ id: ex.id, barIncrementLb });
                        }}
                        disabled={patchExercise.isPending || ex.kind === "CARDIO"}
                      >
                        <SelectTrigger className="rounded-xl h-9 text-sm">
                          <SelectValue placeholder="Increment" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="default">Use settings default</SelectItem>
                          <SelectItem value="2.5">2.5 lb</SelectItem>
                          <SelectItem value="5">5 lb</SelectItem>
                          <SelectItem value="10">10 lb</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    {ex.kind === "STRENGTH" ? (
                      <div className="space-y-1.5">
                        <Label className="text-xs text-muted-foreground">Log as bodyweight</Label>
                        <Select
                          value={ex.isBodyweight ? "yes" : "no"}
                          onValueChange={(v) => {
                            if (!v || patchExercise.isPending || !canEditCatalog) return;
                            patchExercise.mutate({ id: ex.id, isBodyweight: v === "yes" });
                          }}
                          disabled={patchExercise.isPending || !canEditCatalog}
                        >
                          <SelectTrigger className="rounded-xl h-9 text-sm">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="no">Weighted</SelectItem>
                            <SelectItem value="yes">Bodyweight</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground">
                        Cardio uses duration and calories in workouts, not bodyweight mode.
                      </p>
                    )}
                    <div className="flex flex-wrap gap-1">
                      {ex.muscleTags.split(",").map((t) => {
                        const x = t.trim();
                        if (!x) return null;
                        return (
                          <Badge key={x} variant="secondary" className="text-xs">
                            {x}
                          </Badge>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>
              </li>
            ))}
          </ul>
        </ScrollArea>
      )}
    </div>
  );
}
