import { useMemo, useState, useRef, useEffect, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/layout/PageHeader";
import { QuickActions } from "@/components/QuickActions";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { format, startOfMonth, endOfMonth, startOfYear, endOfYear, subMonths, startOfQuarter, endOfQuarter, startOfDay, endOfDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ChevronRight, ChevronLeft, X, RotateCcw, Loader2, FileText, Calendar as CalendarIcon, Download } from "lucide-react";
import { TableSkeleton } from "@/components/ui/PageLoader";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

export default function Faturamento() {
  const { toast } = useToast();
  const [currentPage, setCurrentPage] = useState(0); // Página atual (0 = primeiros 10 meses)
  const [pdfDialogOpen, setPdfDialogOpen] = useState(false);
  const [pdfPeriodFilter, setPdfPeriodFilter] = useState<"mes_atual" | "mes_passado" | "trimestre" | "semestre" | "ano" | "personalizado">("ano");
  const [pdfCustomDateRange, setPdfCustomDateRange] = useState<{ from: Date | undefined; to: Date | undefined }>({
    from: undefined,
    to: undefined,
  });
  const isMobile = typeof window !== 'undefined' && window.innerWidth < 640;
  const MONTHS_PER_PAGE = isMobile ? 3 : 10; // Mobile: 3 meses, Desktop: 10
  const tableScrollRef = useRef<HTMLDivElement>(null);
  
  // Buscar todas as receitas cadastradas
  const { data: consolidatedRevenues = [], isLoading: revenuesLoading, error: revenuesError, refetch: refetchRevenues } = useQuery({
    queryKey: ["consolidated-revenues"],
    queryFn: async () => {
      try {
        const { data, error } = await supabase
          .from("revenue")
          .select("id, date, description, category, classification, amount, status, frequency, installments, documentation_status, client_id, property_id, created_at, updated_at")
          .order("date", { ascending: true });
        
        if (error) {
          console.error("Erro ao buscar receitas:", error);
          // Se for erro 404, retorna array vazio
          if (error.code === "PGRST116" || error.message?.includes("404") || error.message?.includes("Not Found")) {
            return [];
          }
          throw error;
        }
        
        return data || [];
      } catch (err: any) {
        console.error("Erro na query de receitas:", err);
        // Retornar array vazio em caso de erro para não quebrar a tela
        if (err?.message?.includes("404") || err?.code === "PGRST116" || err?.message?.includes("Not Found")) {
          return [];
        }
        throw err;
      }
    },
    retry: (failureCount, error: any) => {
      // Não retry em erros 404
      if (error?.code === "PGRST116" || error?.message?.includes("404") || error?.message?.includes("Not Found")) {
        return false;
      }
      return failureCount < 2;
    },
    retryDelay: 1000,
    staleTime: 120000, // Cache por 2 minutos para melhor performance
    refetchOnMount: false, // Não refetch ao montar se dados estão frescos
    refetchOnWindowFocus: false, // Não refetch ao focar na janela
    refetchOnReconnect: false, // Não refetch ao reconectar (dados já estão em cache)
    gcTime: 300000, // Manter em cache por 5 minutos
  });

  // Gerar todos os meses disponíveis, cobrindo do menor ao maior mês das receitas
  // Otimizado para limitar o range de meses e evitar cálculos excessivos
  const allMonths = useMemo(() => {
    // Se não há receitas ou ainda está carregando, retornar apenas o mês atual
    if (!consolidatedRevenues || consolidatedRevenues.length === 0) {
      const today = new Date();
      const currentMonth = new Date(today.getFullYear(), today.getMonth(), 1);
      return [{
        key: format(currentMonth, "yyyy-MM"),
        label: format(currentMonth, "MMM/yyyy", { locale: ptBR }).toUpperCase(),
        fullDate: currentMonth,
      }];
    }

    const today = new Date();
    const currentMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    let minDate = new Date(currentMonth);
    let maxDate = new Date(currentMonth);
    let hasValidDate = false;

    // Limitar o range para evitar cálculos excessivos (máximo 3 anos para frente e 1 ano para trás)
    const maxFutureDate = new Date(today.getFullYear() + 3, today.getMonth(), 1);
    const maxPastDate = new Date(today.getFullYear() - 1, today.getMonth(), 1);

    // Processar receitas de forma otimizada
    for (let i = 0; i < consolidatedRevenues.length; i++) {
      const revenue = consolidatedRevenues[i];
      let d = typeof revenue.date === 'string' ? new Date(revenue.date) : revenue.date;
      if (!(d instanceof Date) || isNaN(d.getTime())) continue;
      
      const revenueMonth = new Date(d.getFullYear(), d.getMonth(), 1);
      
      if (!hasValidDate) {
        minDate = new Date(revenueMonth);
        maxDate = new Date(revenueMonth);
        hasValidDate = true;
      } else {
        if (revenueMonth < minDate) minDate = new Date(revenueMonth);
        if (revenueMonth > maxDate) maxDate = new Date(revenueMonth);
      }
      
      // Considerar parcelas futuras (limitado)
      if (revenue.frequency && revenue.frequency.toString().toUpperCase() !== 'ÚNICA') {
        const installmentsCount = revenue.installments ? parseInt(revenue.installments.toString()) : null;
        if (installmentsCount && installmentsCount > 1) {
          let futureDate: Date;
          if (revenue.frequency.toString().toUpperCase().includes('MENSAL')) {
            futureDate = new Date(d.getFullYear(), d.getMonth() + installmentsCount - 1, 1);
          } else if (revenue.frequency.toString().toUpperCase().includes('ANUAL')) {
            futureDate = new Date(d.getFullYear() + installmentsCount - 1, d.getMonth(), 1);
          } else {
            continue;
          }
          
          // Limitar data futura
          if (futureDate > maxDate && futureDate <= maxFutureDate) {
            maxDate = new Date(futureDate);
          }
        }
      }
    }

    // Se não encontrou nenhuma data válida, usar o mês atual
    if (!hasValidDate) {
      return [{
        key: format(currentMonth, "yyyy-MM"),
        label: format(currentMonth, "MMM/yyyy", { locale: ptBR }).toUpperCase(),
        fullDate: currentMonth,
      }];
    }

    // Garantir limites
    if (minDate < maxPastDate) minDate = new Date(maxPastDate);
    if (maxDate > maxFutureDate) maxDate = new Date(maxFutureDate);
    if (currentMonth < minDate) minDate = new Date(currentMonth);
    if (currentMonth > maxDate) maxDate = new Date(currentMonth);

    // Gerar lista de meses entre minDate e maxDate (limitado)
    const monthsList = [];
    let current = new Date(minDate.getFullYear(), minDate.getMonth(), 1);
    const maxMonths = 60; // Limitar a 60 meses (5 anos) para melhor performance
    let monthCount = 0;
    
    while (current <= maxDate && monthCount < maxMonths) {
      monthsList.push({
        key: format(current, "yyyy-MM"),
        label: format(current, "MMM/yyyy", { locale: ptBR }).toUpperCase(),
        fullDate: new Date(current),
      });
      current.setMonth(current.getMonth() + 1);
      monthCount++;
    }
    
    return monthsList;
  }, [consolidatedRevenues]);

  // Calcular meses da página atual (Mobile: 3 meses + total, Desktop: 10 meses)
  const months = useMemo(() => {
    if (isMobile) {
      const startIndex = currentPage * 3;
      const endIndex = startIndex + 3;
      let selectedMonths = allMonths.slice(startIndex, endIndex);
      selectedMonths = [...selectedMonths, { key: 'TOTAL', label: 'TOTAL', fullDate: null }];
      return selectedMonths;
    } else {
      const startIndex = currentPage * 10;
      const endIndex = startIndex + 10;
      return allMonths.slice(startIndex, endIndex);
    }
  }, [allMonths, currentPage, isMobile]);

  // Calcular total de páginas
  const totalPages = useMemo(() => {
    return isMobile ? Math.ceil(allMonths.length / 3) : Math.ceil(allMonths.length / 10);
  }, [allMonths.length, isMobile]);

  // Verificar se há próxima página
  const hasNextPage = currentPage < totalPages - 1;
  const hasPreviousPage = currentPage > 0;

  // Função para navegar para próxima página
  const handleNextPage = () => {
    if (hasNextPage) {
      setCurrentPage(prev => prev + 1);
      // Scroll para o início da tabela
      if (tableScrollRef.current) {
        tableScrollRef.current.scrollLeft = 0;
      }
    }
  };

  // Função para navegar para página anterior
  const handlePreviousPage = () => {
    if (hasPreviousPage) {
      setCurrentPage(prev => prev - 1);
      // Scroll para o início da tabela
      if (tableScrollRef.current) {
        tableScrollRef.current.scrollLeft = 0;
      }
    }
  };

  // Função para resetar a página
  const handleResetMonths = () => {
    setCurrentPage(0);
    if (tableScrollRef.current) {
      tableScrollRef.current.scrollLeft = 0;
    }
  };

  // Função para gerar parcelas futuras baseadas na periodicidade
  // Memoizada com useCallback para evitar recriação desnecessária
  const generateInstallments = useCallback((revenue: any, allMonthsList: any[]) => {
    // Usar Map para evitar duplicatas de monthKey
    const installmentsMap = new Map<string, number>();
    const frequency = (revenue.frequency || "Única").toString();
    const installmentsCount = revenue.installments ? parseInt(revenue.installments.toString()) : null;
    
    // Parse da data - garantir que está no formato correto
    let startDate: Date;
    if (typeof revenue.date === 'string') {
      startDate = new Date(revenue.date);
    } else if (revenue.date instanceof Date) {
      startDate = new Date(revenue.date);
    } else {
      return [];
    }
    
    // Validar data
    if (isNaN(startDate.getTime())) {
      return [];
    }
    
    const amount = Number(revenue.amount || 0);
    if (amount <= 0) {
      return [];
    }

    // Normalizar frequency para comparação
    const frequencyUpper = frequency.toUpperCase();
    const isMensal = frequencyUpper.includes("MENSAL");
    const isAnual = frequencyUpper.includes("ANUAL");
    const isTempoDeterminado = frequencyUpper.includes("TEMPO DETERMINADO") || frequencyUpper.includes("TEMPO_DETERMINADO");
    const isFixo = frequencyUpper.includes("FIXO") && !isTempoDeterminado;

    // Criar um mapa dos meses disponíveis para busca rápida (usar allMonthsList)
    const monthsMap = new Map(allMonthsList.map(m => [m.key, m]));
    
    // Obter o primeiro e último mês disponível para limites
    const firstMonth = allMonthsList[0]?.fullDate;
    const lastMonth = allMonthsList[allMonthsList.length - 1]?.fullDate;
    if (!firstMonth || !lastMonth) return [];

    // Receita única - apenas no mês da data
    if (frequency === "Única" || (!isMensal && !isAnual)) {
      const monthKey = format(startDate, "yyyy-MM");
      if (monthsMap.has(monthKey)) {
        installmentsMap.set(monthKey, amount);
      }
      return Array.from(installmentsMap.entries()).map(([monthKey, amount]) => ({
        monthKey,
        amount,
      }));
    }

    // Receita mensal
    if (isMensal) {
      if (isFixo) {
        // Mensal Fixo - gerar para TODOS os meses a partir do mês da data de início
        // Começar do mês da data de início (inclusive)
        const startMonth = new Date(startDate.getFullYear(), startDate.getMonth(), 1);
        const endMonth = new Date(lastMonth.getFullYear(), lastMonth.getMonth(), 1);
        
        // Gerar todos os meses a partir do mês de início até o último mês disponível
        let currentMonth = new Date(startMonth);
        while (currentMonth <= endMonth) {
          const monthKey = format(currentMonth, "yyyy-MM");
          if (monthsMap.has(monthKey)) {
            installmentsMap.set(monthKey, amount);
          }
          // Avançar para o próximo mês
          currentMonth.setMonth(currentMonth.getMonth() + 1);
        }
      } else if (isTempoDeterminado && installmentsCount && installmentsCount > 0) {
        // Mensal por Tempo Determinado - gerar exatamente o número de parcelas especificado
        // Começar do mês da data de início - sempre usar dia 1 para evitar problemas com datas inválidas
        for (let i = 0; i < installmentsCount; i++) {
          const installmentDate = new Date(startDate.getFullYear(), startDate.getMonth() + i, 1);
          const monthKey = format(installmentDate, "yyyy-MM");
          
          // Verificar se o mês está dentro dos meses exibidos
          if (monthsMap.has(monthKey)) {
            installmentsMap.set(monthKey, amount);
          }
        }
      } else {
        // Fallback para "Mensal" simples ou sem tipo definido - tratar como fixo
        const startMonth = new Date(startDate.getFullYear(), startDate.getMonth(), 1);
        const endMonth = new Date(lastMonth.getFullYear(), lastMonth.getMonth(), 1);
        
        let currentMonth = new Date(startMonth);
        while (currentMonth <= endMonth) {
          const monthKey = format(currentMonth, "yyyy-MM");
          if (monthsMap.has(monthKey)) {
            installmentsMap.set(monthKey, amount);
          }
          currentMonth.setMonth(currentMonth.getMonth() + 1);
        }
      }
    }
    // Receita anual
    else if (isAnual) {
      const startYear = startDate.getFullYear();
      const startMonth = startDate.getMonth(); // 0-11 (Janeiro = 0)
      
      // Priorizar Tempo Determinado sobre Fixo
      if (isTempoDeterminado && installmentsCount && installmentsCount > 0) {
        // Anual por Tempo Determinado - gerar exatamente X parcelas (uma por ano)
        // Sempre usar o primeiro dia do mês para evitar problemas com datas inválidas
        for (let i = 0; i < installmentsCount; i++) {
          const installmentYear = startYear + i;
          // Criar monthKey diretamente usando ano e mês
          const monthKey = `${installmentYear}-${String(startMonth + 1).padStart(2, '0')}`;
          
          // Verificar se o mês está dentro dos meses exibidos
          if (monthsMap.has(monthKey)) {
            installmentsMap.set(monthKey, amount);
          }
        }
      } else {
        // Anual Fixo ou Anual simples - gerar para TODOS os anos no mesmo mês
        // Começar do ano da data de início (inclusive)
        const endYear = lastMonth.getFullYear();
        
        // Gerar para todos os anos do ano de início até o último ano disponível
        // Sempre usar o primeiro dia do mês para evitar problemas com datas inválidas
        for (let year = startYear; year <= endYear; year++) {
          // Criar monthKey diretamente usando ano e mês
          const monthKey = `${year}-${String(startMonth + 1).padStart(2, '0')}`;
          
          // Verificar se o mês está dentro dos meses exibidos
          if (monthsMap.has(monthKey)) {
            installmentsMap.set(monthKey, amount);
          }
        }
      }
    }

    // Converter Map para Array
    return Array.from(installmentsMap.entries()).map(([monthKey, amount]) => ({
      monthKey,
      amount,
    }));
  }, []);

  // Estado para controlar processamento assíncrono
  const [isProcessing, setIsProcessing] = useState(false);
  const [billingData, setBillingData] = useState<Array<{category: string; monthlyData: Record<string, number>; total: number}>>([]);

  // Processar receitas consolidadas agrupadas por categoria e mês
  // Otimizado com processamento assíncrono para não bloquear UI
  useEffect(() => {
    // Se ainda está carregando ou não há receitas, limpar dados
    if (revenuesLoading || !consolidatedRevenues || consolidatedRevenues.length === 0 || allMonths.length === 0) {
      setBillingData([]);
      setIsProcessing(false);
      return;
    }

    setIsProcessing(true);
    
    // Processar em chunks assíncronos para não bloquear UI
    const processBillingData = async () => {
      // Agrupar receitas por categoria
      const byCategory: Record<string, Record<string, number>> = {};
      
      // Criar mapa de meses uma vez para melhor performance
      const monthsMap = new Map(allMonths.map(m => [m.key, true]));

      // Processar receitas em chunks de 50 para não bloquear
      const CHUNK_SIZE = 50;
      const maxRevenues = Math.min(consolidatedRevenues.length, 500); // Limitar a 500 receitas
      
      for (let chunkStart = 0; chunkStart < maxRevenues; chunkStart += CHUNK_SIZE) {
        const chunkEnd = Math.min(chunkStart + CHUNK_SIZE, maxRevenues);
        
        // Processar chunk
        for (let i = chunkStart; i < chunkEnd; i++) {
          const revenue = consolidatedRevenues[i];
          const category = revenue.category || "Sem Categoria";
          
          // Gerar todas as parcelas para esta receita usando allMonths
          const installments = generateInstallments(revenue, allMonths);
          
          // Inicializar categoria se necessário
          if (!byCategory[category]) {
            byCategory[category] = {};
          }
          
          // Processar parcelas
          for (let j = 0; j < installments.length; j++) {
            const { monthKey, amount } = installments[j];
            // Só processar se o mês está na lista de meses disponíveis
            if (monthsMap.has(monthKey)) {
              byCategory[category][monthKey] = (byCategory[category][monthKey] || 0) + amount;
            }
          }
        }
        
        // Yield para UI entre chunks (permitir renderização)
        if (chunkEnd < maxRevenues) {
          await new Promise(resolve => setTimeout(resolve, 0));
        }
      }

      // Converter para array de dados
      const result = Object.entries(byCategory).map(([category, monthlyData]) => {
        const total = Object.values(monthlyData).reduce((sum, val) => sum + val, 0);
        return {
          category,
          monthlyData,
          total,
        };
      });
      
      setBillingData(result);
      setIsProcessing(false);
    };

    processBillingData();
  }, [consolidatedRevenues, allMonths, revenuesLoading, generateInstallments]);

  // Calcular totais por mês (apenas para os meses da página atual)
  const monthlyTotals = useMemo(() => {
    const totals: Record<string, number> = {};
    months.forEach((month) => {
      totals[month.key] = billingData.reduce((sum, item) => {
        return sum + (item.monthlyData[month.key] || 0);
      }, 0);
    });
    return totals;
  }, [billingData, months]);

  // Calcular total geral (soma de todos os meses disponíveis)
  const grandTotal = useMemo(() => {
    return billingData.reduce((sum, item) => sum + item.total, 0);
  }, [billingData]);


  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  const formatCategoryLabel = (label: string) => {
    if (!label) return "";
    const normalized = label.replace(/\s+/g, " ").trim();
    return normalized.replace(/\b(de|da|do|das|dos)\b\s+/gi, (match) => `${match.trim()}\u00A0`);
  };

  // Gerar PDF profissional de faturamento
  const handleGeneratePDF = async () => {
    try {
      toast({
        title: "Gerando PDF...",
        description: "Isso pode levar alguns instantes.",
      });

      // Filtrar receitas pelo período selecionado
      const startDate = format(pdfDateRange.start, "yyyy-MM-dd");
      const endDate = format(pdfDateRange.end, "yyyy-MM-dd");
      
      const { data: filteredRevenues, error } = await supabase
        .from("revenue")
        .select("id, date, description, category, classification, amount, status, frequency, installments, documentation_status")
        .gte("date", startDate)
        .lte("date", endDate)
        .order("date", { ascending: true });
      
      if (error) throw error;

      // Processar dados de faturamento para o período
      const monthsInRange: string[] = [];
      const currentDate = new Date(pdfDateRange.start);
      while (currentDate <= pdfDateRange.end) {
        monthsInRange.push(format(currentDate, "yyyy-MM"));
        currentDate.setMonth(currentDate.getMonth() + 1);
      }

      // Calcular faturamento por categoria e mês
      const billingMap: Record<string, Record<string, number>> = {};
      
      filteredRevenues?.forEach((revenue: any) => {
        const category = revenue.category || "Sem categoria";
        if (!billingMap[category]) {
          billingMap[category] = {};
        }
        
        const installments = generateInstallments(revenue, monthsInRange.map(key => ({
          key,
          label: format(new Date(key + "-01"), "MMM/yyyy", { locale: ptBR }).toUpperCase(),
          fullDate: new Date(key + "-01"),
        })));
        
        installments.forEach(({ monthKey, amount }) => {
          if (monthsInRange.includes(monthKey)) {
            billingMap[category][monthKey] = (billingMap[category][monthKey] || 0) + amount;
          }
        });
      });

      // Criar PDF
      const doc = new jsPDF("landscape", "mm", "a4");
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const margin = 15;
      let yPosition = margin;

      // Cabeçalho profissional
      doc.setFillColor(33, 150, 243);
      doc.rect(0, 0, pageWidth, 40, "F");
      
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(24);
      doc.setFont("helvetica", "bold");
      doc.text("RELATÓRIO DE FATURAMENTO", pageWidth / 2, 20, { align: "center" });
      
      doc.setFontSize(12);
      doc.setFont("helvetica", "normal");
      const periodLabel = pdfPeriodFilter === "ano" 
        ? format(pdfDateRange.start, "yyyy", { locale: ptBR })
        : pdfPeriodFilter === "personalizado" && pdfCustomDateRange.from && pdfCustomDateRange.to
        ? `${format(pdfCustomDateRange.from, "dd/MM/yyyy", { locale: ptBR })} - ${format(pdfCustomDateRange.to, "dd/MM/yyyy", { locale: ptBR })}`
        : `${format(pdfDateRange.start, "dd/MM/yyyy", { locale: ptBR })} - ${format(pdfDateRange.end, "dd/MM/yyyy", { locale: ptBR })}`;
      doc.text(`Período: ${periodLabel}`, pageWidth / 2, 30, { align: "center" });
      
      doc.setTextColor(0, 0, 0);
      yPosition = 50;

      // Resumo executivo
      const totalByCategory: Record<string, number> = {};
      Object.entries(billingMap).forEach(([category, monthlyData]) => {
        totalByCategory[category] = Object.values(monthlyData).reduce((sum, val) => sum + val, 0);
      });
      const grandTotal = Object.values(totalByCategory).reduce((sum, val) => sum + val, 0);

      doc.setFontSize(14);
      doc.setFont("helvetica", "bold");
      doc.text("RESUMO EXECUTIVO", margin, yPosition);
      yPosition += 10;

      const summaryData = [
        ["Total de Categorias", Object.keys(billingMap).length.toString()],
        ["Total Faturado", new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(grandTotal)],
        ["Período", periodLabel],
        ["Data de Geração", format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })],
      ];

      autoTable(doc, {
        startY: yPosition,
        head: [["Item", "Valor"]],
        body: summaryData,
        theme: "striped",
        headStyles: { fillColor: [33, 150, 243], textColor: 255, fontStyle: "bold" },
        styles: { fontSize: 10 },
        margin: { left: margin, right: margin },
      });

      yPosition = (doc as any).lastAutoTable.finalY + 15;

      // Tabela de faturamento por categoria e mês
      if (Object.keys(billingMap).length > 0) {
        if (yPosition > pageHeight - 60) {
          doc.addPage();
          yPosition = margin;
        }

        doc.setFontSize(14);
        doc.setFont("helvetica", "bold");
        doc.text("FATURAMENTO POR CATEGORIA E MÊS", margin, yPosition);
        yPosition += 10;

        // Preparar cabeçalho da tabela
        const headerRow = ["Categoria", ...monthsInRange.map(m => format(new Date(m + "-01"), "MMM/yy", { locale: ptBR }).toUpperCase()), "Total"];
        
        // Preparar dados
        const tableData = Object.entries(billingMap).map(([category, monthlyData]) => {
          const row = [category];
          let categoryTotal = 0;
          monthsInRange.forEach(monthKey => {
            const amount = monthlyData[monthKey] || 0;
            row.push(new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(amount));
            categoryTotal += amount;
          });
          row.push(new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(categoryTotal));
          return row;
        });

        // Adicionar linha de totais
        const totalsRow = ["TOTAL"];
        monthsInRange.forEach(monthKey => {
          const monthTotal = Object.values(billingMap).reduce((sum, monthlyData) => {
            return sum + (monthlyData[monthKey] || 0);
          }, 0);
          totalsRow.push(new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(monthTotal));
        });
        totalsRow.push(new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(grandTotal));
        tableData.push(totalsRow);

        autoTable(doc, {
          startY: yPosition,
          head: [headerRow],
          body: tableData,
          theme: "striped",
          headStyles: { fillColor: [33, 150, 243], textColor: 255, fontStyle: "bold" },
          styles: { fontSize: 7 },
          margin: { left: margin, right: margin },
          didParseCell: (data: any) => {
            // Destacar linha de totais
            if (data.row.index === tableData.length - 1) {
              data.cell.styles.fontStyle = "bold";
              data.cell.styles.fillColor = [240, 240, 240];
            }
          },
        });
      }

      const fileName = `Faturamento_${periodLabel.replace(/\s+/g, "_")}_${format(new Date(), "dd-MM-yyyy")}.pdf`;
      doc.save(fileName);

      toast({
        title: "PDF gerado com sucesso!",
        description: "O relatório de faturamento foi salvo no seu dispositivo.",
      });
      
      setPdfDialogOpen(false);
    } catch (error: any) {
      toast({
        title: "Erro ao gerar PDF",
        description: error.message || "Ocorreu um erro ao gerar o PDF.",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="w-full max-w-full overflow-x-hidden">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <PageHeader
          title="Faturamento"
          description="Soma de todas as receitas cadastradas por categoria e mês"
          showBackButton={true}
        />
        <div className="flex flex-wrap items-center justify-center sm:justify-end gap-2">
          <Button
            onClick={() => setPdfDialogOpen(true)}
            className="gap-2 rounded-2xl border-2 border-primary/30 bg-primary text-primary-foreground font-semibold shadow-[0_6px_18px_rgba(15,23,42,0.12)] hover:bg-primary/90 hover:shadow-[0_8px_24px_rgba(15,23,42,0.18)] transition-all duration-200"
            size="sm"
          >
            <FileText className="h-4 w-4" />
            <span className="hidden sm:inline">Gerar PDF</span>
            <span className="sm:hidden">PDF</span>
          </Button>
          <div className="flex items-center gap-2 px-4 py-2 rounded-2xl border border-primary/20 bg-primary/5 text-primary font-semibold text-sm shadow-[0_6px_18px_rgba(15,23,42,0.08)]">
            <span>
              Página {currentPage + 1} de {totalPages}
            </span>
          </div>
          {hasPreviousPage && (
            <Button
              variant="outline"
              onClick={handlePreviousPage}
              className="gap-2 rounded-2xl border-2 border-primary/30 bg-white/85 text-primary font-semibold shadow-[0_6px_18px_rgba(15,23,42,0.12)] hover:border-primary hover:bg-primary/5 hover:shadow-[0_8px_24px_rgba(15,23,42,0.18)] transition-all duration-200"
              size="sm"
            >
              <ChevronLeft className="h-4 w-4" />
              <span className="hidden sm:inline">Anterior</span>
              <span className="sm:hidden">Voltar</span>
            </Button>
          )}
          {hasNextPage && (
            <Button
              variant="outline"
              onClick={handleNextPage}
              className="gap-2 rounded-2xl border-2 border-primary/30 bg-white/85 text-primary font-semibold shadow-[0_6px_18px_rgba(15,23,42,0.12)] hover:border-primary hover:bg-primary/5 hover:shadow-[0_8px_24px_rgba(15,23,42,0.18)] transition-all duration-200"
              size="sm"
            >
              <span className="hidden sm:inline">Próximo</span>
              <span className="sm:hidden">Avançar</span>
              <ChevronRight className="h-4 w-4" />
            </Button>
          )}
          {currentPage > 0 && (
            <Button
              variant="outline"
              onClick={handleResetMonths}
              className="gap-2 rounded-2xl border-2 border-primary/30 bg-white/85 text-primary font-semibold shadow-[0_6px_18px_rgba(15,23,42,0.12)] hover:border-primary hover:bg-primary/5 hover:shadow-[0_8px_24px_rgba(15,23,42,0.18)] transition-all duration-200"
              size="sm"
              title="Voltar para início"
            >
              <RotateCcw className="h-4 w-4" />
              <span className="hidden sm:inline">Início</span>
            </Button>
          )}
        </div>
      </div>

      <QuickActions />

      {/* Mobile: Cards verticais | Desktop: Tabela */}
      {isMobile ? (
        <div className="space-y-4">
          {revenuesLoading || isProcessing ? (
            <Card className="p-8 text-center">
              <div className="flex flex-col items-center gap-3">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
                <span className="font-medium text-muted-foreground">
                  {revenuesLoading ? "Carregando receitas..." : "Processando faturamento..."}
                </span>
                {!revenuesLoading && consolidatedRevenues?.length > 0 && (
                  <span className="text-xs text-muted-foreground">
                    Processando {consolidatedRevenues.length} receita(s)...
                  </span>
                )}
              </div>
            </Card>
          ) : billingData.length === 0 && !revenuesLoading && !isProcessing ? (
            <Card className="p-8 text-center">
              <div className="flex flex-col items-center gap-2">
                <div className="w-16 h-16 rounded-full bg-muted/30 border-2 border-border/50 flex items-center justify-center">
                  <span className="text-2xl">📊</span>
                </div>
                <span className="font-medium text-muted-foreground">
                  {revenuesError ? "Erro ao carregar receitas. Tente novamente." : "Nenhuma receita cadastrada encontrada"}
                </span>
                {revenuesError && (
                  <Button onClick={() => refetchRevenues()} variant="outline" size="sm" className="mt-2">
                    Tentar novamente
                  </Button>
                )}
              </div>
            </Card>
          ) : (
            billingData.map((item, index) => (
              <Card key={item.category} className="border border-border/50 shadow-sm">
                <CardContent className="p-4">
                  <h3 className="font-bold text-base mb-3 text-foreground border-b border-border/30 pb-2">
                    {formatCategoryLabel(item.category)}
                  </h3>
                  <div className="space-y-2">
                    {months.filter(m => m.key !== 'TOTAL' && item.monthlyData[m.key]).map((month) => (
                      <div key={month.key} className="flex justify-between items-center py-1.5 border-b border-border/10 last:border-0">
                        <span className="text-xs text-muted-foreground">{month.label}</span>
                        <span className="text-sm font-semibold text-success">
                          {formatCurrency(item.monthlyData[month.key])}
                        </span>
                      </div>
                    ))}
                    <div className="flex justify-between items-center pt-2 mt-2 border-t-2 border-primary/30">
                      <span className="text-sm font-bold text-foreground">Total</span>
                      <span className="text-base font-bold text-success">
                        {formatCurrency(item.total)}
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
          {billingData.length > 0 && (
            <Card className="border-2 border-primary/50 bg-primary/5">
              <CardContent className="p-4">
                <div className="flex justify-between items-center">
                  <span className="text-base font-bold text-foreground">TOTAL GERAL</span>
                  <span className="text-lg font-bold text-success">
                    {formatCurrency(grandTotal)}
                  </span>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      ) : (
        <div className="bg-card rounded-2xl shadow-elegant-lg border-2 border-border/50 overflow-hidden w-full relative mx-auto max-w-full">
          <div 
            ref={tableScrollRef} 
            className="overflow-x-auto w-full faturamento-scroll"
            style={{ 
              scrollbarWidth: 'thin',
              scrollbarColor: 'hsl(var(--primary) / 0.4) transparent'
            }}
          >
            <style>{`
              .faturamento-scroll {
                scrollbar-gutter: stable;
              }
              .faturamento-scroll::-webkit-scrollbar {
                height: 12px;
                display: block;
              }
              .faturamento-scroll::-webkit-scrollbar-track {
                background: hsl(var(--muted) / 0.3);
                border-radius: 6px;
                margin: 0 4px;
              }
              .faturamento-scroll::-webkit-scrollbar-thumb {
                background: hsl(var(--primary) / 0.4);
                border-radius: 6px;
              }
              .faturamento-scroll::-webkit-scrollbar-thumb:hover {
                background: hsl(var(--primary) / 0.6);
              }
            `}</style>
            <Table className="w-full min-w-max text-xs sm:text-sm border-separate border-spacing-0 min-w-[1200px]">
            <TableHeader>
              <TableRow className="border-b-2 border-primary/30 hover:bg-transparent bg-primary">
                <TableHead className="sticky left-0 z-10 bg-primary text-primary-foreground min-w-[60px] sm:min-w-[75px] md:min-w-[100px] max-w-[60px] sm:max-w-[75px] md:max-w-[100px] text-center text-xs sm:text-sm px-2 sm:px-4 font-bold border-r border-primary/50 rounded-tl-xl">
                  <span className="text-primary-foreground font-extrabold">DESCRIÇÃO</span>
                </TableHead>
                {months.map((month, index) => (
                  <TableHead 
                    key={month.key} 
                    className="text-center min-w-[90px] sm:min-w-[100px] md:min-w-[120px] text-xs sm:text-sm px-1 sm:px-2 font-semibold bg-primary text-primary-foreground border-r border-primary/30"
                  >
                      <span className="whitespace-nowrap text-primary-foreground font-bold">{month.label}</span>
                  </TableHead>
                ))}
                <TableHead className="text-center font-bold bg-primary text-primary-foreground min-w-[90px] sm:min-w-[100px] md:min-w-[120px] sticky right-0 z-10 text-xs sm:text-sm px-2 sm:px-4 border-l-2 border-primary/50 rounded-tr-xl">
                  <span className="text-primary-foreground font-extrabold">TOTAL</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {revenuesLoading || isProcessing ? (
                <TableRow>
                  <TableCell colSpan={months.length + 2} className="text-center py-12 text-muted-foreground/70 text-xs sm:text-sm border-0">
                    <div className="flex flex-col items-center gap-3">
                      <Loader2 className="w-8 h-8 animate-spin text-primary" />
                      <span className="font-medium">
                        {revenuesLoading ? "Carregando receitas..." : "Processando faturamento..."}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {!revenuesLoading && consolidatedRevenues?.length > 0 && 
                          `Processando ${consolidatedRevenues.length} receita(s)...`}
                      </span>
                    </div>
                  </TableCell>
                </TableRow>
              ) : billingData.length === 0 && !revenuesLoading && !isProcessing ? (
                <TableRow>
                  <TableCell colSpan={months.length + 2} className="text-center py-12 text-muted-foreground/70 text-xs sm:text-sm border-0">
                    <div className="flex flex-col items-center gap-2">
                      <div className="w-16 h-16 rounded-full bg-muted/30 border-2 border-border/50 flex items-center justify-center">
                        <span className="text-2xl">📊</span>
                      </div>
                      <span className="font-medium">
                        {revenuesError ? "Erro ao carregar receitas. Tente novamente." : "Nenhuma receita cadastrada encontrada"}
                      </span>
                      {revenuesError && (
                        <Button onClick={() => refetchRevenues()} variant="outline" size="sm" className="mt-2">
                          Tentar novamente
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                <>
                  {billingData.map((item, index) => (
                    <TableRow key={item.category} className={`border-b border-border/30 hover:bg-muted/20 transition-colors ${index % 2 === 0 ? "bg-card" : "bg-muted/5"}`}>
                      <TableCell className="font-semibold sticky left-0 z-10 bg-primary text-primary-foreground text-xs sm:text-sm px-2 sm:px-4 border-r border-primary/30 max-w-[60px] sm:max-w-[75px] md:max-w-[100px]">
                        <span className="block break-words whitespace-pre-wrap hyphens-auto leading-tight text-center text-primary-foreground font-bold">
                          {formatCategoryLabel(item.category)}
                        </span>
                      </TableCell>
                      {months.map((month) => (
                        <TableCell 
                          key={month.key} 
                          className="text-center font-medium text-xs sm:text-sm px-1 sm:px-2 border-r border-border/20 bg-card"
                        >
                          {item.monthlyData[month.key] ? (
                            <span className="text-success font-semibold whitespace-nowrap">
                              {formatCurrency(item.monthlyData[month.key])}
                            </span>
                          ) : (
                            <span className="text-muted-foreground/60">-</span>
                          )}
                        </TableCell>
                      ))}
                      <TableCell className="text-center font-bold bg-primary border-l-2 border-primary/50 sticky right-0 z-10 text-xs sm:text-sm px-2 sm:px-4 text-primary-foreground" style={{ right: 0 }}>
                        <span className="whitespace-nowrap font-extrabold">{formatCurrency(item.total)}</span>
                      </TableCell>
                    </TableRow>
                  ))}
                  <TableRow className="bg-primary font-bold border-t-2 border-primary/50 border-b-2 border-primary/30">
                    <TableCell className="sticky left-0 z-10 bg-primary text-primary-foreground font-bold border-r-2 border-primary/40 text-xs sm:text-sm px-2 sm:px-4 rounded-bl-xl text-center">
                      <span className="text-primary-foreground font-extrabold">TOTAL</span>
                    </TableCell>
                    {months.map((month) => (
                      <TableCell 
                        key={month.key} 
                        className="text-center font-bold bg-primary text-primary-foreground text-xs sm:text-sm px-1 sm:px-2 border-r border-primary/30"
                      >
                        <span className="whitespace-nowrap font-extrabold">{formatCurrency(monthlyTotals[month.key] || 0)}</span>
                      </TableCell>
                    ))}
                    <TableCell className="text-center font-bold text-primary-foreground bg-primary border-l-2 border-primary/50 sticky right-0 z-10 text-xs sm:text-sm px-2 sm:px-4 rounded-br-xl" style={{ right: 0 }}>
                      <span className="whitespace-nowrap font-extrabold">{formatCurrency(grandTotal)}</span>
                    </TableCell>
                  </TableRow>
                </>
              )}
            </TableBody>
            </Table>
          </div>
        </div>
      )}

      {/* Dialog para gerar PDF */}
      <Dialog open={pdfDialogOpen} onOpenChange={setPdfDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Gerar PDF de Faturamento</DialogTitle>
            <DialogDescription>
              Selecione o período para gerar o relatório de faturamento em PDF.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Período</Label>
              <Select value={pdfPeriodFilter} onValueChange={(value: any) => setPdfPeriodFilter(value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o período" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="mes_atual">Mês Atual</SelectItem>
                  <SelectItem value="mes_passado">Mês Passado</SelectItem>
                  <SelectItem value="trimestre">Trimestre Atual</SelectItem>
                  <SelectItem value="semestre">Semestre Atual</SelectItem>
                  <SelectItem value="ano">Ano Atual</SelectItem>
                  <SelectItem value="personalizado">Período Personalizado</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            {pdfPeriodFilter === "personalizado" && (
              <div className="space-y-2">
                <Label>Data Inicial</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal",
                        !pdfCustomDateRange.from && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {pdfCustomDateRange.from ? (
                        format(pdfCustomDateRange.from, "dd/MM/yyyy", { locale: ptBR })
                      ) : (
                        <span>Selecione a data inicial</span>
                      )}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={pdfCustomDateRange.from}
                      onSelect={(date) => setPdfCustomDateRange({ ...pdfCustomDateRange, from: date })}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>
            )}
            
            {pdfPeriodFilter === "personalizado" && (
              <div className="space-y-2">
                <Label>Data Final</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal",
                        !pdfCustomDateRange.to && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {pdfCustomDateRange.to ? (
                        format(pdfCustomDateRange.to, "dd/MM/yyyy", { locale: ptBR })
                      ) : (
                        <span>Selecione a data final</span>
                      )}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={pdfCustomDateRange.to}
                      onSelect={(date) => setPdfCustomDateRange({ ...pdfCustomDateRange, to: date })}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>
            )}
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setPdfDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleGeneratePDF} className="gap-2">
              <Download className="h-4 w-4" />
              Gerar PDF
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
