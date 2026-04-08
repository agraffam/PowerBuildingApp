"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { Loader2, Shield } from "lucide-react";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
import { PASSWORD_MIN_LENGTH } from "@/lib/auth/password-policy";
import { cn } from "@/lib/utils";

type AdminUserRow = {
  id: string;
  email: string;
  name: string | null;
  createdAt: string;
  updatedAt: string;
  sessionsCompleted: number;
  lastLoggedSessionAt: string | null;
  _count: { programInstances: number; strengthProfiles: number };
};

type MeRes = {
  user: { id: string; email: string; name: string | null; isSuperAdmin?: boolean } | null;
};

export default function AdminPage() {
  const qc = useQueryClient();
  const [deleteTarget, setDeleteTarget] = useState<AdminUserRow | null>(null);
  const [resetTarget, setResetTarget] = useState<AdminUserRow | null>(null);
  const [resetPw, setResetPw] = useState("");
  const [banner, setBanner] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  const { data: me, isLoading: meLoading } = useQuery({
    queryKey: ["auth", "me"],
    queryFn: async (): Promise<MeRes> => {
      const r = await fetch("/api/auth/me");
      const json = (await r.json()) as MeRes;
      if (!r.ok || !json.user) return { user: null };
      return json;
    },
    staleTime: 60_000,
  });

  const allowed = Boolean(me?.user?.isSuperAdmin);

  const usersQuery = useQuery({
    queryKey: ["admin", "users"],
    queryFn: async () => {
      const r = await fetch("/api/admin/users");
      const j = (await r.json()) as { users?: AdminUserRow[]; error?: string };
      if (!r.ok) throw new Error(j.error ?? "Failed to load users");
      return j.users ?? [];
    },
    enabled: allowed,
  });

  const deleteUser = useMutation({
    mutationFn: async (id: string) => {
      const r = await fetch(`/api/admin/users/${id}`, { method: "DELETE" });
      const j = (await r.json().catch(() => ({}))) as { error?: string };
      if (!r.ok) throw new Error(j.error ?? "Delete failed");
    },
    onSuccess: async () => {
      setBanner({ type: "ok", text: "User deleted." });
      setDeleteTarget(null);
      await qc.invalidateQueries({ queryKey: ["admin", "users"] });
    },
    onError: (e: Error) => {
      setBanner({ type: "err", text: e.message });
    },
  });

  const resetPassword = useMutation({
    mutationFn: async ({ id, newPassword }: { id: string; newPassword: string }) => {
      const r = await fetch(`/api/admin/users/${id}/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ newPassword }),
      });
      const j = (await r.json().catch(() => ({}))) as { error?: string };
      if (!r.ok) throw new Error(j.error ?? "Reset failed");
    },
    onSuccess: async () => {
      setBanner({ type: "ok", text: "Password updated. Share the new password with the user securely." });
      setResetTarget(null);
      setResetPw("");
    },
    onError: (e: Error) => {
      setBanner({ type: "err", text: e.message });
    },
  });

  const totals = useMemo(() => {
    const list = usersQuery.data ?? [];
    return {
      users: list.length,
      instances: list.reduce((a, u) => a + u._count.programInstances, 0),
      sessions: list.reduce((a, u) => a + u.sessionsCompleted, 0),
    };
  }, [usersQuery.data]);

  if (meLoading || !me?.user) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="size-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!allowed) {
    return (
      <div className="mx-auto max-w-lg space-y-4">
        <h1 className="text-2xl font-bold tracking-tight font-heading">Admin</h1>
        <p className="text-muted-foreground text-sm">You do not have access to this area.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight font-heading">
            <Shield className="size-7 text-primary" aria-hidden />
            Admin
          </h1>
          <p className="text-muted-foreground text-sm">
            User accounts, password resets, and removals. Only visible to the app owner.
          </p>
          <Link href="/settings" className="text-xs text-primary underline-offset-4 hover:underline mt-1 inline-block">
            ← Back to Settings
          </Link>
        </div>
      </div>

      {banner && (
        <p
          className={cn(
            "text-sm",
            banner.type === "ok" ? "text-emerald-600 dark:text-emerald-400" : "text-destructive",
          )}
        >
          {banner.text}
        </p>
      )}

      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="rounded-2xl shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Accounts</CardTitle>
            <CardDescription>Registered users</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="font-heading text-2xl font-semibold tabular-nums">{totals.users}</p>
          </CardContent>
        </Card>
        <Card className="rounded-2xl shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Program runs</CardTitle>
            <CardDescription>Total program instances (all users)</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="font-heading text-2xl font-semibold tabular-nums">{totals.instances}</p>
          </CardContent>
        </Card>
        <Card className="rounded-2xl shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Sessions completed</CardTitle>
            <CardDescription>Total completed workouts (all users)</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="font-heading text-2xl font-semibold tabular-nums">{totals.sessions}</p>
          </CardContent>
        </Card>
      </div>

      <Card className="rounded-2xl shadow-sm">
        <CardHeader>
          <CardTitle className="text-lg">Users</CardTitle>
          <CardDescription>Delete removes the account and all associated training data (cascade).</CardDescription>
        </CardHeader>
        <CardContent className="p-0 sm:p-0">
          {usersQuery.isLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="size-8 animate-spin text-muted-foreground" />
            </div>
          ) : usersQuery.isError ? (
            <p className="text-destructive px-6 pb-6 text-sm">
              {(usersQuery.error as Error).message}
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-sm">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="px-6 py-3 font-medium">Email</th>
                    <th className="px-3 py-3 font-medium">Name</th>
                    <th className="px-3 py-3 font-medium">Programs</th>
                    <th className="px-3 py-3 font-medium">Sessions</th>
                    <th className="px-3 py-3 font-medium">Last logged</th>
                    <th className="px-3 py-3 font-medium">1RM rows</th>
                    <th className="px-3 py-3 font-medium">Joined</th>
                    <th className="px-6 py-3 font-medium text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {(usersQuery.data ?? []).map((u) => {
                    const isSelf = u.id === me.user!.id;
                    return (
                      <tr key={u.id} className="border-b border-border/60 last:border-0">
                        <td className="px-6 py-3">
                          <span className="font-medium text-foreground">{u.email}</span>
                          {isSelf && (
                            <span className="ml-2 text-xs text-muted-foreground">(you)</span>
                          )}
                        </td>
                        <td className="max-w-[10rem] truncate px-3 py-3 text-muted-foreground">
                          {u.name ?? "—"}
                        </td>
                        <td className="px-3 py-3 tabular-nums">{u._count.programInstances}</td>
                        <td className="px-3 py-3 tabular-nums">{u.sessionsCompleted}</td>
                        <td className="whitespace-nowrap px-3 py-3 text-muted-foreground">
                          {u.lastLoggedSessionAt ? new Date(u.lastLoggedSessionAt).toLocaleDateString() : "—"}
                        </td>
                        <td className="px-3 py-3 tabular-nums">{u._count.strengthProfiles}</td>
                        <td className="whitespace-nowrap px-3 py-3 text-muted-foreground">
                          {new Date(u.createdAt).toLocaleDateString()}
                        </td>
                        <td className="px-6 py-3 text-right">
                          <div className="flex justify-end gap-2">
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="rounded-xl"
                              onClick={() => {
                                setBanner(null);
                                setResetTarget(u);
                                setResetPw("");
                              }}
                            >
                              Reset password
                            </Button>
                            <Button
                              type="button"
                              variant="destructive"
                              size="sm"
                              className="rounded-xl"
                              disabled={isSelf}
                              title={isSelf ? "You cannot delete your own account" : undefined}
                              onClick={() => {
                                setBanner(null);
                                setDeleteTarget(u);
                              }}
                            >
                              Delete
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={Boolean(deleteTarget)} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <DialogContent className="sm:max-w-md" showCloseButton>
          <DialogHeader>
            <DialogTitle>Delete user</DialogTitle>
            <DialogDescription>
              This permanently removes{" "}
              <span className="font-medium text-foreground">{deleteTarget?.email}</span> and all
              workouts, programs, and settings linked to them. This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter showCloseButton={false} className="border-0 bg-transparent p-0 pt-2 sm:justify-end">
            <Button type="button" variant="outline" className="rounded-xl" onClick={() => setDeleteTarget(null)}>
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              className="rounded-xl"
              disabled={!deleteTarget || deleteUser.isPending}
              onClick={() => {
                if (deleteTarget) void deleteUser.mutate(deleteTarget.id);
              }}
            >
              {deleteUser.isPending ? <Loader2 className="size-4 animate-spin" /> : "Delete user"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(resetTarget)}
        onOpenChange={(o) => {
          if (!o) {
            setResetTarget(null);
            setResetPw("");
          }
        }}
      >
        <DialogContent className="sm:max-w-md" showCloseButton>
          <DialogHeader>
            <DialogTitle>Reset password</DialogTitle>
            <DialogDescription>
              Set a new password for{" "}
              <span className="font-medium text-foreground">{resetTarget?.email}</span>. Minimum{" "}
              {PASSWORD_MIN_LENGTH} characters.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-1">
            <Label htmlFor="admin-new-pw">New password</Label>
            <Input
              id="admin-new-pw"
              type="password"
              autoComplete="new-password"
              minLength={PASSWORD_MIN_LENGTH}
              value={resetPw}
              onChange={(e) => setResetPw(e.target.value)}
              className="rounded-xl"
            />
          </div>
          <DialogFooter showCloseButton={false} className="border-0 bg-transparent p-0 pt-2 sm:justify-end">
            <Button
              type="button"
              variant="outline"
              className="rounded-xl"
              onClick={() => {
                setResetTarget(null);
                setResetPw("");
              }}
            >
              Cancel
            </Button>
            <Button
              type="button"
              className="rounded-xl"
              disabled={!resetTarget || resetPassword.isPending || resetPw.length < PASSWORD_MIN_LENGTH}
              onClick={() => {
                if (resetTarget) void resetPassword.mutate({ id: resetTarget.id, newPassword: resetPw });
              }}
            >
              {resetPassword.isPending ? <Loader2 className="size-4 animate-spin" /> : "Save password"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
