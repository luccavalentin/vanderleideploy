import { Loader2 } from "lucide-react";

/**
 * Componente de loading otimizado para páginas
 * Usa skeleton loading para melhor UX
 */
export const PageLoader = () => (
  <div className="min-h-[60vh] flex items-center justify-center p-4">
    <div className="flex flex-col items-center gap-3">
      <Loader2 className="w-8 h-8 animate-spin text-primary" />
      <p className="text-sm text-muted-foreground">Carregando...</p>
    </div>
  </div>
);

/**
 * Skeleton loader para cards/stats
 */
export const CardSkeleton = () => (
  <div className="rounded-lg border bg-card p-6 animate-pulse">
    <div className="h-4 bg-muted rounded w-1/4 mb-4"></div>
    <div className="h-8 bg-muted rounded w-1/2 mb-2"></div>
    <div className="h-3 bg-muted rounded w-1/3"></div>
  </div>
);

/**
 * Skeleton loader para tabelas
 */
export const TableSkeleton = ({ rows = 5 }: { rows?: number }) => (
  <div className="space-y-3">
    {Array.from({ length: rows }).map((_, i) => (
      <div key={i} className="flex gap-4 animate-pulse">
        <div className="h-12 bg-muted rounded flex-1"></div>
        <div className="h-12 bg-muted rounded w-32"></div>
        <div className="h-12 bg-muted rounded w-24"></div>
      </div>
    ))}
  </div>
);

