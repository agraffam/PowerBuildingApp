"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/page-header";
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
    <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:gap-3">
      <div className="min-w-0 flex-1 space-y-0.5">
        <p className="truncate font-medium leading-snug">{ex.name}</p>
        <p className="truncate text-xs text-muted-foreground">{ex.muscleTags}</p>
      </div>
      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
        <div className="flex flex-wrap items-center gap-2">
          <Input
            type="text"
            inputMode="decimal"
            className="min-w-0 flex-1 rounded-lg font-mono sm:w-24 sm:flex-none"
            placeholder="e1RM"
            value={e1}
            onChange={(e) => setE1(e.target.value)}
          />
          <Select value={unit} onValueChange={(v) => setUnit(v as "LB" | "KG")}>
            <SelectTrigger className="w-[88px] shrink-0 rounded-lg">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="LB">lb</SelectItem>
              <SelectItem value="KG">kg</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex gap-2">
          <Button
            size="sm"
            className="h-10 flex-1 rounded-lg sm:h-9 sm:flex-initial"
            disabled={save.isPending}
            onClick={() => save.mutate()}
          >
            {save.isPending ? <Loader2 className="size-4 animate-spin" /> : "Save"}
          </Button>
          {ex.strengthProfile && (
            <Button
              size="sm"
              variant="ghost"
              className="h-10 flex-1 rounded-lg sm:h-9 sm:flex-initial"
              disabled={clear.isPending}
              onClick={() => clear.mutate()}
            >
              Clear
            </Button>
          )}
        </div>
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
    <div className="page-stack">
      <PageHeader
        title="Strength profile"
        description={
          <>
            Log estimated (or tested) 1RM per lift. With %1RM prescriptions, working weights pre-fill for each
            session and adjust after your readiness survey.
          </>
        }
        backLink={{ href: "/settings", label: "← Back to Settings" }}
      />

      <Input
        placeholder="Filter exercises…"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        className="w-full max-w-md rounded-xl"
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
          <ScrollArea className="h-[min(58svh,520px)] px-4 pb-6 max-sm:h-[min(52svh,480px)] sm:px-6">
            <ul className="space-y-7 pr-3 sm:space-y-6">
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
