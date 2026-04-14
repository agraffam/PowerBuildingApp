"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { Dumbbell, Settings } from "lucide-react";
import { cn } from "@/lib/utils";

const navLinks = [
  { href: "/", label: "Train", icon: Dumbbell },
  { href: "/settings", label: "Settings", icon: Settings },
] as const;

type MePayload = {
  user: { email: string; name: string | null; isSuperAdmin?: boolean } | null;
};

export function Shell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
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

  const trainActive = pathname === "/" || pathname.startsWith("/workout/");
  const settingsActive = pathname === "/settings" || pathname.startsWith("/settings/");

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
                  className="rounded-xl border border-input bg-background px-3 py-2 text-sm font-medium hover:bg-muted"
                >
                  Register
                </Link>
              ) : (
                <Link
                  href="/login"
                  className="rounded-xl border border-input bg-background px-3 py-2 text-sm font-medium hover:bg-muted"
                >
                  Sign in
                </Link>
              )}
            </div>
          ) : (
            <>
              <nav
                className="flex min-w-0 flex-1 items-center justify-end gap-0.5 overflow-x-auto text-sm sm:pr-2"
                aria-label="Main navigation"
              >
                {navLinks.map((l) => {
                  const Icon = l.icon;
                  const active =
                    l.href === "/" ? trainActive : l.href === "/settings" ? settingsActive : false;
                  return (
                    <Link
                      key={l.href}
                      href={l.href}
                      className={cn(
                        "flex min-h-10 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg px-2.5 py-2 text-muted-foreground hover:bg-muted hover:text-foreground active:bg-muted/80 sm:min-h-11 sm:px-3 sm:py-2.5",
                        active && "bg-muted text-foreground",
                      )}
                    >
                      <Icon className="size-4 shrink-0 opacity-80" aria-hidden />
                      <span>{l.label}</span>
                    </Link>
                  );
                })}
              </nav>
              <span
                className="hidden max-w-[10rem] truncate text-xs text-muted-foreground lg:inline"
                title={me?.user?.email}
              >
                {me?.user?.name ?? me?.user?.email}
              </span>
            </>
          )}
        </div>
      </header>
      <main
        className={cn(
          "mx-auto w-full max-w-5xl flex-1 px-[max(1rem,env(safe-area-inset-left))] pr-[max(1rem,env(safe-area-inset-right))] pt-5 sm:pt-6",
          "pb-[max(1.25rem,env(safe-area-inset-bottom))] sm:pb-[max(1.5rem,env(safe-area-inset-bottom))]",
          "text-pretty",
        )}
      >
        {children}
      </main>
    </div>
  );
}
