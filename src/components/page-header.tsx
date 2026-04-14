import type { ReactNode } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";

export type PageHeaderBackLink = {
  href: string;
  label: string;
};

type Props = {
  title: ReactNode;
  description?: ReactNode;
  /** Right side of title row (e.g. version). */
  meta?: ReactNode;
  backLink?: PageHeaderBackLink;
  /** Shown before the title (e.g. icon). */
  leading?: ReactNode;
  className?: string;
  /** Rendered after the back link (extra intro copy, links, etc.). */
  children?: ReactNode;
};

/**
 * Consistent page title block for authenticated screens (mobile-first).
 */
export function PageHeader({
  title,
  description,
  meta,
  backLink,
  leading,
  className,
  children,
}: Props) {
  return (
    <header className={cn("space-y-1", className)}>
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          {leading ? <div className="shrink-0">{leading}</div> : null}
          <h1 className="min-w-0 text-2xl font-bold font-heading tracking-tight leading-snug">{title}</h1>
        </div>
        {meta != null ? (
          <div className="shrink-0 text-[11px] text-muted-foreground tabular-nums sm:text-xs">{meta}</div>
        ) : null}
      </div>
      {description != null ? (
        <div className="text-sm leading-relaxed text-muted-foreground [&_p+p]:mt-2">{description}</div>
      ) : null}
      {backLink ? (
        <Link
          href={backLink.href}
          className="mt-1 inline-block text-xs text-primary underline-offset-4 hover:underline"
        >
          {backLink.label}
        </Link>
      ) : null}
      {children}
    </header>
  );
}
