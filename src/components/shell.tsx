"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Dumbbell, LogOut, Settings, Trophy } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const baseLinks = [
  { href: "/", label: "Train", icon: Dumbbell },
  { href: "/board", label: "Board", icon: Trophy },
  { href: "/settings", label: "Settings", icon: Settings },
] as const;

type MePayload = {
  user: { email: string; name: string | null; isSuperAdmin?: boolean } | null;
};

export function Shell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const qc = useQueryClient();
  const isAuthPage = pathname === "/login" || pathname === "/register";

  const { data: me } = useQuery({
    queryKey: ["auth", "me"],
    queryFn: async (): Promise<MePayload> => {
      const r = await fetch("/api/auth/me");
      const json = (await r.json()) as MePayload;
      if (!r.ok || !json.user) return { user: null };
      return json;
    },
    staleTime: 60_000,
    enabled: !isAuthPage,
  });

  const navLinks = [...baseLinks];

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    await qc.invalidateQueries({ queryKey: ["auth", "me"] });
    router.push("/login");
    router.refresh();
  }

  const trainTabActive = pathname === "/" || pathname.startsWith("/workout/");
  const boardTabActive = pathname === "/board";
  const settingsTabActive = pathname === "/settings";

  return (
    <div className="min-h-svh flex flex-col">
      <header className="sticky top-0 z-40 border-b bg-card/80 backdrop-blur-md pt-[env(safe-area-inset-top)]">
        <div className="mx-auto flex min-h-12 max-w-5xl items-center gap-2 px-[max(1rem,env(safe-area-inset-left))] py-2 pr-[max(1rem,env(safe-area-inset-right))] sm:min-h-14 sm:gap-3">
          <Link
            href={isAuthPage ? "/login" : "/"}
            className="flex min-w-0 shrink-0 items-center gap-2 font-heading text-base font-semibold tracking-tight sm:text-lg"
          >
            <span className="flex size-9 min-h-9 min-w-9 items-center justify-center rounded-xl bg-primary text-primary-foreground">
              <Dumbbell className="size-5" aria-hidden />
            </span>
            <span className="truncate max-sm:max-w-[9.5rem]">Powerbuild</span>
          </Link>
          {isAuthPage ? (
            <div className="ml-auto flex items-center gap-2">
              {pathname === "/login" ? (
                <Link
                  href="/register"
                  className={cn(buttonVariants({ variant: "outline", size: "sm" }), "rounded-xl")}
                >
                  Register
                </Link>
              ) : (
                <Link
                  href="/login"
                  className={cn(buttonVariants({ variant: "outline", size: "sm" }), "rounded-xl")}
                >
                  Sign in
                </Link>
              )}
            </div>
          ) : (
            <>
              <nav
                className="hidden flex-1 items-center justify-end gap-0.5 overflow-x-auto text-sm sm:flex sm:pr-2"
                aria-label="Main navigation"
              >
                {navLinks.map((l) => (
                  <Link
                    key={l.href}
                    href={l.href}
                    className={cn(
                      "min-h-11 shrink-0 whitespace-nowrap rounded-lg px-3 py-2.5 text-muted-foreground hover:bg-muted hover:text-foreground active:bg-muted/80",
                      pathname === l.href && "bg-muted text-foreground",
                    )}
                  >
                    {l.label}
                  </Link>
                ))}
              </nav>
              <div className="ml-auto flex shrink-0 items-center gap-2 sm:ml-0">
                <span
                  className="hidden max-w-[9rem] truncate text-xs text-muted-foreground lg:inline"
                  title={me?.user?.email}
                >
                  {me?.user?.name ?? me?.user?.email}
                </span>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="rounded-xl shrink-0 max-sm:aspect-square max-sm:p-0 max-sm:size-9"
                  onClick={logout}
                  aria-label="Log out"
                >
                  <LogOut className="size-4 sm:hidden" aria-hidden />
                  <span className="hidden sm:inline">Log out</span>
                </Button>
              </div>
            </>
          )}
        </div>
      </header>
      <main
        className={cn(
          "mx-auto w-full max-w-5xl flex-1 px-[max(1rem,env(safe-area-inset-left))] pr-[max(1rem,env(safe-area-inset-right))] pt-5 sm:pt-6",
          "pb-[max(1.25rem,env(safe-area-inset-bottom))] max-sm:pb-[max(calc(5rem+env(safe-area-inset-bottom)),1.25rem)] sm:pb-[max(1.5rem,env(safe-area-inset-bottom))]",
          "text-pretty",
        )}
      >
        {children}
      </main>
      {!isAuthPage && (
        <nav
          className="fixed bottom-0 left-0 right-0 z-40 flex border-t border-border/80 bg-card/95 backdrop-blur-md pb-[env(safe-area-inset-bottom)] pt-1 sm:hidden"
          aria-label="Primary"
        >
          {navLinks.map((l) => {
            const Icon = l.icon;
            const active =
              l.href === "/"
                ? trainTabActive
                : l.href === "/board"
                  ? boardTabActive
                  : settingsTabActive;
            return (
              <Link
                key={l.href}
                href={l.href}
                className={cn(
                  "flex min-h-12 flex-1 flex-col items-center justify-center gap-0.5 px-2 py-1.5 text-[11px] font-medium text-muted-foreground transition-colors",
                  active && "text-foreground",
                )}
              >
                <span
                  className={cn(
                    "flex size-9 items-center justify-center rounded-xl transition-colors",
                    active ? "bg-muted text-foreground" : "text-muted-foreground",
                  )}
                >
                  <Icon className="size-[1.125rem]" aria-hidden />
                </span>
                {l.label}
              </Link>
            );
          })}
        </nav>
      )}
    </div>
  );
}
