"use client";

import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { BookOpen, History, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { useWorkoutSessionStore } from "@/stores/workout-session-store";

type TopSet = {
  weight: number;
  weightUnit: string;
  reps: number | null;
  rpe: number | null;
};

type ExerciseTopPayload = {
  exercise: { name: string; slug: string };
  bestSet: (TopSet & { performedAt?: string }) | null;
  recent: (TopSet & { performedAt: string })[];
};

function formatSessionDate(iso: string | undefined) {
  if (!iso) return "";
  try {
    return format(new Date(iso), "MMM d, yyyy");
  } catch {
    return "";
  }
}

export function ExerciseLibrarySheet() {
  const slug = useWorkoutSessionStore((s) => s.libraryExerciseSlug);
  const openLibrary = useWorkoutSessionStore((s) => s.openLibrary);
  const open = slug !== null;
  const browseAll = slug === "__all__";
  const historySlug = open && slug && !browseAll ? slug : null;
  const [q, setQ] = useState("");

  const exercises = useQuery({
    queryKey: ["exercises", q],
    queryFn: async () => {
      const r = await fetch(`/api/exercises?q=${encodeURIComponent(q)}`);
      if (!r.ok) throw new Error("Failed");
      return r.json() as Promise<
        { id: string; name: string; slug: string; muscleTags: string }[]
      >;
    },
    enabled: open,
  });

  const top = useQuery({
    queryKey: ["exercise-top", slug],
    queryFn: async () => {
      if (!slug || slug === "__all__") return null;
      const r = await fetch(`/api/exercises/top?slug=${encodeURIComponent(slug)}`);
      if (!r.ok) throw new Error("Failed to load history");
      return r.json() as Promise<ExerciseTopPayload>;
    },
    enabled: !!historySlug,
  });

  const tags = useMemo(() => {
    const set = new Set<string>();
    (exercises.data ?? []).forEach((e) =>
      e.muscleTags.split(",").forEach((t) => {
        const x = t.trim();
        if (x) set.add(x);
      }),
    );
    return [...set].slice(0, 12);
  }, [exercises.data]);

  const [tagFilter, setTagFilter] = useState<string | null>(null);

  /** Clearing slug when the sheet closes keeps Zustand in sync with the dialog open state. */
  const handleOpenChange = (isOpen: boolean) => {
    if (!isOpen) openLibrary(null);
  };

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetContent
        side="right"
        className="gap-0 p-0 flex flex-col !w-full sm:!max-w-md h-[100dvh] max-h-[100dvh] min-h-0 border-l pt-[env(safe-area-inset-top)]"
      >
        <div className="flex flex-col gap-3 px-4 pt-4 pb-2 shrink-0 pr-12">
          <SheetHeader className="p-0 space-y-1">
            <SheetTitle className="flex items-center gap-2">
              <BookOpen className="size-5 shrink-0" />
              {browseAll
                ? "Exercise library"
                : historySlug
                  ? top.data?.exercise.name ?? "Exercise history"
                  : "Exercise library"}
            </SheetTitle>
            {!browseAll && historySlug && (
              <p className="text-muted-foreground text-xs font-normal">
                Past sets from completed sessions only
              </p>
            )}
          </SheetHeader>

          <Input
            placeholder="Search…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="rounded-xl"
            aria-label="Search exercises"
          />

          <div className="flex flex-wrap gap-1">
            {tags.map((t) => (
              <Badge
                key={t}
                variant={tagFilter === t ? "default" : "secondary"}
                className="cursor-pointer min-h-9 px-2.5"
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    setTagFilter((f) => (f === t ? null : t));
                  }
                }}
                onClick={() => setTagFilter((f) => (f === t ? null : t))}
              >
                {t}
              </Badge>
            ))}
          </div>
        </div>

        <ScrollArea className="flex-1 min-h-0 px-4">
          <ul className="space-y-2 pb-4">
            {exercises.isLoading && (
              <li className="flex items-center gap-2 text-muted-foreground text-sm py-4">
                <Loader2 className="size-4 animate-spin" />
                Loading exercises…
              </li>
            )}
            {exercises.isError && (
              <li className="text-destructive text-sm py-2">Could not load exercises.</li>
            )}
            {(exercises.data ?? [])
              .filter((e) => !tagFilter || e.muscleTags.includes(tagFilter))
              .map((e) => (
                <li key={e.id}>
                  <button
                    type="button"
                    className="w-full min-h-11 rounded-xl border bg-card px-4 py-3 text-left text-sm hover:bg-muted/60 active:bg-muted/80"
                    onClick={() => openLibrary(e.slug)}
                  >
                    <div className="font-medium">{e.name}</div>
                    <div className="text-muted-foreground text-xs">{e.muscleTags}</div>
                  </button>
                </li>
              ))}
          </ul>
        </ScrollArea>

        {historySlug && (
          <div className="shrink-0 border-t px-4 py-4 space-y-3 pb-[max(1rem,env(safe-area-inset-bottom))] bg-muted/20">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
              <History className="size-3.5" aria-hidden />
              History
            </p>

            {top.isPending && (
              <div className="flex items-center gap-2 text-muted-foreground text-sm">
                <Loader2 className="size-4 animate-spin" aria-hidden />
                Loading history…
              </div>
            )}

            {top.isError && (
              <div className="space-y-2">
                <p className="text-destructive text-sm">
                  {(top.error as Error)?.message ?? "Could not load history."}
                </p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="rounded-lg"
                  onClick={() => top.refetch()}
                >
                  Try again
                </Button>
              </div>
            )}

            {top.data && !top.isPending && !top.isError && (
              <>
                {top.data.bestSet ? (
                  <p className="text-sm">
                    <span className="text-muted-foreground">Best est. set: </span>
                    <span className="font-medium">
                      {top.data.bestSet.weight}
                      {top.data.bestSet.weightUnit} × {top.data.bestSet.reps}
                      {top.data.bestSet.rpe != null ? ` @ ${top.data.bestSet.rpe} RPE` : ""}
                    </span>
                  </p>
                ) : (
                  <p className="text-muted-foreground text-sm">
                    No completed sets for this lift yet. Finish and complete a session with logged sets to
                    build history.
                  </p>
                )}

                {top.data.recent.length > 0 && (
                  <div>
                    <p className="text-xs text-muted-foreground mb-2">Recent sessions</p>
                    <ul className="space-y-2 max-h-40 overflow-y-auto pr-1" role="list">
                      {top.data.recent.map((row, i) => (
                        <li
                          key={`${row.performedAt}-${i}`}
                          className="text-sm rounded-lg border bg-card/80 px-3 py-2"
                        >
                          <div className="text-muted-foreground text-xs">
                            {formatSessionDate(row.performedAt)}
                          </div>
                          <div>
                            {row.weight}
                            {row.weightUnit} × {row.reps}
                            {row.rpe != null ? ` @ ${row.rpe} RPE` : ""}
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
