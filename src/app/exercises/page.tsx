"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Loader2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
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
};

export default function ExercisesPage() {
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [tags, setTags] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["exercises-catalog", q],
    queryFn: async () => {
      const r = await fetch(`/api/exercises?q=${encodeURIComponent(q)}`);
      if (!r.ok) throw new Error("Failed");
      return r.json() as Promise<CatalogExercise[]>;
    },
  });

  const patchBar = useMutation({
    mutationFn: async ({ id, barIncrementLb }: { id: string; barIncrementLb: number | null }) => {
      const r = await fetch(`/api/exercises/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ barIncrementLb }),
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
        body: JSON.stringify({ name, muscleTags: tags }),
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
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight font-heading">Exercise library</h1>
          <p className="text-muted-foreground text-sm">
            Built-in catalog plus your custom movements for programs.
          </p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <Button className="rounded-xl gap-2 shrink-0" onClick={() => setOpen(true)}>
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
        className="max-w-md rounded-xl"
      />

      {isLoading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="size-8 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <ScrollArea className="h-[calc(100svh-14rem)] pr-3">
          <ul className="grid gap-3 sm:grid-cols-2 pb-8">
            {(data ?? []).map((ex) => (
              <li key={ex.id}>
                <Card className="rounded-2xl">
                  <CardHeader className="py-3">
                    <CardTitle className="text-base">{ex.name}</CardTitle>
                    <CardDescription className="text-xs font-mono">{ex.slug}</CardDescription>
                  </CardHeader>
                  <CardContent className="pt-0 space-y-3">
                    <div className="space-y-1.5">
                      <Label className="text-xs text-muted-foreground">Bar step (lb) — for lb sessions</Label>
                      <Select
                        value={ex.barIncrementLb == null ? "default" : String(ex.barIncrementLb)}
                        onValueChange={(v) => {
                          if (!v || patchBar.isPending) return;
                          const barIncrementLb = v === "default" ? null : Number(v);
                          patchBar.mutate({ id: ex.id, barIncrementLb });
                        }}
                        disabled={patchBar.isPending}
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
