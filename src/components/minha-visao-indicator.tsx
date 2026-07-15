import { Eye, X } from "lucide-react";
import { useViewAs } from "@/contexts/view-as-context";
import { Button } from "@/components/ui/button";

export function MinhaVisaoIndicator() {
  const { viewAsProfile, isImpersonating, setViewAs } = useViewAs();
  if (!isImpersonating || !viewAsProfile) return null;

  const firstName = (viewAsProfile.full_name || viewAsProfile.email).split(" ")[0];

  return (
    <div className="fixed bottom-4 right-4 z-[60] flex items-center gap-2 rounded-full border border-amber-500/60 bg-amber-400 text-amber-950 shadow-lg pl-3 pr-1 py-1 text-xs font-medium">
      <Eye className="h-3.5 w-3.5" />
      <span>
        Visualizando como <strong>{firstName}</strong>
      </span>
      <Button
        variant="ghost"
        size="icon"
        className="h-6 w-6 rounded-full text-amber-950 hover:bg-amber-500"
        onClick={() => setViewAs(null)}
        aria-label="Sair da visão"
      >
        <X className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}
