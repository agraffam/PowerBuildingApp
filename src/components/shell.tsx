"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Dumbbell } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const links = [
  { href: "/", label: "Train" },
  { href: "/history", label: "History" },
  { href: "/programs", label: "Programs" },
  { href: "/exercises", label: "Exercises" },
  { href: "/strength", label: "1RM" },
  { href: "/analytics", label: "Analytics" },
  { href: "/settings", label: "Settings" },
  { href: "/help", label: "Help" },
];

type MePayload = { user: { email: string; name: string | null } | null };

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

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    await qc.invalidateQueries({ queryKey: ["auth", "me"] });
    router.push("/login");
    router.refresh();
  }

  return (
    <div className="min-h-svh flex flex-col">
      <header className="sticky top-0 z-40 border-b bg-card/80 backdrop-blur-md pt-[env(safe-area-inset-top)]">
        <div className="mx-auto flex min-h-14 max-w-5xl items-center gap-3 px-[max(1rem,env(safe-area-inset-left))] py-2 pr-[max(1rem,env(safe-area-inset-right))]">
          <Link
            href={isAuthPage ? "/login" : "/"}
            className="flex shrink-0 items-center gap-2 font-heading text-lg font-semibold tracking-tight"
          >
            <span className="flex size-9 min-h-9 min-w-9 items-center justify-center rounded-xl bg-primary text-primary-foreground">
              <Dumbbell className="size-5" aria-hidden />
            </span>
            <span>Powerbuild</span>
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
                className="flex flex-1 items-center gap-0.5 overflow-x-auto text-sm [-ms-overflow-style:none] [scrollbar-width:none] sm:justify-end sm:pr-2 [&::-webkit-scrollbar]:hidden"
                aria-label="Main navigation"
              >
                {links.map((l) => (
                  <Link
                    key={l.href}
                    href={l.href}
                    className="min-h-11 shrink-0 whitespace-nowrap rounded-lg px-3 py-2.5 text-muted-foreground hover:bg-muted hover:text-foreground active:bg-muted/80"
                  >
                    {l.label}
                  </Link>
                ))}
              </nav>
              <div className="ml-auto flex shrink-0 items-center gap-2 sm:ml-0">
                <span
                  className="hidden max-w-[9rem] truncate text-xs text-muted-foreground sm:inline"
                  title={me?.user?.email}
                >
                  {me?.user?.name ?? me?.user?.email}
                </span>
                <Button type="button" variant="outline" size="sm" className="rounded-xl shrink-0" onClick={logout}>
                  Log out
                </Button>
              </div>
            </>
          )}
        </div>
      </header>
      <main className="mx-auto w-full max-w-5xl flex-1 px-[max(1rem,env(safe-area-inset-left))] pb-[max(1.5rem,env(safe-area-inset-bottom))] pr-[max(1rem,env(safe-area-inset-right))] pt-6">
        {children}
      </main>
    </div>
  );
}
