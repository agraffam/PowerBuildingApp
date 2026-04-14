"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Check,
  ChevronDown,
  Ellipsis,
  History,
  Loader2,
  Minus,
  Plus,
  Replace,
  SkipForward,
  StickyNote,
  Trash2,
} from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Toggle } from "@/components/ui/toggle";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useWorkoutSessionStore } from "@/stores/workout-session-store";
import { ExerciseLibrarySheet } from "@/components/training/exercise-library-sheet";
import { ExerciseSwapDialog } from "@/components/training/exercise-swap-dialog";
import { BodyweightScopeDialog } from "@/components/training/bodyweight-scope-dialog";
import {
  SessionCompleteSplash,
  type SessionCompleteSummaryPayload,
} from "@/components/training/session-complete-splash";
import { WeekCompleteSplash } from "@/components/training/week-complete-splash";
import type { WeekCompletionSummaryPayload } from "@/lib/week-completion-summary";
import { resolvePlateIncrementForSession, suggestNextWeekLoad, type WeightUnit } from "@/lib/calculators";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { arrayMove, SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy } from "@dnd-kit/sortable";
import {
  clusterSupersetBlocks,
  flattenBlockOrder,
  orderExercises,
  parseExerciseOrderJson,
} from "@/lib/workout-blocks";
import { formatSecAsMmSs, parseDurationInputToSec } from "@/lib/format-duration";
import { restSecForRpe, rpeToBandId, snapToLoggedRpeStep } from "@/lib/rest-by-rpe";
import { SortableWorkoutBlock } from "@/components/training/sortable-workout-block";
import {
  getWarmupContent,
  resolveWarmupFocus,
  sessionWarmupStorageKey,
  type WarmupContent,
} from "@/lib/session-warmup";

type LoggedSetRow = {
  id: string;
  programExerciseId: string;
  setIndex: number;
  weight: number;
  weightUnit: string;
  reps: number | null;
  rpe: number | null;
  durationSec: number | null;
  calories: number | null;
  done: boolean;
  notes: string | null;
};

/** Mirrors `ResolvedPrescription` from the session API (avoid importing Prisma in the client bundle). */
type SessionExercisePrescription = {
  sets: number;
  repTarget: number;
  targetRpe: number;
  pctOf1rm: number | null;
  restSec: number | null;
  targetDurationSec: number | null;
  targetCalories: number | null;
  blockType: string | null;
  isDeloadWeek: boolean;
};

type ProgramExerciseRow = {
  id: string;
  sortOrder: number;
  supersetGroup: string | null;
  sets: number;
  repTarget: number | null;
  targetRpe: number | null;
  pctOf1rm: number | null;
  restSec: number | null;
  useBodyweight: boolean | null;
  useBodyweightEffective: boolean;
  notes: string | null;
  targetDurationSec: number | null;
  targetCalories: number | null;
  prescription: SessionExercisePrescription;
  exercise: {
    id: string;
    name: string;
    slug: string;
    barIncrementLb: number | null;
    isBodyweight: boolean;
    kind: "STRENGTH" | "CARDIO";
    notes?: string | null;
    effectiveBarIncrementLb?: number | null;
    muscleTags?: string;
  };
};

function blockTypeLabel(blockType: string | null): string {
  if (!blockType) return "";
  return blockType.charAt(0) + blockType.slice(1).toLowerCase();
}

type SessionPayload = {
  session: {
    id: string;
    programInstanceId: string;
    status: string;
    sleep: number | null;
    stress: number | null;
    soreness: number | null;
    intensityMultiplier: number;
    weekIndex: number;
    /** ISO string when set (e.g. completed workouts). */
    performedAt?: string | null;
    exerciseOrder?: unknown;
    sets: LoggedSetRow[];
    programDay: {
      label: string;
      exercises: ProgramExerciseRow[];
    };
  };
  settings: {
    defaultRestSec: number;
    preferredWeightUnit: "KG" | "LB";
    plateIncrementLb: number;
    plateIncrementKg: number;
    restDurationsByRpe: Record<string, number>;
    keepAwakeDuringWorkout: boolean;
  } | null;
  appVersion?: string;
  strengthProfileByExerciseId?: Record<string, { estimatedOneRm: number; weightUnit: "KG" | "LB" }>;
  canEditProgramRest: boolean;
  previousByExerciseId: Record<
    string,
    { weight: number; weightUnit: string; reps: number | null; rpe: number | null }[]
  >;
  displayUnit: "KG" | "LB";
};

