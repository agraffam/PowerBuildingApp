"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";

type Row = {
  id: string;
  name: string;
  slug: string;
  muscleTags: string;
  strengthProfile: {
    estimatedOneRm: number;
    weightUnit: "LB" | "KG";
  } | null;
};

function RowEditor({ ex }: { ex: Row }) {
  const qc = useQueryClient();
  const [e1, setE1] = useState(
    ex.strengthProfile ? String(ex.strengthProfile.estimatedOneRm) : "",
  );
  const [unit, setUnit] = useState<"LB" | "KG">(ex.strengthProfile?.weightUnit ?? "LB");

  const save = useMutation({
    mutationFn: async () => {
      const v = Number(e1);
      if (!(v > 0)) throw new Error("Enter a positive 1RM");
      const r = await fetch(`/api/strength/${ex.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ estimatedOneRm: v, weightUnit: unit }),
      });
      if (!r.ok) throw new Error("Save failed");
      return r.json();
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["strength-list"] }),
  });

  const clear = useMutation({
    mutationFn: async () => {
      const r = await fetch(`/api/strength/${ex.id}`, { method: "DELETE" });
      if (!r.ok) throw new Error("Clear failed");
      return r.json();
    },
    onSuccess: () => {
      setE1("");
      qc.invalidateQueries({ queryKey: ["strength-list"] });
    },
  });

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
      <div className="flex-1 min-w-0">
        <p className="font-medium truncate">{ex.name}</p>
        <p className="text-muted-foreground text-xs truncate">{ex.muscleTags}</p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Input
          type="text"
          inputMode="decimal"
          className="w-24 rounded-lg font-mono"
          placeholder="e1RM"
          value={e1}
          onChange={(e) => setE1(e.target.value)}
        />
        <Select value={unit} onValueChange={(v) => setUnit(v as "LB" | "KG")}>
          <SelectTrigger className="w-[88px] rounded-lg">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="LB">lb</SelectItem>
            <SelectItem value="KG">kg</SelectItem>
          </SelectContent>
        </Select>
        <Button size="sm" className="rounded-lg" disabled={save.isPending} onClick={() => save.mutate()}>
          {save.isPending ? <Loader2 className="size-4 animate-spin" /> : "Save"}
        </Button>
        {ex.strengthProfile && (
          <Button
            size="sm"
            variant="ghost"
            className="rounded-lg"
            disabled={clear.isPending}
            onClick={() => clear.mutate()}
          >
            Clear
          </Button>
        )}
      </div>
    </div>
  );
}

export default function StrengthPage() {
  const [q, setQ] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["strength-list", q],
    queryFn: async () => {
      const r = await fetch(`/api/strength?q=${encodeURIComponent(q)}`);
      if (!r.ok) throw new Error("Failed");
      return r.json() as Promise<Row[]>;
    },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight font-heading">Strength profile</h1>
        <p className="text-muted-foreground text-sm">
          Log estimated (or tested) 1RM per lift. With %1RM prescriptions, working weights pre-fill for each
          session and adjust after your readiness survey.
        </p>
      </div>

      <Input
        placeholder="Filter exercises…"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        className="max-w-md rounded-xl"
      />

      <Card className="rounded-2xl">
        <CardHeader>
          <CardTitle className="text-lg">1RM entries</CardTitle>
          <CardDescription>Stored per exercise in the unit you choose.</CardDescription>
        </CardHeader>
        {isLoading ? (
          <div className="flex justify-center py-12 px-6">
            <Loader2 className="size-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <ScrollArea className="h-[min(65svh,560px)] px-6 pb-6">
            <ul className="space-y-6 pr-3">
              {(data ?? []).map((ex) => (
                <li
                  key={`${ex.id}-${ex.strengthProfile?.estimatedOneRm ?? "none"}-${ex.strengthProfile?.weightUnit ?? ""}`}
                  className="border-b border-border/60 pb-6 last:border-0"
                >
                  <RowEditor ex={ex} />
                </li>
              ))}
            </ul>
          </ScrollArea>
        )}
      </Card>
    </div>
  );
}
