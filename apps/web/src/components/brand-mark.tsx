import { cn } from "@/lib/utils";

/** The BiletFlow logo: a rounded brand tile plus the two-tone wordmark. */
export function BrandMark({
  className,
  onDark = false,
}: {
  className?: string;
  onDark?: boolean;
}) {
  return (
    <span className={cn("flex items-center gap-2", className)}>
      <span
        className={cn(
          "flex size-8 shrink-0 items-center justify-center rounded-lg",
          onDark ? "bg-white/15" : "bg-brand",
        )}
        aria-hidden
      >
        <svg viewBox="0 0 20 20" className="size-4" fill="none">
          <path
            d="M3 5.5h14M3 10h9M3 14.5h11"
            stroke="white"
            strokeWidth="2.2"
            strokeLinecap="round"
          />
        </svg>
      </span>
      <span className="font-display text-lg font-extrabold tracking-tight">
        <span className={onDark ? "text-white" : "text-ink-900"}>Bilet</span>
        <span className={onDark ? "text-brand-tint" : "text-brand"}>Flow</span>
      </span>
    </span>
  );
}
