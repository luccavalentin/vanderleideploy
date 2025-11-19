import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";

interface BackButtonProps {
  className?: string;
  variant?: "default" | "outline" | "ghost";
}

export function BackButton({ className, variant = "outline" }: BackButtonProps) {
  const navigate = useNavigate();

  const handleBack = () => {
    try {
      // Volta para a página anterior ou para o dashboard se não houver histórico
      if (window.history.length > 1) {
        navigate(-1);
      } else {
        navigate("/", { replace: true });
      }
    } catch (error) {
      console.error("Erro ao navegar:", error);
      // Fallback seguro
      navigate("/", { replace: true });
    }
  };

  return (
    <Button
      variant={variant}
      onClick={handleBack}
      className={cn("gap-2", className)}
    >
      <ArrowLeft className="w-4 h-4" />
      <span className="hidden sm:inline">Voltar</span>
    </Button>
  );
}