function toDatetimeLocalValue(iso: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function blockSetProgress(
  block: ProgramExerciseRow[],
  byExercise: Map<string, LoggedSetRow[]>,
) {
  let done = 0;
  let total = 0;
  for (const ex of block) {
    const rows = byExercise.get(ex.id) ?? [];
    total += rows.length;
    for (const r of rows) {
      if (r.done) done += 1;
    }
  }
  return { done, total };
}

/** iOS Safari and layout timing can ignore a single scrollTo; clear both window and element scrollers. */
function forceDocumentScrollTop() {
  if (typeof window === "undefined") return;
  window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  document.documentElement.scrollTop = 0;
  document.body.scrollTop = 0;
}

export function WorkoutSessionView({ sessionId }: { sessionId: string }) {
  const router = useRouter();
  const qc = useQueryClient();
  const openLibrary = useWorkoutSessionStore((s) => s.openLibrary);
  const startRest = useWorkoutSessionStore((s) => s.startRest);
  const clearRest = useWorkoutSessionStore((s) => s.clearRest);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [skipDayOpen, setSkipDayOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [swapTarget, setSwapTarget] = useState<{
    programExerciseId: string;
    name: string;
    muscleTags?: string;
  } | null>(null);
  const [bwDialog, setBwDialog] = useState<{
    programExerciseId: string;
    name: string;
    targetBodyweight: boolean;
  } | null>(null);
  const [completeSplash, setCompleteSplash] = useState<SessionCompleteSummaryPayload | null>(null);
  const [weekSplashQueued, setWeekSplashQueued] = useState<WeekCompletionSummaryPayload | null>(null);
  const [weekSplash, setWeekSplash] = useState<WeekCompletionSummaryPayload | null>(null);
  const [exerciseActionsTarget, setExerciseActionsTarget] = useState<{
    id: string;
    name: string;
    slug: string;
    kind: "STRENGTH" | "CARDIO";
    muscleTags?: string;
  } | null>(null);
  const [exerciseNotesDialogTarget, setExerciseNotesDialogTarget] = useState<{
    programExerciseId: string;
    notes: string | null;
  } | null>(null);
  const [exerciseSettingsTarget, setExerciseSettingsTarget] = useState<{
    id: string;
    exerciseId: string;
    name: string;
    hasOneRm: boolean;
  } | null>(null);
  const [exerciseRestDraft, setExerciseRestDraft] = useState("180");
  const [exerciseOneRmDraft, setExerciseOneRmDraft] = useState("");
  const [exerciseIncrementDraft, setExerciseIncrementDraft] = useState("2.5");
  const [keepAwakeEnabled, setKeepAwakeEnabled] = useState(false);
  const [wakeLockSupported, setWakeLockSupported] = useState(true);
  const wakeLockRef = useRef<{ release: () => Promise<void>; released?: boolean } | null>(null);
  const [collapsedBlockIds, setCollapsedBlockIds] = useState<Set<string>>(() => new Set());
  const prevBlockProgressRef = useRef<Map<string, { done: number; total: number }>>(new Map());
  /** After first progress sync for this session, we only auto-collapse/scroll on real completions (not on mount). */
  const workoutProgressBaselineReadyRef = useRef(false);
  /** Tracks readiness/warmup gate so we scroll to top when the exercise list first appears. */
  const workoutGatedRef = useRef<boolean | null>(null);
  /** One scroll-to-top per session when the exercise list is visible (handles direct /workout links). */
  const ungatedListScrollTokenRef = useRef<string | null>(null);
  const blockAnchorRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const setBlockAnchorRef = useCallback((blockId: string, node: HTMLDivElement | null) => {
    if (node) blockAnchorRefs.current.set(blockId, node);
    else blockAnchorRefs.current.delete(blockId);
  }, []);
  const preserveScrollForBlockCollapse = useCallback((blockId: string, beforeTop: number | null) => {
    if (beforeTop == null) return;
    window.requestAnimationFrame(() => {
      const node = blockAnchorRefs.current.get(blockId);
      if (!node) return;
      const afterTop = node.getBoundingClientRect().top;
      const delta = afterTop - beforeTop;
      if (Math.abs(delta) > 1) {
        window.scrollBy({ top: delta });
      }
    });
  }, []);
  const toggleBlockCollapsed = useCallback((blockId: string) => {
    const node = blockAnchorRefs.current.get(blockId);
    const beforeTop = node ? node.getBoundingClientRect().top : null;
    setCollapsedBlockIds((prev) => {
      const next = new Set(prev);
      if (next.has(blockId)) next.delete(blockId);
      else next.add(blockId);
      return next;
    });
    preserveScrollForBlockCollapse(blockId, beforeTop);
  }, [preserveScrollForBlockCollapse]);

  const q = useQuery({
    queryKey: ["session", sessionId],
    queryFn: async () => {
      const r = await fetch(`/api/training/sessions/${sessionId}`, { credentials: "include" });
      if (r.status === 401) {
        window.location.assign("/login");
        throw new Error("Unauthorized");
      }
      if (r.status === 404) {
        throw new Error("SESSION_NOT_FOUND");
      }
      if (!r.ok) throw new Error("Failed");
      return r.json() as Promise<SessionPayload>;
    },
  });

  useEffect(() => {
    setKeepAwakeEnabled(Boolean(q.data?.settings?.keepAwakeDuringWorkout));
  }, [q.data?.settings?.keepAwakeDuringWorkout]);

  useEffect(() => {
    if (typeof navigator === "undefined") return;
    const nav = navigator as Navigator & {
      wakeLock?: {
        request: (type: "screen") => Promise<{ release: () => Promise<void>; released?: boolean }>;
      };
    };
    const supported = typeof nav.wakeLock?.request === "function";
    setWakeLockSupported(supported);
    if (!supported) return;

    let cancelled = false;

    const requestWakeLock = async () => {
      if (!keepAwakeEnabled) return;
      if (document.visibilityState !== "visible") return;
      try {
        const lock = await nav.wakeLock!.request("screen");
        if (!cancelled) wakeLockRef.current = lock;
      } catch {
        // Browser/user power policy can reject; keep UI functional regardless.
      }
    };

    const releaseWakeLock = async () => {
      try {
        await wakeLockRef.current?.release();
      } catch {
        // no-op
      } finally {
        wakeLockRef.current = null;
      }
    };

    const onVisibilityChange = () => {
      if (!keepAwakeEnabled) return;
      if (document.visibilityState === "visible") {
        void requestWakeLock();
      }
    };

    void (keepAwakeEnabled ? requestWakeLock() : releaseWakeLock());
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVisibilityChange);
      void releaseWakeLock();
    };
  }, [keepAwakeEnabled]);

  useEffect(() => {
    if (completeSplash) clearRest();
  }, [completeSplash, clearRest]);

  const patch = useMutation({
    mutationFn: async (body: object) => {
      const r = await fetch(`/api/training/sessions/${sessionId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(body),
      });
      if (r.status === 401) {
        window.location.assign("/login");
        throw new Error("Unauthorized");
      }
      if (!r.ok) {
        const j = (await r.json().catch(() => ({}))) as { error?: string };
        throw new Error(j.error ?? "Update failed");
      }
      return (await r.json()) as unknown;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["session", sessionId] });
      void qc.invalidateQueries({ queryKey: ["training-history"] });
    },
  });
  const patchProgramExercise = useMutation({
    mutationFn: async (payload: { programExerciseId: string; restSec: number | null }) => {
      const r = await fetch(`/api/program-exercises/${payload.programExerciseId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ restSec: payload.restSec }),
      });
      if (!r.ok) throw new Error("Failed to update exercise rest");
      return r.json();
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["session", sessionId] });
    },
  });
  const patchStrength = useMutation({
    mutationFn: async (payload: { exerciseId: string; estimatedOneRm: number; weightUnit: "KG" | "LB" }) => {
      const r = await fetch(`/api/strength/${payload.exerciseId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
      });
      if (!r.ok) throw new Error("Failed to save 1RM");
      return r.json();
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["session", sessionId] });
      void qc.invalidateQueries({ queryKey: ["strength"] });
    },
  });
  const patchSettings = useMutation({
    mutationFn: async (payload: { plateIncrementLb?: number; plateIncrementKg?: number }) => {
      const r = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
      });
      if (!r.ok) throw new Error("Failed to save increment");
      return r.json();
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["settings"] });
      void qc.invalidateQueries({ queryKey: ["session", sessionId] });
    },
  });

  const del = useMutation({
    mutationFn: async () => {
      const r = await fetch(`/api/training/sessions/${sessionId}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (r.status === 401) {
        window.location.assign("/login");
        throw new Error("Unauthorized");
      }
      if (!r.ok) {
        const j = (await r.json().catch(() => ({}))) as { error?: string };
        throw new Error(j.error ?? "Delete failed");
      }
      return r.json();
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["training-history"] });
      void qc.invalidateQueries({ queryKey: ["training-active"] });
      router.push("/history");
    },
  });

  const byExercise = useMemo(() => {
    const session = q.data?.session;
    if (!session) return new Map<string, LoggedSetRow[]>();
    const ordered = orderExercises(
      session.programDay.exercises,
      parseExerciseOrderJson(session.exerciseOrder),
    );
    const pos = new Map(ordered.map((e, i) => [e.id, i]));
    const rows = [...session.sets].sort((a, b) => {
      const ao = pos.get(a.programExerciseId) ?? 0;
      const bo = pos.get(b.programExerciseId) ?? 0;
      if (ao !== bo) return ao - bo;
      return a.setIndex - b.setIndex;
    });
    const m = new Map<string, LoggedSetRow[]>();
    for (const s of rows) {
      if (!m.has(s.programExerciseId)) m.set(s.programExerciseId, []);
      m.get(s.programExerciseId)!.push(s);
    }
    for (const arr of m.values()) arr.sort((a, b) => a.setIndex - b.setIndex);
    return m;
  }, [q.data?.session]);
  const sessionEarly = q.data?.session;
  const [performedAtLocal, setPerformedAtLocal] = useState("");
  const [warmupDismissed, setWarmupDismissed] = useState(false);
  useEffect(() => {
    try {
      setWarmupDismissed(sessionStorage.getItem(sessionWarmupStorageKey(sessionId)) === "1");
    } catch {
      setWarmupDismissed(false);
    }
  }, [sessionId]);

  useEffect(() => {
    workoutProgressBaselineReadyRef.current = false;
    prevBlockProgressRef.current = new Map();
    workoutGatedRef.current = null;
    ungatedListScrollTokenRef.current = null;
  }, [sessionId]);

  useEffect(() => {
    const prevRestoration = window.history.scrollRestoration;
    window.history.scrollRestoration = "manual";
    return () => {
      window.history.scrollRestoration = prevRestoration;
    };
  }, []);
  useEffect(() => {
    if (sessionEarly?.performedAt) {
      setPerformedAtLocal(toDatetimeLocalValue(sessionEarly.performedAt));
    }
  }, [sessionEarly?.performedAt]);

  const orderedExercises = useMemo(() => {
    if (!sessionEarly) return [] as ProgramExerciseRow[];
    return orderExercises(
      sessionEarly.programDay.exercises,
      parseExerciseOrderJson(sessionEarly.exerciseOrder),
    );
  }, [sessionEarly]);

  const blocks = useMemo(() => clusterSupersetBlocks(orderedExercises), [orderedExercises]);
  const blockIds = useMemo(() => blocks.map((b) => b.map((e) => e.id).join("|")), [blocks]);

  const readinessGate = useMemo(() => {
    const s = q.data?.session;
    if (!s) return false;
    return s.sleep == null && (s.status === "PLANNED" || s.status === "IN_PROGRESS");
  }, [q.data?.session]);

  const warmupGate = useMemo(() => {
    const s = q.data?.session;
    if (!s || s.status === "COMPLETED") return false;
    if (!(s.status === "PLANNED" || s.status === "IN_PROGRESS")) return false;
    if (readinessGate) return false;
    return orderedExercises.length > 0 && !warmupDismissed;
  }, [q.data?.session, readinessGate, orderedExercises.length, warmupDismissed]);

  useLayoutEffect(() => {
    if (!q.data?.session || q.data.session.status === "COMPLETED") {
      workoutGatedRef.current = null;
      return;
    }
    const gated = readinessGate || warmupGate;
    const prev = workoutGatedRef.current;
    if (prev === true && gated === false) {
      forceDocumentScrollTop();
      queueMicrotask(forceDocumentScrollTop);
      setTimeout(forceDocumentScrollTop, 0);
      setTimeout(forceDocumentScrollTop, 120);
    }
    workoutGatedRef.current = gated;
  }, [q.data?.session, readinessGate, warmupGate]);

  /** Direct navigation to /workout/... with no readiness/warmup: scroll before first paint. */
  useLayoutEffect(() => {
    if (!q.data?.session || q.data.session.status === "COMPLETED") return;
    if (readinessGate || warmupGate) return;
    const token = `${sessionId}:ungated-list`;
    if (ungatedListScrollTokenRef.current === token) return;
    ungatedListScrollTokenRef.current = token;
    forceDocumentScrollTop();
    queueMicrotask(forceDocumentScrollTop);
  }, [sessionId, q.data?.session, readinessGate, warmupGate]);

  useEffect(() => {
    if (!sessionEarly || sessionEarly.status === "COMPLETED") return;
    if (blocks.length === 0) return;

    if (!workoutProgressBaselineReadyRef.current) {
      const nextPrev = new Map<string, { done: number; total: number }>();
      const initiallyCollapsed = new Set<string>();
      blocks.forEach((block, bi) => {
        const id = blockIds[bi]!;
        const prog = blockSetProgress(block, byExercise);
        nextPrev.set(id, prog);
        if (prog.total > 0 && prog.done === prog.total) initiallyCollapsed.add(id);
      });
      prevBlockProgressRef.current = nextPrev;
      setCollapsedBlockIds(initiallyCollapsed);
      workoutProgressBaselineReadyRef.current = true;
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          forceDocumentScrollTop();
          setTimeout(forceDocumentScrollTop, 0);
          setTimeout(forceDocumentScrollTop, 120);
        });
      });
      return;
    }

    const toCollapse: string[] = [];
    const nextPrev = new Map<string, { done: number; total: number }>();
    blocks.forEach((block, bi) => {
      const id = blockIds[bi]!;
      const prog = blockSetProgress(block, byExercise);
      const prev = prevBlockProgressRef.current.get(id);
      if (
        prog.total > 0 &&
        prog.done === prog.total &&
        prev != null &&
        prev.done < prev.total
      ) {
        toCollapse.push(id);
      }
      nextPrev.set(id, prog);
    });
    prevBlockProgressRef.current = nextPrev;
    if (toCollapse.length === 0) return;

    setCollapsedBlockIds((prev) => {
      const next = new Set(prev);
      for (const id of toCollapse) next.add(id);
      return next;
    });
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        for (let bi = 0; bi < blocks.length; bi++) {
          const id = blockIds[bi]!;
          const blk = blocks[bi]!;
          const prog = blockSetProgress(blk, byExercise);
          if (prog.total === 0) continue;
          if (prog.done < prog.total) {
            blockAnchorRefs.current.get(id)?.scrollIntoView({ block: "start", behavior: "smooth" });
            break;
          }
        }
      });
    });
  }, [sessionEarly, sessionEarly?.status, blocks, blockIds, byExercise]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const commitSet = useCallback(
    async (body: object) => {
      await patch.mutateAsync(body);
      const st = qc.getQueryData<SessionPayload>(["session", sessionId])?.session.status;
      if (st === "COMPLETED") return;
      const b = body as { action?: string; setId?: string; done?: boolean; rpe?: number | null };
      if (b.action !== "set" || b.done !== true) return;
      await qc.refetchQueries({ queryKey: ["session", sessionId] });
      const payload = qc.getQueryData<SessionPayload>(["session", sessionId]);
      if (!payload || !payload.settings) return;
      const sessSettings = payload.settings;
      const row = payload.session.sets.find((s) => s.id === b.setId);
      if (!row) return;
      const setIndex = row.setIndex;
      /** Prefer RPE from this PATCH so rest length matches the slider even if cache lags slightly. */
      const rpeFromCommit =
        typeof b.rpe === "number" && Number.isFinite(b.rpe) ? b.rpe : null;
      const ordered = orderExercises(
        payload.session.programDay.exercises,
        parseExerciseOrderJson(payload.session.exerciseOrder),
      );
      const blks = clusterSupersetBlocks(ordered);
      const block = blks.find((blk) => blk.some((e) => e.id === row.programExerciseId));
      if (!block) return;
      const defaultRest = sessSettings.defaultRestSec ?? 180;
      const rpeMap = sessSettings.restDurationsByRpe ?? {};
      const hasPrescribedRest = block.some((ex) => ex.restSec != null);
      const restSec = hasPrescribedRest
        ? Math.max(
            ...block.map((ex) => {
              const rs = payload.session.sets
                .filter((s) => s.programExerciseId === ex.id)
                .sort((a, b) => a.setIndex - b.setIndex);
              const setRow = rs[setIndex];
              const rpeForRest =
                ex.id === row.programExerciseId && rpeFromCommit != null
                  ? rpeFromCommit
                  : (setRow?.rpe ?? ex.prescription.targetRpe);
              const targetRpe = ex.prescription.targetRpe;
              if (targetRpe == null || !Number.isFinite(targetRpe) || rpeForRest == null || !Number.isFinite(rpeForRest)) {
                return ex.restSec ?? defaultRest;
              }
              const base = ex.restSec ?? defaultRest;
              const halfSteps = Math.round(((rpeForRest - targetRpe) / 0.5) * 10) / 10;
              return Math.max(30, Math.min(210, base + halfSteps * 15));
            }),
            0,
          )
        : Math.max(
            ...block.map((ex) => {
              const rs = payload.session.sets
                .filter((s) => s.programExerciseId === ex.id)
                .sort((a, b) => a.setIndex - b.setIndex);
              const setRow = rs[setIndex];
              const rpeForRest =
                ex.id === row.programExerciseId && rpeFromCommit != null
                  ? rpeFromCommit
                  : (setRow?.rpe ?? ex.prescription.targetRpe);
              return restSecForRpe(rpeMap, rpeForRest, defaultRest);
            }),
            0,
          );
      const allDone = block.every((ex) => {
        const rs = payload.session.sets
          .filter((s) => s.programExerciseId === ex.id)
          .sort((a, b) => a.setIndex - b.setIndex);
        return rs[setIndex]?.done === true;
      });
      if (allDone) {
        const peRow = payload.session.programDay.exercises.find((e) => e.id === row.programExerciseId);
        const rpeForBand =
          rpeFromCommit ?? row.rpe ?? peRow?.prescription.targetRpe ?? 8;
        const rpeBand = hasPrescribedRest ? null : rpeToBandId(rpeForBand);
        startRest(restSec, {
          rpeBand,
          prescribedRest: hasPrescribedRest,
          programExerciseIds: block.map((e) => e.id),
          canEditProgramRest: payload.canEditProgramRest,
          sessionId,
        });
      }
    },
    [patch, qc, sessionId, startRest],
  );

  const commitExerciseNotes = useCallback(
    async (programExerciseId: string, notes: string | null) => {
      await patch.mutateAsync({ action: "setExerciseNotes", programExerciseId, notes });
    },
    [patch],
  );

  const onDragEndBlocks = useCallback(
    async (event: DragEndEvent) => {
      const { active, over } = event;
      if (!over || active.id === over.id) return;
      const ids = blockIds;
      const oldIndex = ids.indexOf(String(active.id));
      const newIndex = ids.indexOf(String(over.id));
      if (oldIndex < 0 || newIndex < 0) return;
      const next = arrayMove(blocks, oldIndex, newIndex);
      const flat = flattenBlockOrder(next);
      await patch.mutateAsync({ action: "reorderExercises", orderedProgramExerciseIds: flat });
    },
    [blockIds, blocks, patch],
  );


  if (q.isLoading || (!q.data && !q.isError)) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="size-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (q.isError) {
    if (q.error instanceof Error && q.error.message === "SESSION_NOT_FOUND") {
      return (
        <Card className="mx-auto max-w-md rounded-2xl border">
          <CardHeader>
            <CardTitle className="text-lg">Workout unavailable</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-muted-foreground text-sm">
              This session was cancelled or removed. Open Train or History to continue.
            </p>
            <div className="flex flex-col gap-2">
              <Link
                href="/history"
                className={cn(
                  buttonVariants({ size: "lg", variant: "default" }),
                  "h-12 w-full rounded-xl inline-flex items-center justify-center",
                )}
              >
                Workout history
              </Link>
              <Link
                href="/"
                className={cn(
                  buttonVariants({ size: "lg", variant: "outline" }),
                  "h-12 w-full rounded-xl inline-flex items-center justify-center",
                )}
              >
                Back to Train
              </Link>
            </div>
          </CardContent>
        </Card>
      );
    }
    return (
      <p className="text-center text-sm text-destructive py-12">
        Could not load this workout.{" "}
        <Link href="/" className="underline underline-offset-4">
          Back to Train
        </Link>
      </p>
    );
  }

  if (!q.data) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="size-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const { session, settings, previousByExerciseId } = q.data;
  const unit = settings?.preferredWeightUnit ?? "LB";
  const isHistorySession = session.status === "COMPLETED";
  const sessionBlockTypes = Array.from(
    new Set(
      orderedExercises
        .map((ex) => ex.prescription.blockType)
        .filter((v): v is string => v != null),
    ),
  );
  const sessionBlockTypeLabel =
    sessionBlockTypes.length === 1
      ? blockTypeLabel(sessionBlockTypes[0] ?? null)
      : sessionBlockTypes.length > 1
        ? "Mixed blocks"
        : "";
  const readinessNeeded =
    session.sleep == null && (session.status === "PLANNED" || session.status === "IN_PROGRESS");
  const canCancel = session.status === "PLANNED" || session.status === "IN_PROGRESS";
  const firstExercise = orderedExercises[0] ?? null;
  const warmupNeeded =
    !readinessNeeded &&
    !isHistorySession &&
    canCancel &&
    firstExercise != null &&
    !warmupDismissed;

  return (
    <div className="space-y-8 pb-32 max-sm:pb-40 sm:space-y-6 sm:pb-28">
      <div className="min-w-0 space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-bold tracking-tight leading-snug">{session.programDay.label}</h1>
          {isHistorySession && (
            <Badge variant="secondary" className="text-xs">
              Completed
            </Badge>
          )}
        </div>
        <p className="text-muted-foreground text-sm leading-relaxed">
          Week {session.weekIndex + 1}
          {session.intensityMultiplier !== 1 && (
            <span>
              {" "}
              · intensity ×{session.intensityMultiplier.toFixed(2)}
            </span>
          )}
          {sessionBlockTypeLabel && <span> · {sessionBlockTypeLabel}</span>}
        </p>
        {isHistorySession && (
          <Link href="/history" className="mt-1 inline-block text-xs text-primary underline-offset-4 hover:underline">
            ← All workouts
          </Link>
        )}
      </div>
      {keepAwakeEnabled && !wakeLockSupported && (
        <p className="text-xs text-muted-foreground">
          Keep Awake is not supported in this browser version (common on some iPhone Safari builds).
        </p>
      )}

      {readinessNeeded && (
        <ReadinessCard
          onSubmit={(sleep, stress, soreness) =>
            patch.mutate({ action: "readiness", sleep, stress, soreness })
          }
          loading={patch.isPending}
        />
      )}

      {!readinessNeeded && warmupNeeded && firstExercise && (
        <WarmupCard
          content={getWarmupContent(
            resolveWarmupFocus(firstExercise.exercise.slug),
            firstExercise.exercise.name,
          )}
          onContinue={() => {
            try {
              sessionStorage.setItem(sessionWarmupStorageKey(sessionId), "1");
            } catch {
              /* storage unavailable */
            }
            setWarmupDismissed(true);
          }}
        />
      )}

      {!readinessNeeded && !warmupNeeded &&
        (() => {
          const canReorderBlocks = canCancel && blocks.length > 1;

          const renderExerciseTitleStack = (ex: ProgramExerciseRow) => {
            const cardioLine =
              ex.exercise.kind === "CARDIO" ? (
                <div
                  className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground mt-0.5"
                  title={[
                    "Cardio",
                    `${ex.prescription.sets} bouts`,
                    ex.prescription.targetDurationSec != null
                      ? formatSecAsMmSs(ex.prescription.targetDurationSec)
                      : null,
                    ex.prescription.targetCalories != null ? `~${ex.prescription.targetCalories} kcal` : null,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                >
                  <Badge variant="outline" className="text-xs shrink-0">
                    Cardio
                  </Badge>
                  {ex.prescription.isDeloadWeek && (
                    <Badge
                      variant="outline"
                      className="text-xs shrink-0 border-amber-500/50 text-amber-800 dark:text-amber-400"
                    >
                      Deload week
                    </Badge>
                  )}
                  <span className="text-foreground/90 tabular-nums font-medium">
                    {ex.prescription.sets} bouts
                  </span>
                  {ex.prescription.targetDurationSec != null && (
                    <span className="tabular-nums">· {formatSecAsMmSs(ex.prescription.targetDurationSec)}</span>
                  )}
                  {ex.prescription.targetCalories != null && (
                    <span className="tabular-nums">· ~{ex.prescription.targetCalories} kcal</span>
                  )}
                </div>
              ) : null;

            return (
              <div className="min-w-0 space-y-1">
                <div className="rounded-xl bg-muted/60 px-3 py-2.5 text-left sm:py-2">
                  <CardTitle className="text-left text-lg leading-snug">{ex.exercise.name}</CardTitle>
                  {cardioLine}
                </div>
                {ex.exercise.kind !== "CARDIO" && ex.prescription.isDeloadWeek && (
                  <div className="flex flex-wrap gap-1">
                    <Badge
                      variant="outline"
                      className="text-xs border-amber-500/50 text-amber-800 dark:text-amber-400"
                    >
                      Deload week
                    </Badge>
                  </div>
                )}
              </div>
            );
          };

          const targetLineTitle =
            (ex: ProgramExerciseRow) =>
              ex.prescription.pctOf1rm != null
                ? `Target ${ex.prescription.repTarget} reps @ ~${ex.prescription.targetRpe} RPE · ${ex.prescription.pctOf1rm}% 1RM`
                : `Target ${ex.prescription.repTarget} reps @ ~${ex.prescription.targetRpe} RPE`;

          const renderExerciseMetaRow = (ex: ProgramExerciseRow) => (
            <div className="flex min-w-0 flex-nowrap items-center gap-2">
              <div className="flex min-w-0 flex-1 items-center gap-1.5 overflow-hidden">
                {ex.exercise.kind === "CARDIO" ? (
                  <span className="truncate text-xs text-muted-foreground tabular-nums">
                    {ex.prescription.sets} bouts
                    {ex.prescription.targetDurationSec != null &&
                      ` · ${formatSecAsMmSs(ex.prescription.targetDurationSec)}`}
                    {ex.prescription.targetCalories != null && ` · ~${ex.prescription.targetCalories} kcal`}
                  </span>
                ) : (
                  <>
                    <Badge variant="secondary" className="shrink-0 text-xs tabular-nums">
                      {ex.prescription.sets} sets
                    </Badge>
                    <span
                      className="min-w-0 truncate text-xs text-muted-foreground tabular-nums"
                      title={targetLineTitle(ex)}
                    >
                      Target {ex.prescription.repTarget} reps @ ~{ex.prescription.targetRpe} RPE
                      {ex.prescription.pctOf1rm != null ? ` · ${ex.prescription.pctOf1rm}% 1RM` : ""}
                    </span>
                  </>
                )}
              </div>
              <div className="flex shrink-0 items-center">
                {canCancel ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-9 shrink-0 px-2 text-muted-foreground sm:px-2.5"
                    onClick={() =>
                      setExerciseActionsTarget({
                        id: ex.id,
                        name: ex.exercise.name,
                        slug: ex.exercise.slug,
                        kind: ex.exercise.kind,
                        muscleTags: ex.exercise.muscleTags,
                      })
                    }
                    type="button"
                  >
                    <Ellipsis className="size-4 sm:mr-1" />
                    More
                  </Button>
                ) : (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-9 shrink-0 px-2 text-muted-foreground sm:px-2.5"
                    onClick={() => openLibrary(ex.exercise.slug)}
                    type="button"
                  >
                    <History className="size-4 sm:mr-1" />
                    History
                  </Button>
                )}
              </div>
            </div>
          );

          const renderSoloCard = (
            ex: ProgramExerciseRow,
            blockId: string,
            dragHandle?: ReactNode,
          ) => {
            const collapsed = collapsedBlockIds.has(blockId);
            const rows = byExercise.get(ex.id) ?? [];
            const prev = previousByExerciseId[ex.id];
            const { done, total } = blockSetProgress([ex], byExercise);
            const plateInc = resolvePlateIncrementForSession(
              unit as WeightUnit,
              ex.exercise.effectiveBarIncrementLb ?? ex.exercise.barIncrementLb,
              {
                plateIncrementLb: settings?.plateIncrementLb ?? 2.5,
                plateIncrementKg: settings?.plateIncrementKg ?? 2.5,
              },
            );
            return (
              <Card className="overflow-hidden rounded-2xl border shadow-sm">
                <CardHeader className="space-y-1 bg-muted/40 pb-3 sm:pb-2">
                  <div className="flex flex-col gap-1.5">
                    <div className="flex items-start gap-0.5 sm:gap-1">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="shrink-0 size-9 rounded-lg mt-0.5"
                        onClick={() => toggleBlockCollapsed(blockId)}
                        aria-expanded={!collapsed}
                        aria-label={collapsed ? "Expand exercise" : "Collapse exercise"}
                      >
                        <ChevronDown
                          className={cn(
                            "size-5 text-muted-foreground transition-transform",
                            collapsed && "-rotate-90",
                          )}
                        />
                      </Button>
                      {dragHandle ? <div className="mt-0.5 shrink-0">{dragHandle}</div> : null}
                      <div className="flex-1 min-w-0 space-y-1">
                        {renderExerciseTitleStack(ex)}
                        {!canCancel && (ex.notes?.trim() || ex.exercise.notes?.trim()) && (
                          <p className="text-xs leading-relaxed text-muted-foreground border-l-2 border-primary/30 pl-2 py-1">
                            {ex.notes?.trim() || ex.exercise.notes}
                          </p>
                        )}
                      </div>
                    </div>
                    {!collapsed ? renderExerciseMetaRow(ex) : null}
                    {collapsed ? (
                      <p className="text-xs text-muted-foreground">
                        <span className="font-medium text-foreground">
                          {done}/{total} {ex.exercise.kind === "CARDIO" ? "bouts" : "sets"} done
                        </span>
                      </p>
                    ) : null}
                  </div>
                </CardHeader>
                {!collapsed && (
                  <CardContent className="space-y-4 pt-4">
                    {rows.map((row, idx) => {
                      const ghost = prev?.[idx];
                      const prog =
                        ex.exercise.kind === "CARDIO"
                          ? {
                              bumped: false,
                              suggested: 0,
                              bumpPct: 0,
                            }
                          : suggestNextWeekLoad({
                              currentWeight: row.weight,
                              repGoal: ex.prescription.repTarget,
                              actualReps: row.reps ?? 0,
                              prescribedRpe: ex.prescription.targetRpe,
                              actualRpe: row.rpe ?? ex.prescription.targetRpe,
                              plateIncrement: plateInc,
                            });
                      return (
                        <SetRowEditor
                          key={row.id}
                          row={row}
                          idx={idx}
                          unit={unit}
                          repTarget={ex.prescription.repTarget}
                          targetRpe={ex.prescription.targetRpe}
                          ghost={ghost}
                          prog={prog}
                          progressionStep={plateInc}
                          savePending={patch.isPending}
                          bodyweight={ex.useBodyweightEffective}
                          isCardio={ex.exercise.kind === "CARDIO"}
                          onCommitSet={(body) => void commitSet(body)}
                        />
                      );
                    })}
                    {canCancel && (
                      <div className="flex justify-end pt-1">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="rounded-xl"
                          disabled={patch.isPending}
                          onClick={() => void patch.mutateAsync({ action: "addSet", programExerciseId: ex.id })}
                        >
                          Add set
                        </Button>
                      </div>
                    )}
                    <Separator />
                  </CardContent>
                )}
              </Card>
            );
          };

          const renderSupersetCard = (
            block: ProgramExerciseRow[],
            blockId: string,
            dragHandle?: ReactNode,
          ) => {
            const label = block[0]?.supersetGroup ?? "Superset";
            const nSets = block[0]!.prescription.sets;
            const collapsed = collapsedBlockIds.has(blockId);
            const { done, total } = blockSetProgress(block, byExercise);
            const names = block.map((e) => e.exercise.name).join(" · ");
            return (
              <Card className="overflow-hidden rounded-2xl border shadow-sm border-primary/25">
                <CardHeader className="space-y-1 bg-primary/5 pb-3 sm:pb-2">
                  <div className="flex flex-col gap-1.5">
                    <div className="flex items-start gap-0.5 sm:gap-1">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="shrink-0 size-9 rounded-lg mt-0.5"
                        onClick={() => toggleBlockCollapsed(blockId)}
                        aria-expanded={!collapsed}
                        aria-label={collapsed ? "Expand superset" : "Collapse superset"}
                      >
                        <ChevronDown
                          className={cn(
                            "size-5 text-muted-foreground transition-transform",
                            collapsed && "-rotate-90",
                          )}
                        />
                      </Button>
                      {dragHandle ? <div className="mt-0.5 shrink-0">{dragHandle}</div> : null}
                      <div className="flex-1 min-w-0 space-y-1">
                        <CardTitle className="text-lg">Superset ({label})</CardTitle>
                        {!collapsed ? (
                          <>
                            <p className="text-muted-foreground text-xs">
                              Alternate exercises each round, then rest when the full round is done.
                            </p>
                            <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                              <Badge variant="secondary">{nSets} rounds</Badge>
                            </div>
                          </>
                        ) : null}
                      </div>
                    </div>
                    {collapsed ? (
                      <p className="text-xs text-muted-foreground">
                        <span className="font-medium text-foreground">
                          {done}/{total} sets done
                        </span>
                        <span> · {names}</span>
                      </p>
                    ) : null}
                  </div>
                </CardHeader>
                {!collapsed && (
                  <CardContent className="space-y-6 pt-4">
                    {Array.from({ length: nSets }, (_, si) => (
                      <div key={si} className="space-y-3">
                        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                          Round {si + 1}
                        </p>
                        {block.map((ex) => {
                          const rows = byExercise.get(ex.id) ?? [];
                          const row = rows[si];
                          const prev = previousByExerciseId[ex.id];
                          const ghost = prev?.[si];
                          const plateInc = resolvePlateIncrementForSession(
                            unit as WeightUnit,
                            ex.exercise.effectiveBarIncrementLb ?? ex.exercise.barIncrementLb,
                            {
                              plateIncrementLb: settings?.plateIncrementLb ?? 2.5,
                              plateIncrementKg: settings?.plateIncrementKg ?? 2.5,
                            },
                          );
                          if (!row) return null;
                          const prog =
                            ex.exercise.kind === "CARDIO"
                              ? { bumped: false, suggested: 0, bumpPct: 0 }
                              : suggestNextWeekLoad({
                                  currentWeight: row.weight,
                                  repGoal: ex.prescription.repTarget,
                                  actualReps: row.reps ?? 0,
                                  prescribedRpe: ex.prescription.targetRpe,
                                  actualRpe: row.rpe ?? ex.prescription.targetRpe,
                                  plateIncrement: plateInc,
                                });
                          return (
                            <div key={ex.id} className="rounded-xl border bg-muted/20 p-3 space-y-2">
                              {renderExerciseTitleStack(ex)}
                              {renderExerciseMetaRow(ex)}
                              {!canCancel && (ex.notes?.trim() || ex.exercise.notes?.trim()) && (
                                <p className="text-xs leading-relaxed text-muted-foreground border-l-2 border-primary/30 pl-2 py-1">
                                  {ex.notes?.trim() || ex.exercise.notes}
                                </p>
                              )}
                              <SetRowEditor
                                row={row}
                                idx={si}
                                unit={unit}
                                repTarget={ex.prescription.repTarget}
                                targetRpe={ex.prescription.targetRpe}
                                ghost={ghost}
                                prog={prog}
                                progressionStep={plateInc}
                                savePending={patch.isPending}
                                bodyweight={ex.useBodyweightEffective}
                                isCardio={ex.exercise.kind === "CARDIO"}
                                onCommitSet={(body) => void commitSet(body)}
                              />
                            </div>
                          );
                        })}
                      </div>
                    ))}
                    <Separator />
                  </CardContent>
                )}
              </Card>
            );
          };

          const items = blocks.map((block, bi) => {
            const id = blockIds[bi]!;
            const isSuperset = block.length > 1;
            const anchorClass =
              "scroll-mt-[max(5.25rem,calc(env(safe-area-inset-top)+3.5rem))]";
            if (!canReorderBlocks) {
              const card = isSuperset ? renderSupersetCard(block, id) : renderSoloCard(block[0]!, id);
              return (
                <div key={id} ref={(node) => setBlockAnchorRef(id, node)} className={anchorClass}>
                  {card}
                </div>
              );
            }
            return (
              <SortableWorkoutBlock key={id} id={id}>
                {(handle) => (
                  <div ref={(node) => setBlockAnchorRef(id, node)} className={anchorClass}>
                    {isSuperset
                      ? renderSupersetCard(block, id, handle)
                      : renderSoloCard(block[0]!, id, handle)}
                  </div>
                )}
              </SortableWorkoutBlock>
            );
          });

          if (canReorderBlocks) {
            return (
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={(e) => void onDragEndBlocks(e)}
              >
                <SortableContext items={blockIds} strategy={verticalListSortingStrategy}>
                  <div className="space-y-5 max-sm:space-y-6 sm:space-y-4">{items}</div>
                </SortableContext>
              </DndContext>
            );
          }
          return <div className="space-y-5 max-sm:space-y-6 sm:space-y-4">{items}</div>;
        })()}

      {isHistorySession && (
        <Card className="rounded-2xl border">
          <CardHeader className="py-3">
            <CardTitle className="text-base">Workout date</CardTitle>
            <p className="text-muted-foreground text-xs">Adjust when you trained, then save.</p>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-1">
              <Label className="text-xs">Performed at</Label>
              <Input
                type="datetime-local"
                className="rounded-xl max-w-xs"
                value={performedAtLocal}
                onChange={(e) => setPerformedAtLocal(e.target.value)}
                disabled={patch.isPending}
              />
            </div>
            <Button
              type="button"
              size="sm"
              className="rounded-xl"
              disabled={
                patch.isPending ||
                !performedAtLocal ||
                performedAtLocal === toDatetimeLocalValue(session.performedAt ?? "")
              }
              onClick={() => {
                const d = new Date(performedAtLocal);
                if (Number.isNaN(d.getTime())) return;
                patch.mutate({ action: "updateMetadata", performedAt: d.toISOString() });
              }}
            >
              Save date
            </Button>
          </CardContent>
        </Card>
      )}

      {isHistorySession && (
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 space-y-3">
          <p className="text-muted-foreground text-sm">
            Delete removes this workout from history and charts. Your program&apos;s current week and next
            training day stay as they are.
          </p>
          <Button
            type="button"
            variant="destructive"
            className="h-12 w-full rounded-xl gap-2"
            onClick={() => setDeleteOpen(true)}
            disabled={del.isPending || patch.isPending}
          >
            <Trash2 className="size-4" />
            Delete workout
          </Button>
        </div>
      )}

      {canCancel && (
        <div className="flex flex-col gap-2">
          <Button
            type="button"
            variant="outline"
            className="h-12 w-full rounded-xl border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive"
            onClick={() => setCancelOpen(true)}
            disabled={patch.isPending}
          >
            Cancel session
          </Button>
          {!readinessNeeded && !warmupNeeded && (
            <Button
              className="h-12 w-full rounded-xl"
              onClick={async () => {
                try {
                  const res = (await patch.mutateAsync({ action: "complete" })) as {
                    summary?: SessionCompleteSummaryPayload;
                    weekSummary?: WeekCompletionSummaryPayload | null;
                  };
                  void qc.invalidateQueries({ queryKey: ["training-active"] });
                  void qc.invalidateQueries({ queryKey: ["training-history"] });
                  if (res.weekSummary) setWeekSplashQueued(res.weekSummary);
                  if (res.summary) setCompleteSplash(res.summary);
                  else router.push("/");
                } catch {
                  /* PATCH error surfaced via mutation state */
                }
              }}
              disabled={patch.isPending}
            >
              Complete session
            </Button>
          )}
          <Button
            type="button"
            variant="ghost"
            className="h-10 w-full rounded-xl text-muted-foreground text-sm hover:text-foreground"
            onClick={() => {
              patch.reset();
              setSkipDayOpen(true);
            }}
            disabled={patch.isPending}
          >
            <SkipForward className="size-4 mr-1.5 shrink-0" />
            Skip this day for the week
          </Button>
        </div>
      )}
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent className="rounded-2xl" showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>Delete this workout?</DialogTitle>
            <DialogDescription>
              This cannot be undone. Logged sets and readiness for this session will be removed. Your active
              program position does not change.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex-col gap-2 sm:flex-col">
            <Button
              variant="destructive"
              className="w-full rounded-xl"
              disabled={del.isPending}
              onClick={() => del.mutate()}
            >
              {del.isPending ? <Loader2 className="size-4 animate-spin" /> : "Yes, delete"}
            </Button>
            <Button variant="outline" className="w-full rounded-xl" type="button" onClick={() => setDeleteOpen(false)}>
              Cancel
            </Button>
          </DialogFooter>
          {del.isError && (
            <p className="text-destructive text-sm">{(del.error as Error).message}</p>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={cancelOpen} onOpenChange={setCancelOpen}>
        <DialogContent className="rounded-2xl" showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>Cancel this workout?</DialogTitle>
            <DialogDescription>
              Nothing will count as completed. You can start this day again from Train. Your week does not advance.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex-col gap-2 sm:flex-col">
            <Button
              variant="destructive"
              className="w-full rounded-xl"
              disabled={patch.isPending}
              onClick={() => {
                patch.mutate(
                  { action: "cancel" },
                  {
                    onSuccess: () => {
                      setCancelOpen(false);
                      qc.invalidateQueries({ queryKey: ["training-active"] });
                      qc.invalidateQueries({ queryKey: ["session", sessionId] });
                      window.location.href = "/";
                    },
                  },
                );
              }}
            >
              {patch.isPending ? <Loader2 className="size-4 animate-spin" /> : "Yes, cancel session"}
            </Button>
            <Button
              variant="outline"
              className="w-full rounded-xl"
              type="button"
              onClick={() => setCancelOpen(false)}
            >
              Keep going
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={skipDayOpen}
        onOpenChange={(open) => {
          setSkipDayOpen(open);
          if (!open) patch.reset();
        }}
      >
        <DialogContent className="rounded-2xl" showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>Skip this day for the week?</DialogTitle>
            <DialogDescription>
              Your in-progress session will be removed and this day will count as skipped (same as skipping from
              Train). You can unskip from the week list if you change your mind.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex-col gap-2 sm:flex-col">
            <Button
              variant="destructive"
              className="w-full rounded-xl"
              disabled={patch.isPending}
              onClick={() => {
                patch.mutate(
                  { action: "skipDay" },
                  {
                    onSuccess: () => {
                      setSkipDayOpen(false);
                      void qc.invalidateQueries({ queryKey: ["training-active"] });
                      void qc.invalidateQueries({ queryKey: ["session", sessionId] });
                      window.location.href = "/";
                    },
                  },
                );
              }}
            >
              {patch.isPending ? <Loader2 className="size-4 animate-spin" /> : "Yes, skip this day"}
            </Button>
            <Button
              variant="outline"
              className="w-full rounded-xl"
              type="button"
              onClick={() => setSkipDayOpen(false)}
            >
              Keep going
            </Button>
          </DialogFooter>
          {patch.isError && (
            <p className="text-destructive text-sm">{(patch.error as Error).message}</p>
          )}
        </DialogContent>
      </Dialog>

      <ExerciseLibrarySheet />
      <ExerciseNotesDialog
        open={exerciseNotesDialogTarget != null}
        onOpenChange={(o) => {
          if (!o) setExerciseNotesDialogTarget(null);
        }}
        programExerciseId={exerciseNotesDialogTarget?.programExerciseId ?? ""}
        notes={
          exerciseNotesDialogTarget
            ? (orderedExercises.find((e) => e.id === exerciseNotesDialogTarget.programExerciseId)
                ?.notes ?? exerciseNotesDialogTarget.notes)
            : null
        }
        savePending={patch.isPending}
        onSave={(programExerciseId, notes) => void commitExerciseNotes(programExerciseId, notes)}
      />
      <ExerciseSwapDialog
        open={swapTarget != null}
        onOpenChange={(o) => {
          if (!o) setSwapTarget(null);
        }}
        programExerciseId={swapTarget?.programExerciseId ?? ""}
        currentExerciseName={swapTarget?.name ?? ""}
        currentExerciseMuscleTags={swapTarget?.muscleTags}
        sessionId={sessionId}
        onSuccess={() => qc.invalidateQueries({ queryKey: ["session", sessionId] })}
      />
      <BodyweightScopeDialog
        open={bwDialog != null}
        onOpenChange={(o) => {
          if (!o) setBwDialog(null);
        }}
        programExerciseId={bwDialog?.programExerciseId ?? ""}
        exerciseName={bwDialog?.name ?? ""}
        sessionId={sessionId}
        targetBodyweight={bwDialog?.targetBodyweight ?? true}
        onSuccess={() => qc.invalidateQueries({ queryKey: ["session", sessionId] })}
      />
      <Dialog
        open={exerciseActionsTarget != null}
        onOpenChange={(o) => {
          if (!o) setExerciseActionsTarget(null);
        }}
      >
        <DialogContent className="rounded-2xl">
          <DialogHeader>
            <DialogTitle>{exerciseActionsTarget?.name}</DialogTitle>
            <DialogDescription>Choose an exercise action.</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Button
              type="button"
              variant="outline"
              className="w-full justify-start rounded-xl"
              onClick={() => {
                if (!exerciseActionsTarget) return;
                openLibrary(exerciseActionsTarget.slug);
                setExerciseActionsTarget(null);
              }}
            >
              <History className="size-4" />
              History
            </Button>
            <Button
              type="button"
              variant="outline"
              className="w-full justify-start rounded-xl"
              onClick={() => {
                if (!exerciseActionsTarget) return;
                const targetEx = orderedExercises.find((e) => e.id === exerciseActionsTarget.id);
                setExerciseNotesDialogTarget({
                  programExerciseId: exerciseActionsTarget.id,
                  notes: targetEx?.notes ?? null,
                });
                setExerciseActionsTarget(null);
              }}
            >
              <StickyNote className="size-4" />
              Notes
            </Button>
            {exerciseActionsTarget?.kind !== "CARDIO" && (
              <>
                <Button
                  type="button"
                  variant="outline"
                  className="w-full justify-start rounded-xl"
                  onClick={() => {
                    if (!exerciseActionsTarget) return;
                    setBwDialog({
                      programExerciseId: exerciseActionsTarget.id,
                      name: exerciseActionsTarget.name,
                      targetBodyweight: true,
                    });
                    setExerciseActionsTarget(null);
                  }}
                >
                  Use bodyweight
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="w-full justify-start rounded-xl"
                  onClick={() => {
                    if (!exerciseActionsTarget) return;
                    setBwDialog({
                      programExerciseId: exerciseActionsTarget.id,
                      name: exerciseActionsTarget.name,
                      targetBodyweight: false,
                    });
                    setExerciseActionsTarget(null);
                  }}
                >
                  Use external load
                </Button>
              </>
            )}
            <Button
              type="button"
              variant="outline"
              className="w-full justify-start rounded-xl"
              onClick={() => {
                if (!exerciseActionsTarget) return;
                setSwapTarget({
                  programExerciseId: exerciseActionsTarget.id,
                  name: exerciseActionsTarget.name,
                  muscleTags: exerciseActionsTarget.muscleTags,
                });
                setExerciseActionsTarget(null);
              }}
            >
              <Replace className="size-4" />
              Swap exercise
            </Button>
            {exerciseActionsTarget?.kind !== "CARDIO" && (
              <Button
                type="button"
                variant="outline"
                className="w-full justify-start rounded-xl"
                onClick={() => {
                  if (!exerciseActionsTarget) return;
                  const targetEx = orderedExercises.find((e) => e.id === exerciseActionsTarget.id);
                  const profile = q.data?.strengthProfileByExerciseId?.[targetEx?.exercise.id ?? ""];
                  setExerciseSettingsTarget({
                    id: exerciseActionsTarget.id,
                    exerciseId: targetEx?.exercise.id ?? "",
                    name: exerciseActionsTarget.name,
                    hasOneRm: profile != null,
                  });
                  setExerciseRestDraft(String(targetEx?.restSec ?? settings?.defaultRestSec ?? 180));
                  setExerciseOneRmDraft(profile ? String(profile.estimatedOneRm) : "");
                  setExerciseIncrementDraft(
                    String(unit === "KG" ? settings?.plateIncrementKg ?? 2.5 : settings?.plateIncrementLb ?? 2.5),
                  );
                  setExerciseActionsTarget(null);
                }}
              >
                Exercise settings
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>
      <Dialog
        open={exerciseSettingsTarget != null}
        onOpenChange={(o) => {
          if (!o) setExerciseSettingsTarget(null);
        }}
      >
        <DialogContent className="rounded-2xl">
          <DialogHeader>
            <DialogTitle>{exerciseSettingsTarget?.name}</DialogTitle>
            <DialogDescription>Update rest, 1RM, and increment while you train.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label className="text-xs">Rest (seconds)</Label>
              <Input
                type="text"
                inputMode="numeric"
                value={exerciseRestDraft}
                className="rounded-xl text-base"
                onChange={(e) => setExerciseRestDraft(e.target.value.replace(/\D/g, "").slice(0, 4))}
              />
            </div>
            {!exerciseSettingsTarget?.hasOneRm && (
              <div className="space-y-1">
                <Label className="text-xs">Set 1RM ({unit})</Label>
                <Input
                  type="text"
                  inputMode="decimal"
                  value={exerciseOneRmDraft}
                  className="rounded-xl text-base"
                  onChange={(e) => setExerciseOneRmDraft(e.target.value.replace(/[^0-9.]/g, "").slice(0, 6))}
                />
              </div>
            )}
            <div className="space-y-1">
              <Label className="text-xs">Increment ({unit})</Label>
              <div className="flex gap-2">
                {["2.5", "5", "10"].map((opt) => (
                  <Button
                    key={opt}
                    type="button"
                    size="sm"
                    variant={exerciseIncrementDraft === opt ? "default" : "outline"}
                    className="rounded-xl"
                    onClick={() => setExerciseIncrementDraft(opt)}
                  >
                    {opt}
                  </Button>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter className="flex-col gap-2 sm:flex-row">
            <Button type="button" variant="outline" className="rounded-xl" onClick={() => setExerciseSettingsTarget(null)}>
              Cancel
            </Button>
            <Button
              type="button"
              className="rounded-xl"
              disabled={patchProgramExercise.isPending || patchStrength.isPending || patchSettings.isPending}
              onClick={async () => {
                if (!exerciseSettingsTarget) return;
                const rest = Number(exerciseRestDraft);
                if (Number.isFinite(rest) && rest >= 15 && rest <= 3600) {
                  await patchProgramExercise.mutateAsync({
                    programExerciseId: exerciseSettingsTarget.id,
                    restSec: rest,
                  });
                }
                if (!exerciseSettingsTarget.hasOneRm) {
                  const oneRm = Number(exerciseOneRmDraft);
                  if (exerciseSettingsTarget.exerciseId && Number.isFinite(oneRm) && oneRm > 0) {
                    await patchStrength.mutateAsync({
                      exerciseId: exerciseSettingsTarget.exerciseId,
                      estimatedOneRm: oneRm,
                      weightUnit: unit,
                    });
                  }
                }
                const nextInc = Number(exerciseIncrementDraft);
                if (Number.isFinite(nextInc) && [2.5, 5, 10].includes(nextInc)) {
                  await patchSettings.mutateAsync(
                    unit === "KG" ? { plateIncrementKg: nextInc } : { plateIncrementLb: nextInc },
                  );
                }
                setExerciseSettingsTarget(null);
              }}
            >
              Save settings
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {completeSplash && (
        <SessionCompleteSplash
          open
          summary={completeSplash}
          sessionId={sessionId}
          onClose={() => {
            setCompleteSplash(null);
            void qc.invalidateQueries({ queryKey: ["session", sessionId] });
            if (weekSplashQueued) {
              setWeekSplash(weekSplashQueued);
              setWeekSplashQueued(null);
            } else {
              router.push("/");
            }
          }}
        />
      )}
      {weekSplash && sessionEarly?.programInstanceId != null && (
        <WeekCompleteSplash
          open
          summary={weekSplash}
          instanceId={sessionEarly.programInstanceId}
          onAfterAdvance={() => {
            setWeekSplash(null);
            router.push("/");
          }}
        />
      )}
    </div>
  );
}

function SetRowEditor({
  row,
  idx,
  unit,
  repTarget,
  targetRpe,
  ghost,
  prog,
  progressionStep,
  savePending,
  bodyweight,
  isCardio,
  onCommitSet,
}: {
  row: LoggedSetRow;
  idx: number;
  unit: "KG" | "LB";
  repTarget: number;
  targetRpe: number;
  ghost?: { weight: number; weightUnit: string; reps: number | null; rpe: number | null };
  prog: ReturnType<typeof suggestNextWeekLoad>;
  progressionStep: number;
  savePending: boolean;
  bodyweight: boolean;
  isCardio?: boolean;
  onCommitSet: (body: object) => void;
}) {
  const cardio = Boolean(isCardio);
  const [local, setLocal] = useState(() => {
    const rpeStep = snapToLoggedRpeStep(row.rpe ?? targetRpe);
    return {
      weight: String(row.weight || ""),
      reps: row.reps != null ? String(row.reps) : String(repTarget),
      rpe: String(rpeStep),
      durationSec: row.durationSec != null ? formatSecAsMmSs(row.durationSec) : "",
      calories: row.calories != null ? String(row.calories) : "",
    };
  });

  useEffect(() => {
    const rpeStep = snapToLoggedRpeStep(row.rpe ?? targetRpe);
    setLocal({
      weight: bodyweight ? "0" : String(row.weight || ""),
      reps: row.reps != null ? String(row.reps) : String(repTarget),
      rpe: String(rpeStep),
      durationSec: row.durationSec != null ? formatSecAsMmSs(row.durationSec) : "",
      calories: row.calories != null ? String(row.calories) : "",
    });
  }, [
    row.weight,
    row.reps,
    row.rpe,
    row.durationSec,
    row.calories,
    repTarget,
    targetRpe,
    bodyweight,
  ]);

  const baselineWeight = bodyweight ? "0" : String(row.weight || "");
  const baselineReps = row.reps != null ? String(row.reps) : String(repTarget);
  const baselineRpe = String(snapToLoggedRpeStep(row.rpe ?? targetRpe));
  const baselineDur = row.durationSec != null ? formatSecAsMmSs(row.durationSec) : "";
  const baselineCal = row.calories != null ? String(row.calories) : "";

  const dirty = cardio
    ? local.durationSec !== baselineDur || local.calories !== baselineCal
    : local.reps !== baselineReps ||
      local.rpe !== baselineRpe ||
      (!bodyweight && local.weight !== baselineWeight);

  const weightForCommit = bodyweight || cardio ? 0 : Number(local.weight) || 0;
  const shouldPropagateWeight = !cardio && !bodyweight && local.weight !== baselineWeight;
  const shouldPropagateRpeReps = !cardio && (local.reps !== baselineReps || local.rpe !== baselineRpe);
  const adjustWeightByStep = (dir: -1 | 1) => {
    if (cardio || bodyweight) return;
    const step = progressionStep > 0 ? progressionStep : 2.5;
    const current = Number(local.weight);
    const base = Number.isFinite(current) ? current : Number(row.weight) || 0;
    const next = Math.max(0, Math.min(999.9, base + dir * step));
    const rounded = Math.round(next * 10) / 10;
    const display = Number.isInteger(rounded) ? String(rounded.toFixed(0)) : String(rounded.toFixed(1));
    setLocal((l) => ({ ...l, weight: display }));
  };

  const saveFields = () => {
    if (cardio) {
      const parsedDur = parseDurationInputToSec(local.durationSec);
      onCommitSet({
        action: "set",
        setId: row.id,
        weight: 0,
        weightUnit: unit,
        reps: null,
        rpe: null,
        durationSec: parsedDur == null ? null : parsedDur,
        calories: local.calories === "" ? null : Math.max(0, Math.floor(Number(local.calories) || 0)),
      });
      return;
    }
    onCommitSet({
      action: "set",
      setId: row.id,
      weight: weightForCommit,
      weightUnit: unit,
      reps: local.reps === "" ? null : Number(local.reps),
      rpe: local.rpe === "" ? null : Number(local.rpe),
      propagateWeight: shouldPropagateWeight,
      propagateRpeReps: shouldPropagateRpeReps,
    });
  };

  return (
    <div
      className={cn(
        "rounded-xl border p-4 space-y-3",
        row.done ? "border-emerald-500/40 bg-emerald-500/5" : "bg-card/50",
      )}
    >
      <div className="space-y-1.5">
        <div className="flex min-w-0 items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2">
            <span className="text-sm font-medium shrink-0">
              {cardio ? `Bout ${idx + 1}` : `Set ${idx + 1}`}
            </span>
            {row.done && (
              <Badge variant="secondary" className="text-[11px] shrink-0">
                Completed
              </Badge>
            )}
          </div>
          <div className="flex shrink-0 items-center justify-end gap-1">
            {row.done && (
              <Button
                type="button"
                size="sm"
                variant="secondary"
                className="rounded-lg h-9"
                disabled={!dirty || savePending}
                onClick={() => saveFields()}
              >
                Save
              </Button>
            )}
            {!row.done && (
              <Toggle
                pressed={row.done}
                onPressedChange={(nextDone) => {
                  if (nextDone) {
                    if (cardio) {
                      const d = parseDurationInputToSec(local.durationSec);
                      if (d == null || d <= 0) return;
                      onCommitSet({
                        action: "set",
                        setId: row.id,
                        weight: 0,
                        weightUnit: unit,
                        reps: null,
                        rpe: null,
                        durationSec: d,
                        calories:
                          local.calories === "" ? null : Math.max(0, Math.floor(Number(local.calories) || 0)),
                        done: true,
                      });
                    } else {
                      onCommitSet({
                        action: "set",
                        setId: row.id,
                        weight: weightForCommit,
                        weightUnit: unit,
                        reps: local.reps === "" ? null : Number(local.reps),
                        rpe: local.rpe === "" ? null : Number(local.rpe),
                        propagateWeight: true,
                        propagateRpeReps: true,
                        done: true,
                      });
                    }
                  }
                }}
                className="data-[state=on]:bg-primary data-[state=on]:text-primary-foreground"
              >
                <Check className="size-4" />
                Done
              </Toggle>
            )}
          </div>
        </div>
        {ghost && !cardio && (
          <p
            className="text-muted-foreground min-w-0 max-w-full text-xs"
            title={`Last time: ${ghost.weight}${ghost.weightUnit} × ${ghost.reps ?? "—"}${
              ghost.rpe != null ? ` @ ${ghost.rpe} RPE` : ""
            }`}
          >
            <span className="text-muted-foreground">Last time:</span>{" "}
            <span className="font-medium text-foreground">
              {ghost.weight}
              {ghost.weightUnit} × {ghost.reps}
              {ghost.rpe != null ? ` @ ${ghost.rpe} RPE` : ""}
            </span>
          </p>
        )}
      </div>
      {dirty && (
        <p className="text-xs text-amber-600 dark:text-amber-500">Unsaved changes — Save or use Done to log the set.</p>
      )}
      {cardio ? (
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label className="text-xs">Duration (m:ss or sec)</Label>
            <Input
              type="text"
              inputMode="numeric"
              className="rounded-lg font-mono tabular-nums"
              placeholder="5:00"
              value={local.durationSec}
              onChange={(e) => setLocal((l) => ({ ...l, durationSec: e.target.value }))}
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Calories (optional)</Label>
            <Input
              type="text"
              inputMode="numeric"
              className="rounded-lg"
              value={local.calories}
              onChange={(e) => setLocal((l) => ({ ...l, calories: e.target.value }))}
            />
          </div>
        </div>
      ) : (
        <div
          className={
            bodyweight
              ? "grid grid-cols-2 gap-3"
              : "grid gap-2 sm:gap-3 max-[430px]:grid-cols-2 min-[431px]:grid-cols-[minmax(0,7.75rem)_minmax(0,3.25rem)_minmax(0,1fr)]"
          }
        >
          {!bodyweight && (
            <div className="min-w-0 space-y-1 max-[430px]:col-span-2">
              <Label className="text-xs">Weight ({unit})</Label>
              <div className="flex max-w-[11rem] items-center gap-0.5 sm:max-w-none">
                <Button
                  type="button"
                  variant="outline"
                  className="h-7 w-7 shrink-0 rounded-md p-0 touch-manipulation"
                  onClick={() => adjustWeightByStep(-1)}
                  disabled={savePending}
                  aria-label="Decrease weight"
                >
                  <Minus className="size-3" aria-hidden />
                </Button>
                <Input
                  type="text"
                  inputMode="decimal"
                  className="min-w-0 flex-1 rounded-lg px-1.5 text-center font-mono tabular-nums text-sm sm:max-w-[4.25rem] sm:flex-none sm:px-2 sm:text-base"
                  maxLength={5}
                  value={local.weight}
                  placeholder={ghost ? `${ghost.weight}` : "0"}
                  onChange={(e) => {
                    const raw = e.target.value.replace(/[^0-9.]/g, "");
                    const parts = raw.split(".");
                    let next: string;
                    if (parts.length === 1) {
                      next = (parts[0] ?? "").slice(0, 3);
                    } else {
                      const w = (parts[0] ?? "").slice(0, 3);
                      const d = (parts[1] ?? "").replace(/\D/g, "").slice(0, 1);
                      const endsWithBareDot = raw.endsWith(".") && parts.length === 2 && parts[1] === "";
                      next = endsWithBareDot ? `${w}.` : d ? `${w}.${d}` : w;
                    }
                    setLocal((l) => ({ ...l, weight: next }));
                  }}
                />
                <Button
                  type="button"
                  variant="outline"
                  className="h-7 w-7 shrink-0 rounded-md p-0 touch-manipulation"
                  onClick={() => adjustWeightByStep(1)}
                  disabled={savePending}
                  aria-label="Increase weight"
                >
                  <Plus className="size-3" aria-hidden />
                </Button>
              </div>
            </div>
          )}
          {bodyweight && (
            <div className="space-y-1 col-span-2">
              <Label className="text-xs">Load</Label>
              <p className="text-sm font-medium rounded-lg border bg-muted/40 px-3 py-2">Bodyweight</p>
            </div>
          )}
          <div className="min-w-0 space-y-1 max-[430px]:col-span-2">
            <Label className="text-xs">Reps</Label>
            <Input
              type="text"
              inputMode="numeric"
              className="rounded-lg w-full max-w-[3.85rem] px-2 text-center font-mono tabular-nums text-base"
              maxLength={4}
              value={local.reps}
              onChange={(e) => {
                const v = e.target.value.replace(/\D/g, "").slice(0, 4);
                setLocal((l) => ({ ...l, reps: v }));
              }}
            />
          </div>
          <div className="min-w-0 space-y-1 max-[430px]:col-span-2">
            <Label className="text-xs">RPE</Label>
            <div className="rounded-lg border bg-background px-2 py-2 space-y-1 min-w-0 sm:max-w-[13.5rem]">
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">6.0</span>
                <span className="font-medium">{local.rpe || baselineRpe}</span>
                <span className="text-muted-foreground">10.0</span>
              </div>
              <Slider
                value={[Number(local.rpe || baselineRpe)]}
                min={6}
                max={10}
                step={0.5}
                onValueChange={(v) =>
                  setLocal((l) => ({
                    ...l,
                    rpe: String((Array.isArray(v) ? (v[0] ?? Number(baselineRpe)) : v).toFixed(1)).replace(
                      /\.0$/,
                      "",
                    ),
                  }))
                }
              />
            </div>
          </div>
        </div>
      )}
      {!cardio && !bodyweight && prog.bumped && row.done && (
        <p className="text-xs text-muted-foreground">
          Next week idea: ~{prog.suggested.toFixed(1)} {unit} (+{(prog.bumpPct * 100).toFixed(1)}%), nearest{" "}
          {progressionStep % 1 === 0 ? progressionStep.toFixed(0) : progressionStep.toFixed(1)} {unit} step
        </p>
      )}
    </div>
  );
}

function ExerciseNotesDialog({
  open,
  onOpenChange,
  programExerciseId,
  notes,
  savePending,
  onSave,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  programExerciseId: string;
  notes: string | null;
  savePending: boolean;
  onSave: (programExerciseId: string, notes: string | null) => void;
}) {
  const [draft, setDraft] = useState(notes ?? "");

  useEffect(() => {
    setDraft(notes ?? "");
  }, [notes, open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="rounded-2xl sm:max-w-md" showCloseButton>
        <DialogHeader>
          <DialogTitle>Exercise notes</DialogTitle>
          <DialogDescription>Optional note for this exercise in your workout.</DialogDescription>
        </DialogHeader>
        <textarea
          id={`exercise-notes-${programExerciseId}`}
          className={cn(
            "min-h-[108px] w-full resize-y rounded-lg border border-input bg-transparent px-2.5 py-2 text-sm outline-none",
            "placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50",
            "dark:bg-input/30 disabled:opacity-50",
          )}
          maxLength={500}
          value={draft}
          onChange={(e) => setDraft(e.target.value.slice(0, 500))}
          placeholder="e.g. use straps for top set, keep bar path vertical..."
        />
        <DialogFooter className="flex-col gap-2 sm:flex-row sm:justify-end">
          <Button type="button" variant="outline" className="rounded-xl" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            type="button"
            className="rounded-xl"
            disabled={savePending}
            onClick={() => {
              const trimmed = draft.trim();
              onSave(programExerciseId, trimmed === "" ? null : trimmed.slice(0, 500));
              onOpenChange(false);
            }}
          >
            Save note
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function WarmupCard({ content, onContinue }: { content: WarmupContent; onContinue: () => void }) {
  return (
    <Card className="rounded-2xl border-primary/30">
      <CardHeader>
        <CardTitle className="text-lg">{content.title}</CardTitle>
        <p className="text-muted-foreground text-sm">{content.subtitle}</p>
      </CardHeader>
      <CardContent className="space-y-6">
        {content.sections.map((sec) => (
          <div key={sec.heading} className="space-y-2">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h3 className="text-sm font-semibold">{sec.heading}</h3>
              <span className="text-xs text-muted-foreground">{sec.minutesHint}</span>
            </div>
            <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
              {sec.bullets.map((b) => (
                <li key={b}>{b}</li>
              ))}
            </ul>
          </div>
        ))}
        <div className="space-y-2 rounded-xl border border-muted-foreground/20 bg-muted/30 p-3">
          <h3 className="text-sm font-semibold">Then at the bar</h3>
          <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
            {content.atTheBar.map((line, i) => (
              <li key={`${i}-${line.slice(0, 24)}`}>{line}</li>
            ))}
          </ul>
        </div>
        <Button type="button" className="w-full rounded-xl" onClick={onContinue}>
          Start workout
        </Button>
      </CardContent>
    </Card>
  );
}

function ReadinessCard({
  onSubmit,
  loading,
}: {
  onSubmit: (sleep: number, stress: number, soreness: number) => void;
  loading: boolean;
}) {
  const [sleep, setSleep] = useState(7);
  const [stress, setStress] = useState(3);
  const [soreness, setSoreness] = useState(3);

  return (
    <Card className="rounded-2xl border-primary/30">
      <CardHeader>
        <CardTitle className="text-lg">Readiness</CardTitle>
        <p className="text-muted-foreground text-sm">
          Sleep quality (higher is better), stress and soreness (lower is usually better).
        </p>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span>Sleep</span>
            <span>{sleep}</span>
          </div>
          <Slider
            value={[sleep]}
            min={0}
            max={10}
            step={1}
            onValueChange={(v) => setSleep(Array.isArray(v) ? (v[0] ?? 0) : v)}
          />
        </div>
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span>Stress</span>
            <span>{stress}</span>
          </div>
          <Slider
            value={[stress]}
            min={0}
            max={10}
            step={1}
            onValueChange={(v) => setStress(Array.isArray(v) ? (v[0] ?? 0) : v)}
          />
        </div>
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span>Soreness</span>
            <span>{soreness}</span>
          </div>
          <Slider
            value={[soreness]}
            min={0}
            max={10}
            step={1}
            onValueChange={(v) => setSoreness(Array.isArray(v) ? (v[0] ?? 0) : v)}
          />
        </div>
        <Button className="w-full rounded-xl" disabled={loading} onClick={() => onSubmit(sleep, stress, soreness)}>
          {loading ? <Loader2 className="animate-spin" /> : "Apply to session"}
        </Button>
      </CardContent>
    </Card>
  );
}
