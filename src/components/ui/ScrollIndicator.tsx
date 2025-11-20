import { useEffect, useState, useRef } from "react";
import { ChevronDown, ChevronUp, ArrowRight, ArrowLeft, Move } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";

interface ScrollIndicatorProps {
  scrollContainerRef?: React.RefObject<HTMLElement>;
  direction?: 'horizontal' | 'vertical' | 'both';
  className?: string;
}

export const ScrollIndicator = ({ scrollContainerRef, direction, className }: ScrollIndicatorProps = {}) => {
  const isMobile = useIsMobile();
  const [showIndicator, setShowIndicator] = useState(false);
  const [scrollDirection, setScrollDirection] = useState<'vertical' | 'horizontal' | 'both' | null>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const hasScrolledRef = useRef(false);

  useEffect(() => {
    if (!isMobile) {
      setShowIndicator(false);
      return;
    }

    const checkScroll = () => {
      const container = scrollContainerRef?.current || document.documentElement;
      const isBody = !scrollContainerRef?.current;
      
      let hasVerticalScroll = false;
      let hasHorizontalScroll = false;

      if (isBody) {
        const body = document.body;
        const html = document.documentElement;
        hasVerticalScroll = body.scrollHeight > window.innerHeight || html.scrollHeight > window.innerHeight;
        hasHorizontalScroll = body.scrollWidth > window.innerWidth || html.scrollWidth > window.innerWidth;
      } else {
        hasVerticalScroll = container.scrollHeight > container.clientHeight;
        hasHorizontalScroll = container.scrollWidth > container.clientWidth;
      }

      // Verificar se já rolou
      const hasScrolledVertically = isBody 
        ? (window.scrollY > 10 || document.documentElement.scrollTop > 10)
        : (container.scrollTop > 10);
      const hasScrolledHorizontally = isBody
        ? (window.scrollX > 10 || document.documentElement.scrollLeft > 10)
        : (container.scrollLeft > 10);

      // Se já rolou, esconder após um tempo
      if (hasScrolledVertically || hasScrolledHorizontally) {
        hasScrolledRef.current = true;
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current);
        }
        timeoutRef.current = setTimeout(() => {
          setShowIndicator(false);
        }, 3000);
      }

      // Determinar direção baseado em props ou detecção automática
      let finalDirection: 'vertical' | 'horizontal' | 'both' | null = null;
      
      if (direction) {
        finalDirection = direction;
      } else if (hasVerticalScroll && hasHorizontalScroll) {
        finalDirection = 'both';
      } else if (hasVerticalScroll) {
        finalDirection = 'vertical';
      } else if (hasHorizontalScroll) {
        finalDirection = 'horizontal';
      }

      // Só mostrar se não rolou ainda ou se há scroll disponível
      if (finalDirection && !hasScrolledRef.current) {
        setScrollDirection(finalDirection);
        setShowIndicator(true);
      } else if (!hasScrolledRef.current && finalDirection) {
        setScrollDirection(finalDirection);
        setShowIndicator(true);
      } else {
        setScrollDirection(null);
        setShowIndicator(false);
      }
    };

    const handleScroll = () => {
      const container = scrollContainerRef?.current || document.documentElement;
      const isBody = !scrollContainerRef?.current;
      
      const hasScrolledVertically = isBody 
        ? (window.scrollY > 10 || document.documentElement.scrollTop > 10)
        : (container.scrollTop > 10);
      const hasScrolledHorizontally = isBody
        ? (window.scrollX > 10 || document.documentElement.scrollLeft > 10)
        : (container.scrollLeft > 10);

      if (hasScrolledVertically || hasScrolledHorizontally) {
        hasScrolledRef.current = true;
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current);
        }
        timeoutRef.current = setTimeout(() => {
          setShowIndicator(false);
        }, 3000);
      }
    };

    // Verificar após um delay para garantir que o DOM está renderizado
    const initialTimeout = setTimeout(checkScroll, 1000);
    
    const container = scrollContainerRef?.current;
    const scrollTarget = container || window;
    
    // Verificar quando a janela é redimensionada ou quando o conteúdo muda
    window.addEventListener('resize', checkScroll);
    scrollTarget.addEventListener('scroll', handleScroll, { passive: true });
    
    // Verificar periodicamente para capturar mudanças dinâmicas no conteúdo
    const intervalId = setInterval(checkScroll, 1500);

    return () => {
      clearTimeout(initialTimeout);
      clearInterval(intervalId);
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      window.removeEventListener('resize', checkScroll);
      scrollTarget.removeEventListener('scroll', handleScroll);
    };
  }, [isMobile, scrollContainerRef, direction]);

  if (!isMobile || !showIndicator || !scrollDirection) {
    return null;
  }

  const getMessage = () => {
    switch (scrollDirection) {
      case 'vertical':
        return 'Deslize para cima e para baixo';
      case 'horizontal':
        return 'Deslize para os lados';
      case 'both':
        return 'Deslize em todas as direções';
      default:
        return 'Deslize para ver mais';
    }
  };

  const getIcons = () => {
    switch (scrollDirection) {
      case 'vertical':
        return (
          <div className="flex flex-col items-center gap-0.5">
            <ChevronUp className="w-3 h-3 animate-bounce" />
            <ChevronDown className="w-3 h-3 animate-bounce" style={{ animationDelay: '0.2s' }} />
          </div>
        );
      case 'horizontal':
        return (
          <div className="flex items-center gap-1">
            <ArrowLeft className="w-3 h-3 animate-pulse" />
            <ArrowRight className="w-3 h-3 animate-pulse" style={{ animationDelay: '0.2s' }} />
          </div>
        );
      case 'both':
        return (
          <div className="flex items-center gap-1">
            <Move className="w-4 h-4 animate-pulse" />
            <div className="flex flex-col items-center gap-0.5">
              <ChevronUp className="w-2 h-2 animate-bounce" />
              <ChevronDown className="w-2 h-2 animate-bounce" style={{ animationDelay: '0.2s' }} />
            </div>
            <div className="flex items-center gap-0.5">
              <ArrowLeft className="w-2 h-2 animate-pulse" />
              <ArrowRight className="w-2 h-2 animate-pulse" style={{ animationDelay: '0.2s' }} />
            </div>
          </div>
        );
      default:
        return <ChevronDown className="w-4 h-4 animate-bounce" />;
    }
  };

  const positionClass = scrollContainerRef ? "absolute" : "fixed";
  const positionStyle = scrollContainerRef 
    ? { bottom: '1rem', left: '50%', transform: 'translateX(-50%)' }
    : { bottom: '1rem', left: '50%', transform: 'translateX(-50%)' };

  return (
    <div 
      className={cn(
        positionClass,
        "z-50 md:hidden pointer-events-none",
        className
      )}
      style={positionStyle}
    >
      <div className="bg-gradient-to-r from-primary to-primary/90 backdrop-blur-md text-white px-3 sm:px-4 py-2 sm:py-2.5 rounded-full shadow-2xl border-2 border-primary/30 flex items-center gap-2 max-w-[90vw] drop-shadow-lg animate-bounce-slow">
        <div className="flex items-center gap-1 flex-shrink-0">
          {getIcons()}
        </div>
        <span className="text-[10px] sm:text-xs font-semibold whitespace-nowrap">
          {getMessage()}
        </span>
      </div>
    </div>
  );
};

