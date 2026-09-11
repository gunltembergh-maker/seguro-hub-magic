import { Skeleton } from "@/components/ui/skeleton";
import { type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

interface MetricCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon?: LucideIcon;
  loading?: boolean;
  className?: string;
  headerRight?: ReactNode;
  breakdown?: Array<{ label: string; value: string }>;
}

export function MetricCard({ title, value, subtitle, icon: Icon, loading, className, headerRight, breakdown }: MetricCardProps) {
  return (
    <div className={`rounded-lg border border-border bg-card px-4 py-3 text-card-foreground shadow-sm ${className ?? ""}`}>
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">{title}</p>
        <div className="flex items-center gap-2 flex-shrink-0">
          {headerRight}
          {Icon && <Icon className="h-3.5 w-3.5 text-primary" />}
        </div>
      </div>
      {loading ? (
        <Skeleton className="h-7 w-20 mt-1" />
      ) : (
        <p className="mt-0.5 text-xl font-bold text-card-foreground">{value}</p>
      )}
      {subtitle && <p className="mt-0.5 text-[10px] text-muted-foreground">{subtitle}</p>}
      {breakdown && breakdown.length > 0 && !loading && (
        <div className="mt-2 space-y-0.5 border-t border-border pt-1.5">
          {breakdown.map((b) => (
            <div key={b.label} className="flex items-center justify-between gap-2">
              <span className="text-[9.5px] font-bold uppercase tracking-wide text-muted-foreground">{b.label}</span>
              <span className="text-[11.5px] font-semibold text-card-foreground">{b.value}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
