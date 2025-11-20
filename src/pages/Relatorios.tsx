import { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/layout/PageHeader";
import { QuickActions } from "@/components/QuickActions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DialogDescription } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { 
  FileText, 
  Download, 
  TrendingUp, 
  TrendingDown,
  DollarSign,
  Calendar as CalendarIcon,
  BarChart3,
  PieChart,
  Building2,
  Wallet,
  Filter,
  CheckSquare,
  Square
} from "lucide-react";
import { 
  BarChart, 
  Bar, 
  PieChart as RechartsPieChart, 
  Pie, 
  Cell, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer,
  LineChart,
  Line,
  AreaChart,
  Area
} from "recharts";
import { formatCurrency } from "@/lib/validations";
import { formatDateBR } from "@/lib/dateUtils";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";
import { format, startOfMonth, endOfMonth, startOfYear, endOfYear, subMonths, startOfQuarter, endOfQuarter, startOfDay, endOfDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";

// Função customizada para renderizar labels do gráfico de pizza
function renderCustomPieLabel({ cx, cy, midAngle, innerRadius, outerRadius, percent, index, category, value }) {
  if (!value || percent < 0.03) return null;
  const RADIAN = Math.PI / 180;
  const radius = outerRadius + 32;
  const x = cx + radius * Math.cos(-midAngle * RADIAN);
  const y = cy + radius * Math.sin(-midAngle * RADIAN) + index * 18;
  const maxLen = 18;
  const catLabel = category.length > maxLen ? category.slice(0, maxLen) + '...' : category;
  return (
    <g>
      <rect x={x - 2} y={y - 10} width={(typeof window !== 'undefined' && window.innerWidth < 640) ? 80 : 120} height={(typeof window !== 'undefined' && window.innerWidth < 640) ? 18 : 22} fill="#fff" opacity={0.85} rx={6} />
      <text
        x={x + 4}
        y={y + 4}
        fill="#222"
        textAnchor={x > cx ? "start" : "end"}
        dominantBaseline="central"
        fontSize={(typeof window !== 'undefined' && window.innerWidth < 640) ? 10 : 13}
        fontWeight="bold"
        style={{ paintOrder: 'stroke', stroke: '#fff', strokeWidth: 2 }}
      >
        {`${catLabel}: ${(percent * 100).toFixed(0)}%`}
      </text>
    </g>
  );
}

// Paleta de cores variadas e vibrantes para os gráficos
const COLORS = [
  '#3B82F6', // Azul
  '#10B981', // Verde
  '#F59E0B', // Laranja
  '#EF4444', // Vermelho
  '#8B5CF6', // Roxo
  '#EC4899', // Rosa
  '#06B6D4', // Ciano
  '#84CC16', // Verde limão
  '#F97316', // Laranja escuro
  '#6366F1', // Índigo
  '#14B8A6', // Turquesa
  '#A855F7', // Roxo claro
];

// Função para converter cor hex para RGB
const hexToRgb = (hex: string): [number, number, number] => {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? [
        parseInt(result[1], 16),
        parseInt(result[2], 16),
        parseInt(result[3], 16),
      ]
    : [59, 130, 246]; // Azul padrão
};

// Função para obter a próxima cor do array de cores
let colorIndex = 0;
const getNextColor = (): [number, number, number] => {
  const color = COLORS[colorIndex % COLORS.length];
  colorIndex++;
  return hexToRgb(color);
};

// Função para resetar o índice de cores
const resetColorIndex = () => {
  colorIndex = 0;
};

export default function Relatorios() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  // Hook para detectar tamanho da tela de forma segura
  const [isMobile, setIsMobile] = useState(false);
  const [isTablet, setIsTablet] = useState(false);
  
  useEffect(() => {
    const checkScreenSize = () => {
      if (typeof window !== 'undefined') {
        setIsMobile((typeof window !== 'undefined' && window.innerWidth < 640));
        setIsTablet(window.innerWidth >= 640 && window.innerWidth < 1024);
      }
    };
    
    checkScreenSize();
    window.addEventListener('resize', checkScreenSize);
    return () => window.removeEventListener('resize', checkScreenSize);
  }, []);
  
  // Helper para altura dos gráficos
  const getChartHeight = (mobile: number, desktop: number) => {
    if (typeof window === 'undefined') return desktop;
    return (typeof window !== 'undefined' && window.innerWidth < 640) ? mobile : desktop;
  };
  const [revenueDialogOpen, setRevenueDialogOpen] = useState(false);
  const [expenseDialogOpen, setExpenseDialogOpen] = useState(false);
  const [balanceDialogOpen, setBalanceDialogOpen] = useState(false);
  const [propertiesDialogOpen, setPropertiesDialogOpen] = useState(false);
  const [fullReportDialogOpen, setFullReportDialogOpen] = useState(false);
  const [reportOrientation, setReportOrientation] = useState<"portrait" | "landscape">("portrait");
  const [includeDashboard, setIncludeDashboard] = useState(true);
  const [viewFiltersDialogOpen, setViewFiltersDialogOpen] = useState(false);
  
  // Filtros de visualização do dashboard
  const [viewFilters, setViewFilters] = useState({
    // Tipos de gráficos a mostrar
    showFinancial: true, // Receitas e Despesas
    showTasks: true, // Tarefas
    showProperties: true, // Imóveis
    showCattle: true, // Gado
    showClients: true, // Clientes
    showProcesses: true, // Processos
    showLeads: true, // Leads
    
    // Filtros de tarefas
    taskStatus: "todos" as "todos" | "concluidas" | "pendentes",
    
    // Comparativo de períodos
    showPeriodComparison: false,
    comparisonPeriod: "mes_passado" as "mes_passado" | "trimestre" | "semestre" | "ano",
  });
  
  // Seleção de módulos para o relatório
  const [selectedModules, setSelectedModules] = useState<Record<string, boolean>>({
    geral: true, // Se true, seleciona tudo
    receitas: true,
    despesas: true,
    tarefas: true,
    imoveis: true,
    gado: true,
    clientes: true,
    processos: true,
    emprestimos: true,
    aplicacoes: true,
    leads: true,
  });
  
  // Filtros de período para relatório completo - padrão: ano atual
  const [reportPeriodFilter, setReportPeriodFilter] = useState<"mes_atual" | "mes_passado" | "trimestre" | "semestre" | "ano" | "personalizado">("ano");
  const [reportCustomDateRange, setReportCustomDateRange] = useState<{ from: Date | undefined; to: Date | undefined }>({
    from: undefined,
    to: undefined,
  });
  
  // Filtros de período - padrão: ano atual
  const [periodFilter, setPeriodFilter] = useState<"mes_atual" | "mes_passado" | "trimestre" | "semestre" | "ano" | "personalizado">("ano");
  const [customDateRange, setCustomDateRange] = useState<{ from: Date | undefined; to: Date | undefined }>({
    from: undefined,
    to: undefined,
  });
  
  // Calcular período baseado no filtro
  const dateRange = useMemo(() => {
    const today = new Date();
    let start: Date;
    let end: Date;
    
    switch (periodFilter) {
      case "mes_atual":
        start = startOfMonth(today);
        end = endOfMonth(today);
        break;
      case "mes_passado":
        const lastMonth = subMonths(today, 1);
        start = startOfMonth(lastMonth);
        end = endOfMonth(lastMonth);
        break;
      case "trimestre":
        start = startOfQuarter(today);
        end = endOfQuarter(today);
        break;
      case "semestre":
        const currentSemester = today.getMonth() < 6 ? 0 : 6;
        start = new Date(today.getFullYear(), currentSemester, 1);
        end = new Date(today.getFullYear(), currentSemester + 5, 31);
        break;
      case "ano":
        start = startOfYear(today);
        end = endOfYear(today);
        break;
      case "personalizado":
        start = customDateRange.from ? startOfDay(customDateRange.from) : startOfMonth(today);
        end = customDateRange.to ? endOfDay(customDateRange.to) : endOfMonth(today);
        break;
      default:
        start = startOfMonth(today);
        end = endOfMonth(today);
    }
    
    return {
      start: format(start, "yyyy-MM-dd"),
      end: format(end, "yyyy-MM-dd"),
      startDate: start,
      endDate: end
    };
  }, [periodFilter, customDateRange]);

  // Receitas por mês
  const { data: revenueByMonth, isLoading: revenueByMonthLoading } = useQuery({
    queryKey: ["revenue-by-month", dateRange.start, dateRange.end],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("revenue")
        .select("amount, date")
        .gte("date", dateRange.start)
        .lte("date", dateRange.end);
      if (error) throw error;
      
      const monthly = data.reduce((acc: any, item: any) => {
        const date = new Date(item.date);
        const month = format(date, "MMM 'de' yyyy", { locale: ptBR });
        if (!acc[month]) acc[month] = 0;
        acc[month] += Number(item.amount);
        return acc;
      }, {});
      
      return Object.entries(monthly).map(([month, amount]) => ({
        month,
        amount: Number(amount)
      }));
    },
    staleTime: 60000, // Cache por 1 minuto
  });

  // Despesas por mês
  const { data: expensesByMonth } = useQuery({
    queryKey: ["expenses-by-month", dateRange.start, dateRange.end],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("expenses")
        .select("amount, date")
        .gte("date", dateRange.start)
        .lte("date", dateRange.end);
      if (error) throw error;
      
      const monthly = data.reduce((acc: any, item: any) => {
        const date = new Date(item.date);
        const month = format(date, "MMM 'de' yyyy", { locale: ptBR });
        if (!acc[month]) acc[month] = 0;
        acc[month] += Number(item.amount);
        return acc;
      }, {});
      
      return Object.entries(monthly).map(([month, amount]) => ({
        month,
        amount: Number(amount)
      }));
    },
    staleTime: 60000, // Cache por 1 minuto
  });

  // Receitas vs Despesas - ordenado por data
  const { data: revenueVsExpenses } = useQuery({
    queryKey: ["revenue-vs-expenses", dateRange.start, dateRange.end],
    queryFn: async () => {
      const revenue = revenueByMonth || [];
      const expenses = expensesByMonth || [];
      
      const months = [...new Set([...revenue.map((r: any) => r.month), ...expenses.map((e: any) => e.month)])];
      
      const data = months.map(month => {
        const revAmount = revenue.find((r: any) => r.month === month)?.amount || 0;
        const expAmount = expenses.find((e: any) => e.month === month)?.amount || 0;
        return {
          month,
          receitas: revAmount,
          despesas: expAmount,
          saldo: revAmount - expAmount
        };
      });
      
      // Ordenar por data do mês atual em diante (mais recente primeiro)
        const parseMonth = (monthStr: string) => {
        // Formato: "nov. de 2025" -> extrair mês e ano
        const parts = monthStr.split(' de ');
        if (parts.length !== 2) {
          // Fallback para formato antigo "nov/2025"
          const [month, year] = monthStr.split('/');
          const monthMap: Record<string, number> = {
            'jan': 0, 'fev': 1, 'mar': 2, 'abr': 3, 'mai': 4, 'jun': 5,
            'jul': 6, 'ago': 7, 'set': 8, 'out': 9, 'nov': 10, 'dez': 11
          };
          return new Date(parseInt(year), monthMap[month.toLowerCase()] || 0, 1);
        }
        const monthPart = parts[0].replace('.', '').toLowerCase();
        const year = parseInt(parts[1]);
        const monthMap: Record<string, number> = {
          'jan': 0, 'fev': 1, 'mar': 2, 'abr': 3, 'mai': 4, 'jun': 5,
          'jul': 6, 'ago': 7, 'set': 8, 'out': 9, 'nov': 10, 'dez': 11
        };
        return new Date(year, monthMap[monthPart] || 0, 1);
      };
      
      // Ordenar do mais recente para o mais antigo (mês atual em diante)
      return data.sort((a, b) => {
        return parseMonth(b.month).getTime() - parseMonth(a.month).getTime();
      });
    },
    enabled: !!revenueByMonth && !!expensesByMonth,
    staleTime: 60000, // Cache por 1 minuto
  });

  // Receitas por categoria
  const { data: revenueByCategory } = useQuery({
    queryKey: ["revenue-by-category", dateRange.start, dateRange.end],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("revenue")
        .select("amount, category")
        .gte("date", dateRange.start)
        .lte("date", dateRange.end);
      if (error) throw error;
      
      const byCategory = data.reduce((acc: any, item: any) => {
        const category = item.category || "Sem categoria";
        if (!acc[category]) acc[category] = 0;
        acc[category] += Number(item.amount);
        return acc;
      }, {});
      
      return Object.entries(byCategory).map(([category, amount]) => ({
        category,
        amount: Number(amount)
      })).sort((a, b) => b.amount - a.amount);
    },
    staleTime: 60000, // Cache por 1 minuto
  });

  // Despesas por categoria
  const { data: expensesByCategory } = useQuery({
    queryKey: ["expenses-by-category", dateRange.start, dateRange.end],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("expenses")
        .select("amount, category")
        .gte("date", dateRange.start)
        .lte("date", dateRange.end);
      if (error) throw error;
      
      const byCategory = data.reduce((acc: any, item: any) => {
        const category = item.category || "Sem categoria";
        if (!acc[category]) acc[category] = 0;
        acc[category] += Number(item.amount);
        return acc;
      }, {});
      
      return Object.entries(byCategory).map(([category, amount]) => ({
        category,
        amount: Number(amount)
      })).sort((a, b) => b.amount - a.amount);
    },
  });

  // Total de receitas
  const { data: totalRevenue } = useQuery({
    queryKey: ["total-revenue", dateRange.start, dateRange.end],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("revenue")
        .select("amount")
        .gte("date", dateRange.start)
        .lte("date", dateRange.end);
      if (error) throw error;
      return data.reduce((sum, item) => sum + Number(item.amount), 0);
    },
  });

  // Total de despesas
  const { data: totalExpenses } = useQuery({
    queryKey: ["total-expenses", dateRange.start, dateRange.end],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("expenses")
        .select("amount")
        .gte("date", dateRange.start)
        .lte("date", dateRange.end);
      if (error) throw error;
      return data.reduce((sum, item) => sum + Number(item.amount), 0);
    },
  });

  // Total de imóveis
  const { data: totalProperties } = useQuery({
    queryKey: ["total-properties"],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("properties")
        .select("*", { count: "exact", head: true });
      if (error) throw error;
      return count || 0;
    },
  });

  // Detalhes de receitas para o dialog
  const { data: revenueDetails } = useQuery({
    queryKey: ["revenue-details"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("revenue")
        .select("*")
        .order("date", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data;
    },
    enabled: revenueDialogOpen,
  });

  // Detalhes de despesas para o dialog
  const { data: expenseDetails } = useQuery({
    queryKey: ["expense-details"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("expenses")
        .select("*")
        .order("date", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data;
    },
    enabled: expenseDialogOpen,
  });

  // Detalhes de imóveis para o dialog
  const { data: propertiesDetails } = useQuery({
    queryKey: ["properties-details"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("properties")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: propertiesDialogOpen,
  });

  // Total de empréstimos
  const { data: totalLoans } = useQuery({
    queryKey: ["total-loans"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("loans")
        .select("amount");
      if (error) throw error;
      return data.reduce((sum, item) => sum + Number(item.amount || 0), 0);
    },
  });

  // Tarefas por status (com filtro aplicado)
  const { data: tasksByStatus } = useQuery({
    queryKey: ["tasks-by-status", dateRange.start, dateRange.end, viewFilters.taskStatus],
    queryFn: async () => {
      let query = supabase
        .from("reminders")
        .select("completed, status")
        .gte("created_at", dateRange.start)
        .lte("created_at", dateRange.end);
      
      // Aplicar filtro de status se não for "todos"
      if (viewFilters.taskStatus === "concluidas") {
        query = query.eq("completed", true);
      } else if (viewFilters.taskStatus === "pendentes") {
        query = query.eq("completed", false);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      
      const byStatus = data.reduce((acc: any, item: any) => {
        const status = item.completed ? "Concluídas" : "Pendentes";
        if (!acc[status]) acc[status] = 0;
        acc[status]++;
        return acc;
      }, {});
      
      return Object.entries(byStatus).map(([status, count]) => ({
        status,
        count: Number(count)
      }));
    },
  });

  // Tarefas por categoria
  const { data: tasksByCategory } = useQuery({
    queryKey: ["tasks-by-category", dateRange.start, dateRange.end],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("reminders")
        .select("category")
        .gte("created_at", dateRange.start)
        .lte("created_at", dateRange.end);
      if (error) throw error;
      
      const byCategory = data.reduce((acc: any, item: any) => {
        const category = item.category || "Sem categoria";
        if (!acc[category]) acc[category] = 0;
        acc[category]++;
        return acc;
      }, {});
      
      return Object.entries(byCategory).map(([category, count]) => ({
        category,
        count: Number(count)
      })).sort((a, b) => b.count - a.count);
    },
  });

  // Imóveis por cidade
  const { data: propertiesByCity } = useQuery({
    queryKey: ["properties-by-city"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("properties")
        .select("city");
      if (error) throw error;
      
      const byCity = data.reduce((acc: any, item: any) => {
        const city = item.city || "Não informado";
        if (!acc[city]) acc[city] = 0;
        acc[city]++;
        return acc;
      }, {});
      
      return Object.entries(byCity).map(([city, count]) => ({
        city,
        count: Number(count)
      })).sort((a, b) => b.count - a.count);
    },
  });

  // Imóveis por status de documentação
  const { data: propertiesByDocStatus } = useQuery({
    queryKey: ["properties-by-doc-status"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("properties")
        .select("documentation_status");
      if (error) throw error;
      
      const byStatus = data.reduce((acc: any, item: any) => {
        const status = item.documentation_status || "Não informado";
        if (!acc[status]) acc[status] = 0;
        acc[status]++;
        return acc;
      }, {});
      
      return Object.entries(byStatus).map(([status, count]) => ({
        status,
        count: Number(count)
      })).sort((a, b) => b.count - a.count);
    },
  });

  // Imóveis por tipo (locação vs venda)
  const { data: propertiesByType } = useQuery({
    queryKey: ["properties-by-type"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("properties")
        .select("is_rental");
      if (error) throw error;
      
      const byType = data.reduce((acc: any, item: any) => {
        const type = item.is_rental ? "Locação" : "Venda";
        if (!acc[type]) acc[type] = 0;
        acc[type]++;
        return acc;
      }, {});
      
      return Object.entries(byType).map(([type, count]) => ({
        type,
        count: Number(count)
      }));
    },
  });

  // Gado por categoria
  const { data: cattleByCategory } = useQuery({
    queryKey: ["cattle-by-category"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cattle")
        .select("category, quantity");
      if (error) throw error;
      
      const byCategory = data.reduce((acc: any, item: any) => {
        const category = item.category || "Sem categoria";
        const quantity = parseInt(item.quantity) || 0;
        if (!acc[category]) acc[category] = 0;
        acc[category] += quantity;
        return acc;
      }, {});
      
      return Object.entries(byCategory).map(([category, count]) => ({
        category,
        count: Number(count)
      })).sort((a, b) => b.count - a.count);
    },
  });

  // Gado por status de saúde
  const { data: cattleByHealth } = useQuery({
    queryKey: ["cattle-by-health"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cattle")
        .select("health_status, quantity");
      if (error) throw error;
      
      const byHealth = data.reduce((acc: any, item: any) => {
        const health = item.health_status || "Não informado";
        const quantity = parseInt(item.quantity) || 0;
        if (!acc[health]) acc[health] = 0;
        acc[health] += quantity;
        return acc;
      }, {});
      
      return Object.entries(byHealth).map(([health, count]) => ({
        health,
        count: Number(count)
      })).sort((a, b) => b.count - a.count);
    },
  });

  // Clientes por tipo
  const { data: clientsByType } = useQuery({
    queryKey: ["clients-by-type"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clients")
        .select("type");
      if (error) throw error;
      
      const byType = data.reduce((acc: any, item: any) => {
        const type = item.type || "Não informado";
        if (!acc[type]) acc[type] = 0;
        acc[type]++;
        return acc;
      }, {});
      
      return Object.entries(byType).map(([type, count]) => ({
        type,
        count: Number(count)
      })).sort((a, b) => b.count - a.count);
    },
  });

  // Processos por status
  const { data: processesByStatus } = useQuery({
    queryKey: ["processes-by-status"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("legal_processes")
        .select("status");
      if (error) throw error;
      
      const byStatus = data.reduce((acc: any, item: any) => {
        const status = item.status || "Não informado";
        if (!acc[status]) acc[status] = 0;
        acc[status]++;
        return acc;
      }, {});
      
      return Object.entries(byStatus).map(([status, count]) => ({
        status,
        count: Number(count)
      })).sort((a, b) => b.count - a.count);
    },
  });

  // Leads por status
  const { data: leadsByStatus } = useQuery({
    queryKey: ["leads-by-status"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("leads")
        .select("status");
      if (error) throw error;
      
      const byStatus = data.reduce((acc: any, item: any) => {
        const status = item.status || "Não informado";
        if (!acc[status]) acc[status] = 0;
        acc[status]++;
        return acc;
      }, {});
      
      return Object.entries(byStatus).map(([status, count]) => ({
        status,
        count: Number(count)
      })).sort((a, b) => b.count - a.count);
    },
  });


  const handleExportPDF = async () => {
    try {
      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.getWidth();
      const margin = 15;
      let yPosition = margin;

      // Título
      doc.setFontSize(18);
      doc.setFont("helvetica", "bold");
      doc.text("Relatório Financeiro Completo", pageWidth / 2, yPosition, { align: "center" });
      yPosition += 10;

      // Data de geração
      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      doc.text(`Gerado em: ${format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}`, pageWidth / 2, yPosition, { align: "center" });
      yPosition += 15;

      // Resumo
      doc.setFontSize(14);
      doc.setFont("helvetica", "bold");
      doc.text("Resumo Financeiro", margin, yPosition);
      yPosition += 8;

      const summaryData = [
        ["Total de Receitas", formatCurrency(totalRevenue || 0)],
        ["Total de Despesas", formatCurrency(totalExpenses || 0)],
        ["Saldo", formatCurrency(saldo)],
        ["Total de Imóveis", (totalProperties || 0).toString()],
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

      // Receitas por Categoria
      if (revenueByCategory && revenueByCategory.length > 0) {
        if (yPosition > 250) {
          doc.addPage();
          yPosition = margin;
        }
        doc.setFontSize(14);
        doc.setFont("helvetica", "bold");
        doc.text("Receitas por Categoria", margin, yPosition);
        yPosition += 8;

        const revenueData = revenueByCategory.map((item: any) => [
          item.category || "Sem categoria",
          formatCurrency(item.amount),
          `${((item.amount / (totalRevenue || 1)) * 100).toFixed(1)}%`,
        ]);

        autoTable(doc, {
          startY: yPosition,
          head: [["Categoria", "Valor", "Percentual"]],
          body: revenueData,
          theme: "striped",
          headStyles: { fillColor: [33, 150, 243], textColor: 255, fontStyle: "bold" },
          styles: { fontSize: 9 },
          margin: { left: margin, right: margin },
        });

        yPosition = (doc as any).lastAutoTable.finalY + 15;
      }

      // Despesas por Categoria
      if (expensesByCategory && expensesByCategory.length > 0) {
        if (yPosition > 250) {
          doc.addPage();
          yPosition = margin;
        }
        doc.setFontSize(14);
        doc.setFont("helvetica", "bold");
        doc.text("Despesas por Categoria", margin, yPosition);
        yPosition += 8;

        const expenseData = expensesByCategory.map((item: any) => [
          item.category || "Sem categoria",
          formatCurrency(item.amount),
          `${((item.amount / (totalExpenses || 1)) * 100).toFixed(1)}%`,
        ]);

        autoTable(doc, {
          startY: yPosition,
          head: [["Categoria", "Valor", "Percentual"]],
          body: expenseData,
          theme: "striped",
          headStyles: { fillColor: [244, 67, 54], textColor: 255, fontStyle: "bold" },
          styles: { fontSize: 9 },
          margin: { left: margin, right: margin },
        });
      }

      const fileName = `Relatorio_Financeiro_${format(new Date(), "dd-MM-yyyy")}.pdf`;
      doc.save(fileName);

      toast({
        title: "PDF exportado com sucesso!",
        description: "O relatório foi salvo no seu dispositivo.",
      });
    } catch (error: any) {
      toast({
        title: "Erro ao exportar PDF",
        description: error.message || "Ocorreu um erro ao gerar o PDF.",
        variant: "destructive",
      });
    }
  };

  const handleExportExcel = () => {
    try {
      const wb = XLSX.utils.book_new();

      // Resumo
      const summaryData = [
        ["Item", "Valor"],
        ["Total de Receitas", totalRevenue || 0],
        ["Total de Despesas", totalExpenses || 0],
        ["Saldo", saldo],
        ["Total de Imóveis", totalProperties || 0],
      ];
      const wsSummary = XLSX.utils.aoa_to_sheet(summaryData);
      XLSX.utils.book_append_sheet(wb, wsSummary, "Resumo");

      // Receitas por Categoria
      if (revenueByCategory && revenueByCategory.length > 0) {
        const revenueData = revenueByCategory.map((item: any) => ({
          Categoria: item.category || "Sem categoria",
          Valor: item.amount,
          Percentual: `${((item.amount / (totalRevenue || 1)) * 100).toFixed(1)}%`,
        }));
        const wsRevenue = XLSX.utils.json_to_sheet(revenueData);
        XLSX.utils.book_append_sheet(wb, wsRevenue, "Receitas");
      }

      // Despesas por Categoria
      if (expensesByCategory && expensesByCategory.length > 0) {
        const expenseData = expensesByCategory.map((item: any) => ({
          Categoria: item.category || "Sem categoria",
          Valor: item.amount,
          Percentual: `${((item.amount / (totalExpenses || 1)) * 100).toFixed(1)}%`,
        }));
        const wsExpense = XLSX.utils.json_to_sheet(expenseData);
        XLSX.utils.book_append_sheet(wb, wsExpense, "Despesas");
      }

      // Receitas vs Despesas Mensais
      if (revenueVsExpenses && revenueVsExpenses.length > 0) {
        const monthlyData = revenueVsExpenses.map((item: any) => ({
          Mês: item.month,
          Receitas: item.receitas || 0,
          Despesas: item.despesas || 0,
          Saldo: item.saldo || 0,
        }));
        const wsMonthly = XLSX.utils.json_to_sheet(monthlyData);
        XLSX.utils.book_append_sheet(wb, wsMonthly, "Mensal");
      }

      const fileName = `Relatorio_Financeiro_${format(new Date(), "dd-MM-yyyy")}.xlsx`;
      XLSX.writeFile(wb, fileName);

      toast({
        title: "Excel exportado com sucesso!",
        description: "O relatório foi salvo no seu dispositivo.",
      });
    } catch (error: any) {
      toast({
        title: "Erro ao exportar Excel",
        description: error.message || "Ocorreu um erro ao gerar o Excel.",
        variant: "destructive",
      });
    }
  };

  const saldo = (totalRevenue || 0) - (totalExpenses || 0);

  // Calcular período para relatório completo
  const reportDateRange = useMemo(() => {
    const today = new Date();
    let start: Date;
    let end: Date;
    
    switch (reportPeriodFilter) {
      case "mes_atual":
        start = startOfMonth(today);
        end = endOfMonth(today);
        break;
      case "mes_passado":
        const lastMonth = subMonths(today, 1);
        start = startOfMonth(lastMonth);
        end = endOfMonth(lastMonth);
        break;
      case "trimestre":
        start = startOfQuarter(today);
        end = endOfQuarter(today);
        break;
      case "semestre":
        const currentSemester = today.getMonth() < 6 ? 0 : 6;
        start = new Date(today.getFullYear(), currentSemester, 1);
        end = new Date(today.getFullYear(), currentSemester + 5, 31);
        break;
      case "ano":
        start = startOfYear(today);
        end = endOfYear(today);
        break;
      case "personalizado":
        start = reportCustomDateRange.from ? startOfDay(reportCustomDateRange.from) : startOfYear(today);
        end = reportCustomDateRange.to ? endOfDay(reportCustomDateRange.to) : endOfYear(today);
        break;
      default:
        start = startOfYear(today);
        end = endOfYear(today);
    }
    
    return {
      start: format(start, "yyyy-MM-dd"),
      end: format(end, "yyyy-MM-dd"),
      startDate: start,
      endDate: end,
    };
  }, [reportPeriodFilter, reportCustomDateRange]);

  // Função para verificar se deve mostrar gráfico baseado nos filtros
  const shouldShowChart = (chartType: string): boolean => {
    switch (chartType) {
      case "financial":
        return viewFilters.showFinancial;
      case "tasks":
        return viewFilters.showTasks;
      case "properties":
        return viewFilters.showProperties;
      case "cattle":
        return viewFilters.showCattle;
      case "clients":
        return viewFilters.showClients;
      case "processes":
        return viewFilters.showProcesses;
      case "leads":
        return viewFilters.showLeads;
      default:
        return true;
    }
  };

  // Função para lidar com seleção de módulos
  const handleModuleToggle = (module: string) => {
    if (module === "geral") {
      const newValue = !selectedModules.geral;
      const allModules = {
        geral: newValue,
        receitas: newValue,
        despesas: newValue,
        tarefas: newValue,
        imoveis: newValue,
        gado: newValue,
        clientes: newValue,
        processos: newValue,
        emprestimos: newValue,
        aplicacoes: newValue,
        leads: newValue,
      };
      setSelectedModules(allModules);
    } else {
      const newModules = { ...selectedModules, [module]: !selectedModules[module] };
      // Se desmarcar algum módulo, desmarcar "geral"
      if (!newModules[module]) {
        newModules.geral = false;
      }
      // Se todos os módulos estiverem marcados, marcar "geral"
      const allSelected = Object.keys(newModules)
        .filter(key => key !== "geral")
        .every(key => newModules[key]);
      newModules.geral = allSelected;
      setSelectedModules(newModules);
    }
  };

  // Função para gerar relatório completo em PDF
  const handleGenerateFullReportPDF = async () => {
    try {
      // Resetar índice de cores para começar do início
      resetColorIndex();
      
      toast({
        title: "Gerando relatório completo...",
        description: "Isso pode levar alguns instantes.",
      });

      // Determinar quais módulos buscar baseado na seleção
      const shouldInclude = (module: string) => selectedModules.geral || selectedModules[module];
      
      // Preparar queries baseadas na seleção
      const queries: Promise<any>[] = [];
      
      if (shouldInclude("receitas")) {
        queries.push(Promise.resolve(supabase.from("revenue").select("*").gte("date", reportDateRange.start).lte("date", reportDateRange.end).order("date", { ascending: false })));
      }
      if (shouldInclude("despesas")) {
        queries.push(Promise.resolve(supabase.from("expenses").select("*").gte("date", reportDateRange.start).lte("date", reportDateRange.end).order("date", { ascending: false })));
      }
      if (shouldInclude("tarefas")) {
        queries.push(Promise.resolve(supabase.from("reminders").select("*").gte("created_at", reportDateRange.start).lte("created_at", reportDateRange.end).order("created_at", { ascending: false })));
      }
      if (shouldInclude("imoveis")) {
        queries.push(Promise.resolve(supabase.from("properties").select("*").order("created_at", { ascending: false })));
      }
      if (shouldInclude("gado")) {
        queries.push(Promise.resolve(supabase.from("cattle").select("*").order("created_at", { ascending: false })));
      }
      if (shouldInclude("clientes")) {
        queries.push(Promise.resolve(supabase.from("clients").select("*").order("created_at", { ascending: false })));
      }
      if (shouldInclude("processos")) {
        queries.push(Promise.resolve(supabase.from("legal_processes").select("*").order("created_at", { ascending: false })));
      }
      if (shouldInclude("emprestimos")) {
        queries.push(Promise.resolve(supabase.from("loans").select("*").order("created_at", { ascending: false })));
      }
      if (shouldInclude("aplicacoes")) {
        queries.push(Promise.resolve(supabase.from("applications").select("*").order("created_at", { ascending: false })));
      }
      if (shouldInclude("leads")) {
        queries.push(Promise.resolve(supabase.from("leads").select("*").order("created_at", { ascending: false })));
      }

      // Executar queries em paralelo
      const results = await Promise.all(queries);
      
      // Verificar erros
      results.forEach((result) => {
        if (result?.error) throw result.error;
      });
      
      // Processar resultados baseado na ordem das queries
      let resultIndex = 0;
      const revenues = shouldInclude("receitas") ? (results[resultIndex++]?.data || []) : [];
      const expenses = shouldInclude("despesas") ? (results[resultIndex++]?.data || []) : [];
      const tasks = shouldInclude("tarefas") ? (results[resultIndex++]?.data || []) : [];
      const properties = shouldInclude("imoveis") ? (results[resultIndex++]?.data || []) : [];
      const cattle = shouldInclude("gado") ? (results[resultIndex++]?.data || []) : [];
      const clients = shouldInclude("clientes") ? (results[resultIndex++]?.data || []) : [];
      const processes = shouldInclude("processos") ? (results[resultIndex++]?.data || []) : [];
      const loans = shouldInclude("emprestimos") ? (results[resultIndex++]?.data || []) : [];
      const applications = shouldInclude("aplicacoes") ? (results[resultIndex++]?.data || []) : [];
      const leads = shouldInclude("leads") ? (results[resultIndex++]?.data || []) : [];

      // Criar PDF com orientação selecionada
      const doc = new jsPDF(reportOrientation === "landscape" ? "landscape" : "portrait", "mm", "a4");
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const margin = 15;
      let yPosition = margin;

      // Cabeçalho profissional
      doc.setFillColor(33, 150, 243);
      doc.rect(0, 0, pageWidth, 50, "F");
      
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(24);
      doc.setFont("helvetica", "bold");
      doc.text("RELATÓRIO COMPLETO DO SISTEMA", pageWidth / 2, 25, { align: "center" });
      
      doc.setFontSize(12);
      doc.setFont("helvetica", "normal");
      doc.text(`Gerado em: ${format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}`, pageWidth / 2, 35, { align: "center" });
      const reportPeriodLabel = reportPeriodFilter === "ano" 
        ? format(reportDateRange.startDate, "yyyy", { locale: ptBR })
        : reportPeriodFilter === "personalizado" && reportCustomDateRange.from && reportCustomDateRange.to
        ? `${format(reportCustomDateRange.from, "dd/MM/yyyy", { locale: ptBR })} - ${format(reportCustomDateRange.to, "dd/MM/yyyy", { locale: ptBR })}`
        : `${format(reportDateRange.startDate, "dd/MM/yyyy", { locale: ptBR })} - ${format(reportDateRange.endDate, "dd/MM/yyyy", { locale: ptBR })}`;
      
      // Definir dashboardData no escopo correto
      let dashboardData: any[] = [];
      doc.text(`Período: ${reportPeriodLabel}`, pageWidth / 2, 42, { align: "center" });
      
      doc.setTextColor(0, 0, 0);
      yPosition = 60;

      // Dashboard/Resumo Executivo (se solicitado)
      if (includeDashboard === true) {
        // Verificar se há pelo menos um módulo selecionado
        const hasAnyModuleSelected = Object.keys(selectedModules)
          .filter(key => key !== "geral")
          .some(key => selectedModules[key]);

        if (hasAnyModuleSelected) {
          doc.setFontSize(16);
          doc.setFont("helvetica", "bold");
          doc.text("RESUMO EXECUTIVO", margin, yPosition);
          yPosition += 10;

          // Limpar e preencher dashboardData
          dashboardData = [];
          
          if (shouldInclude("receitas")) {
            const revTotal = revenues.reduce((sum: number, r: any) => sum + (Number(r.amount) || 0), 0);
            dashboardData.push(["Total de Receitas", formatCurrency(revTotal)]);
          }
          if (shouldInclude("despesas")) {
            const expTotal = expenses.reduce((sum: number, e: any) => sum + (Number(e.amount) || 0), 0);
            dashboardData.push(["Total de Despesas", formatCurrency(expTotal)]);
          }
          if (shouldInclude("receitas") && shouldInclude("despesas")) {
            const revTotal = revenues.reduce((sum: number, r: any) => sum + (Number(r.amount) || 0), 0);
            const expTotal = expenses.reduce((sum: number, e: any) => sum + (Number(e.amount) || 0), 0);
            dashboardData.push(["Saldo", formatCurrency(revTotal - expTotal)]);
          }
          if (shouldInclude("imoveis")) {
            dashboardData.push(["Total de Imóveis", properties.length.toString()]);
          }
          if (shouldInclude("tarefas")) {
            dashboardData.push(["Total de Tarefas", tasks.length.toString()]);
            const completedTasks = tasks.filter((t: any) => t.completed).length;
            dashboardData.push(["Tarefas Concluídas", completedTasks.toString()]);
          }
          if (shouldInclude("gado")) {
            const totalCattle = cattle.reduce((sum: number, c: any) => sum + (parseInt(c.quantity) || 0), 0);
            dashboardData.push(["Total de Gado", totalCattle.toString()]);
          }
          if (shouldInclude("clientes")) {
            dashboardData.push(["Total de Clientes", clients.length.toString()]);
          }
          if (shouldInclude("processos")) {
            dashboardData.push(["Total de Processos", processes.length.toString()]);
          }
          if (shouldInclude("emprestimos")) {
            const loansTotal = loans.reduce((sum: number, l: any) => sum + (Number(l.amount) || 0), 0);
            dashboardData.push(["Total de Empréstimos", formatCurrency(loansTotal)]);
          }
          if (shouldInclude("aplicacoes")) {
            const appsTotal = applications.reduce((sum: number, a: any) => sum + (Number(a.amount) || 0), 0);
            dashboardData.push(["Total de Aplicações", formatCurrency(appsTotal)]);
          }
          if (shouldInclude("leads")) {
            dashboardData.push(["Total de Leads", leads.length.toString()]);
          }

          // Adicionar a tabela do dashboard
          if (dashboardData.length > 0) {
            const dashboardColor = getNextColor();
            autoTable(doc, {
              startY: yPosition,
              head: [["Item", "Valor"]],
              body: dashboardData,
              theme: "striped",
              headStyles: { fillColor: dashboardColor, textColor: 255, fontStyle: "bold" },
              styles: { fontSize: 10 },
              margin: { left: margin, right: margin },
            });

            yPosition = (doc as any).lastAutoTable.finalY + 15;
          } else {
            // Se não houver dados, adicionar mensagem
            doc.setFontSize(12);
            doc.setFont("helvetica", "normal");
            doc.text("Nenhum dado disponível para o resumo executivo com os módulos selecionados.", margin, yPosition);
            yPosition += 10;
          }
        } else {
          // Se nenhum módulo estiver selecionado, adicionar mensagem
          doc.setFontSize(16);
          doc.setFont("helvetica", "bold");
          doc.text("RESUMO EXECUTIVO", margin, yPosition);
          yPosition += 10;
          doc.setFontSize(12);
          doc.setFont("helvetica", "normal");
          doc.text("Nenhum módulo selecionado. Selecione pelo menos um módulo para gerar o resumo.", margin, yPosition);
          yPosition += 10;
        }
      }

      // Receitas
      if (shouldInclude("receitas") && revenues.length > 0) {
        if (yPosition > pageHeight - 80) {
          doc.addPage();
          yPosition = margin;
        }
        doc.setFontSize(14);
        doc.setFont("helvetica", "bold");
        doc.text("RECEITAS", margin, yPosition);
        yPosition += 8;

        const revenueData = revenues.slice(0, 100).map((r: any) => [
          r.date ? format(new Date(r.date), "dd/MM/yyyy", { locale: ptBR }) : "",
          (r.description || "").substring(0, 40),
          r.category || "",
          formatCurrency(Number(r.amount) || 0),
        ]);

        const revenueColor = getNextColor();
        autoTable(doc, {
          startY: yPosition,
          head: [["Data", "Descrição", "Categoria", "Valor"]],
          body: revenueData,
          theme: "striped",
          headStyles: { fillColor: revenueColor, textColor: 255, fontStyle: "bold" },
          styles: { fontSize: 8 },
          margin: { left: margin, right: margin },
        });

        yPosition = (doc as any).lastAutoTable.finalY + 15;
      }

      // Despesas
      if (shouldInclude("despesas") && expenses.length > 0) {
        if (yPosition > pageHeight - 80) {
          doc.addPage();
          yPosition = margin;
        }
        doc.setFontSize(14);
        doc.setFont("helvetica", "bold");
        doc.text("DESPESAS", margin, yPosition);
        yPosition += 8;

        const expenseData = expenses.slice(0, 100).map((e: any) => [
          e.date ? format(new Date(e.date), "dd/MM/yyyy", { locale: ptBR }) : "",
          (e.description || "").substring(0, 40),
          e.category || "",
          formatCurrency(Number(e.amount) || 0),
        ]);

        const expenseColor = getNextColor();
        autoTable(doc, {
          startY: yPosition,
          head: [["Data", "Descrição", "Categoria", "Valor"]],
          body: expenseData,
          theme: "striped",
          headStyles: { fillColor: expenseColor, textColor: 255, fontStyle: "bold" },
          styles: { fontSize: 8 },
          margin: { left: margin, right: margin },
        });

        yPosition = (doc as any).lastAutoTable.finalY + 15;
      }

      // Tarefas
      if (shouldInclude("tarefas") && tasks.length > 0) {
        if (yPosition > pageHeight - 80) {
          doc.addPage();
          yPosition = margin;
        }
        doc.setFontSize(14);
        doc.setFont("helvetica", "bold");
        doc.text("TAREFAS", margin, yPosition);
        yPosition += 8;

        const taskData = tasks.slice(0, 100).map((t: any) => [
          t.due_date ? format(new Date(t.due_date), "dd/MM/yyyy", { locale: ptBR }) : "",
          (t.title || "").substring(0, 40),
          t.category || "",
          t.completed ? "Concluída" : "Pendente",
          t.priority || "",
        ]);

        const taskColor = getNextColor();
        autoTable(doc, {
          startY: yPosition,
          head: [["Data Vencimento", "Título", "Categoria", "Status", "Prioridade"]],
          body: taskData,
          theme: "striped",
          headStyles: { fillColor: taskColor, textColor: 255, fontStyle: "bold" },
          styles: { fontSize: 8 },
          margin: { left: margin, right: margin },
        });

        yPosition = (doc as any).lastAutoTable.finalY + 15;
      }

      // Imóveis
      if (shouldInclude("imoveis") && properties.length > 0) {
        if (yPosition > pageHeight - 80) {
          doc.addPage();
          yPosition = margin;
        }
        doc.setFontSize(14);
        doc.setFont("helvetica", "bold");
        doc.text("IMÓVEIS", margin, yPosition);
        yPosition += 8;

        const propertyData = properties.map((p: any) => [
          (p.address || "").substring(0, 30),
          p.city || "",
          p.documentation_status || "",
          p.is_rental ? "SIM" : "NÃO",
          formatCurrency(Number(p.venal_value) || 0),
        ]);

        const propertyColor = getNextColor();
        autoTable(doc, {
          startY: yPosition,
          head: [["Endereço", "Cidade", "Status Doc.", "Locação", "Valor Venal"]],
          body: propertyData,
          theme: "striped",
          headStyles: { fillColor: propertyColor, textColor: 255, fontStyle: "bold" },
          styles: { fontSize: 8 },
          margin: { left: margin, right: margin },
        });

        yPosition = (doc as any).lastAutoTable.finalY + 15;
      }

      // Clientes
      if (shouldInclude("clientes") && clients.length > 0) {
        if (yPosition > pageHeight - 80) {
          doc.addPage();
          yPosition = margin;
        }
        doc.setFontSize(14);
        doc.setFont("helvetica", "bold");
        doc.text("CLIENTES", margin, yPosition);
        yPosition += 8;

        const clientData = clients.map((c: any) => [
          (c.name || "").substring(0, 40),
          c.email || "",
          c.phone || "",
        ]);

        const clientColor = getNextColor();
        autoTable(doc, {
          startY: yPosition,
          head: [["Nome", "Email", "Telefone"]],
          body: clientData,
          theme: "striped",
          headStyles: { fillColor: clientColor, textColor: 255, fontStyle: "bold" },
          styles: { fontSize: 8 },
          margin: { left: margin, right: margin },
        });

        yPosition = (doc as any).lastAutoTable.finalY + 15;
      }

      // Empréstimos
      if (shouldInclude("emprestimos") && loans.length > 0) {
        if (yPosition > pageHeight - 80) {
          doc.addPage();
          yPosition = margin;
        }
        doc.setFontSize(14);
        doc.setFont("helvetica", "bold");
        doc.text("EMPRÉSTIMOS", margin, yPosition);
        yPosition += 8;

        const loanData = loans.map((l: any) => [
          (l.description || "").substring(0, 40),
          l.type === "loan_given" ? "Emprestado" : "Recebido",
          formatCurrency(Number(l.amount) || 0),
          l.due_date ? format(new Date(l.due_date), "dd/MM/yyyy", { locale: ptBR }) : "",
        ]);

        const loanColor = getNextColor();
        autoTable(doc, {
          startY: yPosition,
          head: [["Descrição", "Tipo", "Valor", "Vencimento"]],
          body: loanData,
          theme: "striped",
          headStyles: { fillColor: loanColor, textColor: 255, fontStyle: "bold" },
          styles: { fontSize: 8 },
          margin: { left: margin, right: margin },
        });

        yPosition = (doc as any).lastAutoTable.finalY + 15;
      }

      // Aplicações
      if (shouldInclude("aplicacoes") && applications.length > 0) {
        if (yPosition > pageHeight - 80) {
          doc.addPage();
          yPosition = margin;
        }
        doc.setFontSize(14);
        doc.setFont("helvetica", "bold");
        doc.text("APLICAÇÕES", margin, yPosition);
        yPosition += 8;

        const appData = applications.map((a: any) => [
          (a.description || "").substring(0, 40),
          a.institution || "",
          formatCurrency(Number(a.amount) || 0),
          a.maturity_date ? format(new Date(a.maturity_date), "dd/MM/yyyy", { locale: ptBR }) : "",
        ]);

        const appColor = getNextColor();
        autoTable(doc, {
          startY: yPosition,
          head: [["Descrição", "Instituição", "Valor", "Vencimento"]],
          body: appData,
          theme: "striped",
          headStyles: { fillColor: appColor, textColor: 255, fontStyle: "bold" },
          styles: { fontSize: 8 },
          margin: { left: margin, right: margin },
        });

        yPosition = (doc as any).lastAutoTable.finalY + 15;
      }

      // Leads
      if (shouldInclude("leads") && leads.length > 0) {
        if (yPosition > pageHeight - 80) {
          doc.addPage();
          yPosition = margin;
        }
        doc.setFontSize(14);
        doc.setFont("helvetica", "bold");
        doc.text("LEADS", margin, yPosition);
        yPosition += 8;

        const leadData = leads.map((l: any) => [
          (l.name || "").substring(0, 40),
          l.status || "",
          formatCurrency(Number(l.contract_value) || 0),
          l.start_date ? format(new Date(l.start_date), "dd/MM/yyyy", { locale: ptBR }) : "",
        ]);

        autoTable(doc, {
          startY: yPosition,
          head: [["Nome", "Status", "Valor Contrato", "Data Início"]],
          body: leadData,
          theme: "striped",
          headStyles: { fillColor: [63, 81, 181], textColor: 255, fontStyle: "bold" },
          styles: { fontSize: 8 },
          margin: { left: margin, right: margin },
        });
      }

      // Coletar dados dos gráficos se includeDashboard for true
      const chartsData: any = {};
      if (includeDashboard === true) {
        // Buscar dados agregados para os gráficos
        // SEMPRE coletar dados dos módulos selecionados, independente dos filtros de visualização
        const chartQueries: Promise<any>[] = [];
        
        if (shouldInclude("receitas")) {
          chartQueries.push(
            Promise.resolve(
              supabase
                .from("revenue")
                .select("category, amount")
                .gte("date", reportDateRange.start)
                .lte("date", reportDateRange.end)
            )
          );
        }
        if (shouldInclude("despesas")) {
          chartQueries.push(
            Promise.resolve(
              supabase
                .from("expenses")
                .select("category, amount")
                .gte("date", reportDateRange.start)
                .lte("date", reportDateRange.end)
            )
          );
        }
        if (shouldInclude("tarefas")) {
          chartQueries.push(
            Promise.resolve(
              supabase
                .from("reminders")
                .select("completed, category")
                .gte("created_at", reportDateRange.start)
                .lte("created_at", reportDateRange.end)
            )
          );
        }
        if (shouldInclude("imoveis")) {
          chartQueries.push(
            Promise.resolve(
              supabase
                .from("properties")
                .select("city, documentation_status, is_rental")
            )
          );
        }
        if (shouldInclude("gado")) {
          chartQueries.push(
            Promise.resolve(
              supabase
                .from("cattle")
                .select("category, quantity, health_status")
            )
          );
        }
        if (shouldInclude("clientes")) {
          chartQueries.push(
            Promise.resolve(
              supabase
                .from("clients")
                .select("type")
            )
          );
        }
        if (shouldInclude("processos")) {
          chartQueries.push(
            Promise.resolve(
              supabase
                .from("legal_processes")
                .select("status")
            )
          );
        }
        if (shouldInclude("leads")) {
          chartQueries.push(
            Promise.resolve(
              supabase
                .from("leads")
                .select("status")
            )
          );
        }

        if (chartQueries.length > 0) {
          const chartResults = await Promise.all(chartQueries);
          let chartIndex = 0;

          // Receitas por Categoria
          if (shouldInclude("receitas") && chartResults[chartIndex]?.data) {
            const revenueChartData = chartResults[chartIndex++].data;
            const revenueByCat = revenueChartData.reduce((acc: any, item: any) => {
              const cat = item.category || "Sem categoria";
              if (!acc[cat]) acc[cat] = 0;
              acc[cat] += Number(item.amount) || 0;
              return acc;
            }, {});

            if (Object.keys(revenueByCat).length > 0) {
              chartsData["Receitas por Categoria"] = [
                ["Categoria", "Valor Total"],
                ...Object.entries(revenueByCat)
                  .map(([cat, amount]: [string, any]) => [cat, formatCurrency(amount)])
                  .sort((a, b) => {
                    const valA = parseFloat((b[1] as string).replace(/[^\d,]/g, "").replace(",", "."));
                    const valB = parseFloat((a[1] as string).replace(/[^\d,]/g, "").replace(",", "."));
                    return valA - valB;
                  }),
              ];
            }
          }

          // Despesas por Categoria
          if (shouldInclude("despesas") && chartResults[chartIndex]?.data) {
            const expenseChartData = chartResults[chartIndex++].data;
            const expenseByCat = expenseChartData.reduce((acc: any, item: any) => {
              const cat = item.category || "Sem categoria";
              if (!acc[cat]) acc[cat] = 0;
              acc[cat] += Number(item.amount) || 0;
              return acc;
            }, {});

            if (Object.keys(expenseByCat).length > 0) {
              chartsData["Despesas por Categoria"] = [
                ["Categoria", "Valor Total"],
                ...Object.entries(expenseByCat)
                  .map(([cat, amount]: [string, any]) => [cat, formatCurrency(amount)])
                  .sort((a, b) => {
                    const valA = parseFloat((b[1] as string).replace(/[^\d,]/g, "").replace(",", "."));
                    const valB = parseFloat((a[1] as string).replace(/[^\d,]/g, "").replace(",", "."));
                    return valA - valB;
                  }),
              ];
            }
          }

          // Tarefas por Status
          if (shouldInclude("tarefas") && chartResults[chartIndex]?.data) {
            const taskChartData = chartResults[chartIndex++].data;
            const taskByStatus = taskChartData.reduce((acc: any, item: any) => {
              const status = item.completed ? "Concluídas" : "Pendentes";
              if (!acc[status]) acc[status] = 0;
              acc[status]++;
              return acc;
            }, {});

            if (Object.keys(taskByStatus).length > 0) {
              chartsData["Tarefas por Status"] = [
                ["Status", "Quantidade"],
                ...Object.entries(taskByStatus).map(([status, count]: [string, any]) => [
                  status,
                  count.toString()
                ]),
              ];
            }
          }

          // Imóveis por Cidade
          if (shouldInclude("imoveis") && chartResults[chartIndex]?.data) {
            const propertyChartData = chartResults[chartIndex++].data;
            const propertyByCity = propertyChartData.reduce((acc: any, item: any) => {
              const city = item.city || "Não informado";
              if (!acc[city]) acc[city] = 0;
              acc[city]++;
              return acc;
            }, {});

            if (Object.keys(propertyByCity).length > 0) {
              chartsData["Imóveis por Cidade"] = [
                ["Cidade", "Quantidade"],
                ...Object.entries(propertyByCity)
                  .map(([city, count]: [string, any]) => [city, count.toString()])
                  .sort((a, b) => Number(b[1]) - Number(a[1]))
                  .slice(0, 10),
              ];
            }
          }

          // Gado por Categoria
          if (shouldInclude("gado") && chartResults[chartIndex]?.data) {
            const cattleChartData = chartResults[chartIndex++].data;
            const cattleByCat = cattleChartData.reduce((acc: any, item: any) => {
              const cat = item.category || "Sem categoria";
              const qty = parseInt(item.quantity) || 0;
              if (!acc[cat]) acc[cat] = 0;
              acc[cat] += qty;
              return acc;
            }, {});

            if (Object.keys(cattleByCat).length > 0) {
              chartsData["Gado por Categoria"] = [
                ["Categoria", "Quantidade"],
                ...Object.entries(cattleByCat)
                  .map(([cat, count]: [string, any]) => [cat, count.toString()])
                  .sort((a, b) => Number(b[1]) - Number(a[1])),
              ];
            }
          }

          // Clientes por Tipo
          if (shouldInclude("clientes") && chartResults[chartIndex]?.data) {
            const clientChartData = chartResults[chartIndex++].data;
            const clientByType = clientChartData.reduce((acc: any, item: any) => {
              const type = item.type || "Não informado";
              if (!acc[type]) acc[type] = 0;
              acc[type]++;
              return acc;
            }, {});

            if (Object.keys(clientByType).length > 0) {
              chartsData["Clientes por Tipo"] = [
                ["Tipo", "Quantidade"],
                ...Object.entries(clientByType).map(([type, count]: [string, any]) => [
                  type,
                  count.toString()
                ]),
              ];
            }
          }

          // Processos por Status
          if (shouldInclude("processos") && chartResults[chartIndex]?.data) {
            const processChartData = chartResults[chartIndex++].data;
            const processByStatus = processChartData.reduce((acc: any, item: any) => {
              const status = item.status || "Não informado";
              if (!acc[status]) acc[status] = 0;
              acc[status]++;
              return acc;
            }, {});

            if (Object.keys(processByStatus).length > 0) {
              chartsData["Processos por Status"] = [
                ["Status", "Quantidade"],
                ...Object.entries(processByStatus).map(([status, count]: [string, any]) => [
                  status,
                  count.toString()
                ]),
              ];
            }
          }

          // Leads por Status
          if (shouldInclude("leads") && chartResults[chartIndex]?.data) {
            const leadChartData = chartResults[chartIndex++].data;
            const leadByStatus = leadChartData.reduce((acc: any, item: any) => {
              const status = item.status || "Não informado";
              if (!acc[status]) acc[status] = 0;
              acc[status]++;
              return acc;
            }, {});

            if (Object.keys(leadByStatus).length > 0) {
              chartsData["Leads por Status"] = [
                ["Status", "Quantidade"],
                ...Object.entries(leadByStatus).map(([status, count]: [string, any]) => [
                  status,
                  count.toString()
                ]),
              ];
            }
          }
        }
      }

      // Preparar dados para salvar no banco
      const reportDataToSave: any = {
        dashboard: dashboardData.length > 0 ? dashboardData : null,
        modules: {},
        charts: chartsData,
      };

      // Adicionar dados dos módulos
      if (shouldInclude("receitas") && revenues.length > 0) {
        reportDataToSave.modules.receitas = [
          ["Data", "Descrição", "Categoria", "Valor"],
          ...revenues.slice(0, 100).map((r: any) => [
            r.date ? format(new Date(r.date), "dd/MM/yyyy", { locale: ptBR }) : "",
            (r.description || "").substring(0, 40),
            r.category || "",
            formatCurrency(Number(r.amount) || 0),
          ]),
        ];
      }
      if (shouldInclude("despesas") && expenses.length > 0) {
        reportDataToSave.modules.despesas = [
          ["Data", "Descrição", "Categoria", "Valor"],
          ...expenses.slice(0, 100).map((e: any) => [
            e.date ? format(new Date(e.date), "dd/MM/yyyy", { locale: ptBR }) : "",
            (e.description || "").substring(0, 40),
            e.category || "",
            formatCurrency(Number(e.amount) || 0),
          ]),
        ];
      }
      if (shouldInclude("tarefas") && tasks.length > 0) {
        reportDataToSave.modules.tarefas = [
          ["Data Vencimento", "Título", "Categoria", "Status", "Prioridade"],
          ...tasks.slice(0, 100).map((t: any) => [
            t.due_date ? format(new Date(t.due_date), "dd/MM/yyyy", { locale: ptBR }) : "",
            (t.title || "").substring(0, 40),
            t.category || "",
            t.completed ? "Concluída" : "Pendente",
            t.priority || "",
          ]),
        ];
      }
      if (shouldInclude("imoveis") && properties.length > 0) {
        reportDataToSave.modules.imoveis = [
          ["Endereço", "Cidade", "Status Doc.", "Locação", "Valor Venal"],
          ...properties.map((p: any) => [
            (p.address || "").substring(0, 30),
            p.city || "",
            p.documentation_status || "",
            p.is_rental ? "SIM" : "NÃO",
            formatCurrency(Number(p.venal_value) || 0),
          ]),
        ];
      }
      if (shouldInclude("clientes") && clients.length > 0) {
        reportDataToSave.modules.clientes = [
          ["Nome", "Email", "Telefone"],
          ...clients.map((c: any) => [
            (c.name || "").substring(0, 40),
            c.email || "",
            c.phone || "",
          ]),
        ];
      }
      if (shouldInclude("emprestimos") && loans.length > 0) {
        reportDataToSave.modules.emprestimos = [
          ["Descrição", "Tipo", "Valor", "Vencimento"],
          ...loans.map((l: any) => [
            (l.description || "").substring(0, 40),
            l.type === "loan_given" ? "Emprestado" : "Recebido",
            formatCurrency(Number(l.amount) || 0),
            l.due_date ? format(new Date(l.due_date), "dd/MM/yyyy", { locale: ptBR }) : "",
          ]),
        ];
      }
      if (shouldInclude("aplicacoes") && applications.length > 0) {
        reportDataToSave.modules.aplicacoes = [
          ["Descrição", "Instituição", "Valor", "Vencimento"],
          ...applications.map((a: any) => [
            (a.description || "").substring(0, 40),
            a.institution || "",
            formatCurrency(Number(a.amount) || 0),
            a.maturity_date ? format(new Date(a.maturity_date), "dd/MM/yyyy", { locale: ptBR }) : "",
          ]),
        ];
      }
      if (shouldInclude("leads") && leads.length > 0) {
        reportDataToSave.modules.leads = [
          ["Nome", "Status", "Valor Contrato", "Data Início"],
          ...leads.map((l: any) => [
            (l.name || "").substring(0, 40),
            l.status || "",
            formatCurrency(Number(l.contract_value) || 0),
            l.start_date ? format(new Date(l.start_date), "dd/MM/yyyy", { locale: ptBR }) : "",
          ]),
        ];
      }

      // Adicionar gráficos ao PDF se includeDashboard for true (AO FINAL DO RELATÓRIO)
      if (includeDashboard === true) {
        // Verificar se há gráficos para adicionar
        const chartKeys = Object.keys(chartsData);
        console.log("📊 Adicionando gráficos ao final do relatório. Total de gráficos:", chartKeys.length);
        console.log("📊 Gráficos disponíveis:", chartKeys);
        
        if (chartKeys.length > 0) {
          // Adicionar nova página para os gráficos (ao final do relatório)
          doc.addPage();
          yPosition = margin;

          // Título da seção de gráficos
          doc.setFontSize(18);
          doc.setFont("helvetica", "bold");
          doc.setTextColor(33, 150, 243);
          doc.text("GRÁFICOS E DASHBOARDS", pageWidth / 2, yPosition, { align: "center" });
          yPosition += 10;
          
          doc.setFontSize(12);
          doc.setFont("helvetica", "normal");
          doc.setTextColor(100, 100, 100);
          doc.text("Análises visuais dos dados dos módulos selecionados", pageWidth / 2, yPosition, { align: "center" });
          yPosition += 15;

          // Adicionar cada gráfico como tabela
          Object.entries(chartsData).forEach(([chartName, chartData]: [string, any], index: number) => {
            if (!chartData || !Array.isArray(chartData) || chartData.length === 0) {
              console.log(`⚠️ Gráfico ${chartName} está vazio ou inválido`);
              return;
            }

            // Verificar se precisa de nova página
            if (yPosition > pageHeight - 100) {
              doc.addPage();
              yPosition = margin;
            }

            // Título do gráfico
            doc.setFontSize(14);
            doc.setFont("helvetica", "bold");
            doc.setTextColor(0, 0, 0);
            doc.text(chartName.toUpperCase(), margin, yPosition);
            yPosition += 8;

            // Adicionar tabela com os dados do gráfico
            const headers = chartData[0] || [];
            const rows = chartData.slice(1) || [];

            console.log(`✅ Adicionando gráfico ${index + 1}/${chartKeys.length}: ${chartName} (${headers.length} colunas, ${rows.length} linhas)`);

            if (rows.length > 0) {
              const chartColor = getNextColor();
              autoTable(doc, {
                startY: yPosition,
                head: [headers],
                body: rows,
                theme: "striped",
                headStyles: { fillColor: chartColor, textColor: 255, fontStyle: "bold" },
                styles: { fontSize: 9 },
                margin: { left: margin, right: margin },
              });

              yPosition = (doc as any).lastAutoTable.finalY + 15;
            } else {
              doc.setFontSize(10);
              doc.setFont("helvetica", "normal");
              doc.text("Nenhum dado disponível para este gráfico.", margin, yPosition);
              yPosition += 10;
            }
          });
          
          console.log("✅ Todos os gráficos foram adicionados ao PDF com sucesso!");
        } else {
          // Se não houver gráficos, adicionar mensagem informativa
          doc.addPage();
          yPosition = margin;
          doc.setFontSize(16);
          doc.setFont("helvetica", "bold");
          doc.setTextColor(0, 0, 0);
          doc.text("GRÁFICOS E DASHBOARDS", pageWidth / 2, yPosition, { align: "center" });
          yPosition += 15;
          doc.setFontSize(12);
          doc.setFont("helvetica", "normal");
          doc.text("Nenhum gráfico disponível com os módulos selecionados.", margin, yPosition);
          console.log("Nenhum gráfico foi coletado. Módulos selecionados:", selectedModules);
        }
      }

      // Salvar relatório no banco de dados
      const reportTitle = `Relatório Completo - ${format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}`;
      const { error: saveError } = await (supabase as any)
        .from("saved_reports")
        .insert({
          title: reportTitle,
          report_type: "completo",
          period_filter: reportPeriodFilter,
          period_start: reportDateRange.startDate.toISOString().split('T')[0],
          period_end: reportDateRange.endDate.toISOString().split('T')[0],
          selected_modules: selectedModules,
          view_filters: viewFilters,
          report_data: reportDataToSave,
          orientation: reportOrientation,
          include_dashboard: includeDashboard,
        });

      if (saveError) {
        console.error("Erro ao salvar relatório:", saveError);
        // Continuar mesmo se houver erro ao salvar
      }

      const fileName = `Relatorio_Completo_${format(new Date(), "dd-MM-yyyy")}.pdf`;
      doc.save(fileName);

      toast({
        title: "Relatório completo gerado com sucesso!",
        description: "O PDF foi salvo no seu dispositivo e o relatório foi armazenado para visualização posterior.",
      });
      
      setFullReportDialogOpen(false);
    } catch (error: any) {
      toast({
        title: "Erro ao gerar relatório completo",
        description: error.message || "Ocorreu um erro ao gerar o PDF.",
        variant: "destructive",
      });
    }
  };

  // Formatar período para exibição
  const periodLabel = useMemo(() => {
    switch (periodFilter) {
      case "mes_atual":
        return format(dateRange.startDate, "MMMM 'de' yyyy", { locale: ptBR });
      case "mes_passado":
        return format(dateRange.startDate, "MMMM 'de' yyyy", { locale: ptBR });
      case "trimestre":
        return `${format(dateRange.startDate, "MMM", { locale: ptBR })} - ${format(dateRange.endDate, "MMM 'de' yyyy", { locale: ptBR })}`;
      case "semestre":
        return `${format(dateRange.startDate, "MMM", { locale: ptBR })} - ${format(dateRange.endDate, "MMM 'de' yyyy", { locale: ptBR })}`;
      case "ano":
        return format(dateRange.startDate, "yyyy", { locale: ptBR });
      case "personalizado":
        if (customDateRange.from && customDateRange.to) {
          return `${format(customDateRange.from, "dd/MM/yyyy", { locale: ptBR })} - ${format(customDateRange.to, "dd/MM/yyyy", { locale: ptBR })}`;
        }
        return "Período personalizado";
      default:
        return format(dateRange.startDate, "MMMM 'de' yyyy", { locale: ptBR });
    }
  }, [periodFilter, dateRange, customDateRange]);

  return (
    <div className="w-full max-w-full overflow-x-hidden px-1 sm:px-2 md:px-4">
      <PageHeader 
        title="Relatórios" 
        description="Análises detalhadas e visões gerais do seu negócio"
        showBackButton={false}
      />

      {/* Filtros de Período */}
      <Card className="mb-6 border-2 border-primary/20 shadow-elegant">
        <CardContent className="p-4 sm:p-6">
          <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
            <div className="flex items-center gap-3">
              <Filter className="w-5 h-5 text-primary" />
              <div>
                <Label className="text-sm font-semibold text-foreground">Período:</Label>
                <p className="text-xs text-muted-foreground mt-1">
                  {periodLabel}
                </p>
              </div>
            </div>
            <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
              <Select value={periodFilter} onValueChange={(value: any) => setPeriodFilter(value)}>
                <SelectTrigger className="w-full sm:w-[200px]">
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
              
              {periodFilter === "personalizado" && (
                <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "w-full sm:w-[200px] justify-start text-left font-normal",
                          !customDateRange.from && "text-muted-foreground"
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {customDateRange.from ? (
                          format(customDateRange.from, "dd/MM/yyyy", { locale: ptBR })
                        ) : (
                          <span>Data inicial</span>
                        )}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={customDateRange.from}
                        onSelect={(date) => setCustomDateRange({ ...customDateRange, from: date })}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "w-full sm:w-[200px] justify-start text-left font-normal",
                          !customDateRange.to && "text-muted-foreground"
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {customDateRange.to ? (
                          format(customDateRange.to, "dd/MM/yyyy", { locale: ptBR })
                        ) : (
                          <span>Data final</span>
                        )}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={customDateRange.to}
                        onSelect={(date) => setCustomDateRange({ ...customDateRange, to: date })}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Cards de Resumo */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 md:gap-6 mb-6">
        <Card 
          className="border-0 shadow-elegant hover:shadow-elegant-lg transition-all duration-300 bg-gradient-card cursor-pointer hover:scale-[1.02] active:scale-[0.98]"
          onClick={() => setRevenueDialogOpen(true)}
        >
          <CardHeader className="pb-2 sm:pb-3 px-4 sm:px-6 pt-4 sm:pt-6">
            <CardTitle className="text-xs sm:text-sm font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
              <TrendingUp className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-success" />
              Total Receitas
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 sm:px-6 pb-4 sm:pb-6">
            <p className="text-xl sm:text-2xl md:text-3xl font-bold tracking-tight text-success break-all overflow-wrap-anywhere" style={{ wordBreak: 'break-word', overflowWrap: 'anywhere' }}>{formatCurrency(totalRevenue || 0)}</p>
            <p className="text-[10px] sm:text-xs text-muted-foreground mt-2 font-medium">
              Período: {periodLabel}
            </p>
          </CardContent>
        </Card>

        <Card 
          className="border-0 shadow-elegant hover:shadow-elegant-lg transition-all duration-300 bg-gradient-card cursor-pointer hover:scale-[1.02] active:scale-[0.98]"
          onClick={() => setExpenseDialogOpen(true)}
        >
          <CardHeader className="pb-2 sm:pb-3 px-4 sm:px-6 pt-4 sm:pt-6">
            <CardTitle className="text-xs sm:text-sm font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
              <TrendingDown className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-destructive" />
              Total Despesas
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 sm:px-6 pb-4 sm:pb-6">
            <p className="text-xl sm:text-2xl md:text-3xl font-bold tracking-tight text-destructive break-all overflow-wrap-anywhere" style={{ wordBreak: 'break-word', overflowWrap: 'anywhere' }}>{formatCurrency(totalExpenses || 0)}</p>
            <p className="text-[10px] sm:text-xs text-muted-foreground mt-2 font-medium">
              Período: {periodLabel}
            </p>
          </CardContent>
        </Card>

        <Card 
          className="border-0 shadow-elegant hover:shadow-elegant-lg transition-all duration-300 bg-gradient-card cursor-pointer hover:scale-[1.02] active:scale-[0.98]"
          onClick={() => setBalanceDialogOpen(true)}
        >
          <CardHeader className="pb-2 sm:pb-3 px-4 sm:px-6 pt-4 sm:pt-6">
            <CardTitle className="text-xs sm:text-sm font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
              <DollarSign className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-primary" />
              Saldo
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 sm:px-6 pb-4 sm:pb-6">
            <p className={`text-xl sm:text-2xl md:text-3xl font-bold tracking-tight break-all overflow-wrap-anywhere ${saldo >= 0 ? 'text-success' : 'text-destructive'}`} style={{ wordBreak: 'break-word', overflowWrap: 'anywhere' }}>
              {formatCurrency(saldo)}
            </p>
            <p className="text-[10px] sm:text-xs text-muted-foreground mt-2 font-medium">
              Período: {periodLabel}
            </p>
          </CardContent>
        </Card>

        <Card 
          className="border-0 shadow-elegant hover:shadow-elegant-lg transition-all duration-300 bg-gradient-card cursor-pointer hover:scale-[1.02] active:scale-[0.98]"
          onClick={() => setPropertiesDialogOpen(true)}
        >
          <CardHeader className="pb-2 sm:pb-3 px-4 sm:px-6 pt-4 sm:pt-6">
            <CardTitle className="text-xs sm:text-sm font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
              <Building2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-primary" />
              Total Imóveis
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 sm:px-6 pb-4 sm:pb-6">
            <p className="text-xl sm:text-2xl md:text-3xl font-bold tracking-tight">{totalProperties || 0}</p>
          </CardContent>
        </Card>
      </div>

      {/* Botões de Exportação e Filtros */}
      <div className="flex flex-wrap gap-3 mb-6">
        <Button 
          onClick={() => setViewFiltersDialogOpen(true)} 
          variant="outline"
          className="gap-2 shadow-sm hover:shadow-elegant border-primary/30 hover:border-primary"
        >
          <Filter className="w-4 h-4" />
          <span className="hidden sm:inline">Filtros de Visualização</span>
          <span className="sm:hidden">Filtros</span>
        </Button>
        <Button 
          onClick={() => setFullReportDialogOpen(true)} 
          className="gap-2 shadow-elegant hover:shadow-elegant-lg bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70"
        >
          <FileText className="w-4 h-4" />
          <span className="hidden sm:inline">Relatório Completo PDF</span>
          <span className="sm:hidden">Relatório PDF</span>
        </Button>
        <Button 
          onClick={handleExportPDF} 
          className="gap-2 shadow-elegant hover:shadow-elegant-lg bg-primary hover:bg-primary/90"
        >
          <FileText className="w-4 h-4" />
          <span className="hidden sm:inline">Exportar PDF</span>
          <span className="sm:hidden">PDF</span>
        </Button>
        <Button 
          onClick={handleExportExcel} 
          variant="outline" 
          className="gap-2 shadow-sm hover:shadow-elegant border-primary/30 hover:border-primary"
        >
          <Download className="w-4 h-4" />
          <span className="hidden sm:inline">Exportar Excel</span>
          <span className="sm:hidden">Excel</span>
        </Button>
      </div>

      {/* Gráficos */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Receitas vs Despesas */}
        <Card className="border-0 shadow-elegant">
          <CardHeader className="pb-4">
            <CardTitle className="text-xl font-bold tracking-tight flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-primary" />
              Receitas vs Despesas
            </CardTitle>
            <p className="text-xs text-muted-foreground mt-1 font-medium">
              Período: {periodLabel}
            </p>
          </CardHeader>
          <CardContent className="px-3 sm:px-6 pb-4 sm:pb-6">
            <div className="flex flex-col items-center w-full overflow-visible">
              <ResponsiveContainer width="100%" height={(typeof window !== 'undefined' && window.innerWidth < 640) ? 280 : 320}>
                <AreaChart data={revenueVsExpenses || []} margin={{ top: 5, right: 10, left: 0, bottom: (typeof window !== 'undefined' && window.innerWidth < 640) ? 80 : 60 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted/30" />
                  <XAxis 
                    dataKey="month" 
                    className="text-xs"
                    tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: (typeof window !== 'undefined' && window.innerWidth < 640) ? 10 : 12 }}
                    angle={(typeof window !== 'undefined' && window.innerWidth < 640) ? -45 : 0}
                    textAnchor={(typeof window !== 'undefined' && window.innerWidth < 640) ? "end" : "middle"}
                    height={(typeof window !== 'undefined' && window.innerWidth < 640) ? 60 : 30}
                  />
                  <YAxis 
                    className="text-xs"
                    tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: (typeof window !== 'undefined' && window.innerWidth < 640) ? 10 : 12 }}
                    tickFormatter={(value) => `R$ ${(value / 1000).toFixed(0)}k`}
                    width={(typeof window !== 'undefined' && window.innerWidth < 640) ? 50 : 60}
                  />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'hsl(var(--popover))', 
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '0.75rem',
                      padding: '8px 12px',
                      fontSize: (typeof window !== 'undefined' && window.innerWidth < 640) ? '11px' : '13px'
                    }}
                    formatter={(value: any) => formatCurrency(value)}
                    labelStyle={{ fontWeight: 'bold', marginBottom: '4px' }}
                  />
                  <Area 
                    type="monotone" 
                    dataKey="receitas" 
                    stackId="1"
                    stroke="hsl(var(--success))" 
                    fill="hsl(var(--success))" 
                    fillOpacity={0.6}
                    name="Receitas"
                  />
                  <Area 
                    type="monotone" 
                    dataKey="despesas" 
                    stackId="1"
                    stroke="hsl(var(--destructive))" 
                    fill="hsl(var(--destructive))" 
                    fillOpacity={0.6}
                    name="Despesas"
                  />
                  <Legend 
                    verticalAlign="bottom"
                    height={(typeof window !== 'undefined' && window.innerWidth < 640) ? 50 : 40}
                    wrapperStyle={{ 
                      paddingTop: (typeof window !== 'undefined' && window.innerWidth < 640) ? '12px' : '8px',
                      paddingBottom: (typeof window !== 'undefined' && window.innerWidth < 640) ? '8px' : '0px',
                      fontSize: (typeof window !== 'undefined' && window.innerWidth < 640) ? '11px' : '13px',
                      display: 'flex',
                      justifyContent: 'center',
                      gap: (typeof window !== 'undefined' && window.innerWidth < 640) ? '16px' : '20px',
                      flexWrap: 'wrap',
                      width: '100%',
                      maxWidth: '100%',
                      overflow: 'visible'
                    }}
                    iconType="square"
                    iconSize={(typeof window !== 'undefined' && window.innerWidth < 640) ? 10 : 12}
                    formatter={(value) => (
                      <span style={{ 
                        fontSize: (typeof window !== 'undefined' && window.innerWidth < 640) ? '11px' : '13px',
                        fontWeight: '500',
                        color: 'hsl(var(--foreground))',
                        whiteSpace: 'normal',
                        wordBreak: 'break-word',
                        lineHeight: '1.5'
                      }}>
                        {value}
                      </span>
                    )}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Saldo Mensal */}
        <Card className="border-0 shadow-elegant">
          <CardHeader className="pb-3 sm:pb-4 px-3 sm:px-6">
            <CardTitle className="text-base sm:text-lg md:text-xl font-bold tracking-tight flex items-center gap-2">
              <TrendingUp className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
              <span className="text-sm sm:text-base md:text-lg">Saldo Mensal</span>
            </CardTitle>
            <p className="text-xs text-muted-foreground mt-1 font-medium">
              Período: {periodLabel}
            </p>
          </CardHeader>
          <CardContent className="px-3 sm:px-6 pb-4 sm:pb-6">
            <ResponsiveContainer width="100%" height={(typeof window !== 'undefined' && window.innerWidth < 640) ? 300 : 320}>
              <LineChart data={revenueVsExpenses || []} margin={{ top: 5, right: 10, left: 0, bottom: (typeof window !== 'undefined' && window.innerWidth < 640) ? 60 : 50 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted/30" />
                <XAxis 
                  dataKey="month" 
                  className="text-xs"
                  tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: (typeof window !== 'undefined' && window.innerWidth < 640) ? 10 : 12 }}
                  angle={(typeof window !== 'undefined' && window.innerWidth < 640) ? -45 : 0}
                  textAnchor={(typeof window !== 'undefined' && window.innerWidth < 640) ? "end" : "middle"}
                  height={(typeof window !== 'undefined' && window.innerWidth < 640) ? 60 : 30}
                />
                <YAxis 
                  className="text-xs"
                  tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: (typeof window !== 'undefined' && window.innerWidth < 640) ? 10 : 12 }}
                  tickFormatter={(value) => `R$ ${(value / 1000).toFixed(0)}k`}
                  width={(typeof window !== 'undefined' && window.innerWidth < 640) ? 50 : 60}
                />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: 'hsl(var(--popover))', 
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '0.75rem',
                    padding: '8px 12px',
                    fontSize: (typeof window !== 'undefined' && window.innerWidth < 640) ? '11px' : '13px'
                  }}
                  formatter={(value: any) => formatCurrency(value)}
                  labelStyle={{ fontWeight: 'bold', marginBottom: '4px' }}
                />
                <Line 
                  type="monotone" 
                  dataKey="saldo" 
                  stroke="hsl(var(--primary))" 
                  strokeWidth={(typeof window !== 'undefined' && window.innerWidth < 640) ? 2.5 : 3}
                  dot={{ fill: 'hsl(var(--primary))', r: (typeof window !== 'undefined' && window.innerWidth < 640) ? 3 : 4 }}
                  activeDot={{ r: (typeof window !== 'undefined' && window.innerWidth < 640) ? 5 : 6 }}
                  name="Saldo Mensal"
                />
                <Legend 
                  verticalAlign="bottom"
                  height={(typeof window !== 'undefined' && window.innerWidth < 640) ? 40 : 30}
                  wrapperStyle={{ 
                    paddingTop: (typeof window !== 'undefined' && window.innerWidth < 640) ? '12px' : '8px',
                    paddingBottom: (typeof window !== 'undefined' && window.innerWidth < 640) ? '8px' : '0px',
                    fontSize: (typeof window !== 'undefined' && window.innerWidth < 640) ? '11px' : '12px',
                    display: 'flex',
                    justifyContent: 'center',
                    width: '100%',
                    maxWidth: '100%',
                    overflow: 'visible'
                  }}
                  iconType="line"
                  iconSize={(typeof window !== 'undefined' && window.innerWidth < 640) ? 10 : 12}
                  formatter={(value) => (
                    <span style={{ 
                      fontSize: (typeof window !== 'undefined' && window.innerWidth < 640) ? '11px' : '12px', 
                      fontWeight: '500',
                      color: 'hsl(var(--foreground))',
                      whiteSpace: 'normal',
                      wordBreak: 'break-word',
                      lineHeight: '1.4'
                    }}>
                      {value}
                    </span>
                  )}
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Receitas por Categoria */}
        <Card className="border-0 shadow-elegant">
          <CardHeader className="pb-3 sm:pb-4 px-3 sm:px-6">
            <CardTitle className="text-base sm:text-lg md:text-xl font-bold tracking-tight flex items-center gap-2">
              <BarChart3 className="w-4 h-4 sm:w-5 sm:h-5 text-success" />
              <span className="text-sm sm:text-base md:text-lg">Receitas por Categoria</span>
            </CardTitle>
            <p className="text-xs text-muted-foreground mt-1 font-medium">
              Período: {periodLabel}
            </p>
          </CardHeader>
          <CardContent className="px-3 sm:px-6 pb-4 sm:pb-6">
            {revenueByCategory && revenueByCategory.length > 0 ? (
              <>
                <ResponsiveContainer width="100%" height={(typeof window !== 'undefined' && window.innerWidth < 640) ? 400 : (typeof window !== 'undefined' && window.innerWidth < 768) ? 450 : 500}>
                  <BarChart 
                    data={revenueByCategory} 
                    layout="vertical"
                    margin={{ top: 5, right: 30, left: (typeof window !== 'undefined' && window.innerWidth < 640) ? 80 : 120, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted/20" />
                    <XAxis 
                      type="number"
                      tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: (typeof window !== 'undefined' && window.innerWidth < 640) ? 10 : 12 }}
                      tickFormatter={(value) => `R$ ${(value / 1000).toFixed(0)}k`}
                    />
                    <YAxis 
                      type="category" 
                      dataKey="category" 
                      width={(typeof window !== 'undefined' && window.innerWidth < 640) ? 75 : 115}
                      tick={{ fill: 'hsl(var(--foreground))', fontSize: (typeof window !== 'undefined' && window.innerWidth < 640) ? 11 : 13, fontWeight: 600 }}
                      tickFormatter={(value) => value.length > 15 ? value.substring(0, 15) + '...' : value}
                    />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: 'hsl(var(--popover))', 
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '0.75rem',
                        padding: '10px 14px',
                        fontSize: (typeof window !== 'undefined' && window.innerWidth < 640) ? '12px' : '14px',
                        boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)'
                  }}
                      formatter={(value: any, name: string, props: any) => {
                        const total = revenueByCategory.reduce((sum: number, item: any) => sum + item.amount, 0);
                        const percent = total > 0 ? ((value / total) * 100).toFixed(1) : '0';
                        return [
                          `${formatCurrency(value)} (${percent}%)`,
                          'Valor'
                        ];
                      }}
                      labelFormatter={(label) => `Categoria: ${label}`}
                      labelStyle={{ fontWeight: 'bold', marginBottom: '6px', fontSize: (typeof window !== 'undefined' && window.innerWidth < 640) ? '13px' : '15px' }}
                    />
                    <Bar 
                      dataKey="amount" 
                      radius={[0, 8, 8, 0]}
                    >
                      {revenueByCategory.map((entry: any, index: number) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
                {/* Lista detalhada abaixo do gráfico */}
                <div className="mt-6 space-y-3 max-h-[300px] overflow-y-auto pr-2">
                  {revenueByCategory.map((item: any, index: number) => {
                    const total = revenueByCategory.reduce((sum: number, i: any) => sum + i.amount, 0);
                    const percent = total > 0 ? ((item.amount / total) * 100).toFixed(1) : '0';
                    return (
                      <div 
                        key={index} 
                        className="flex items-center justify-between p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors border border-border/50"
                      >
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                          <div 
                            className="w-4 h-4 rounded-full flex-shrink-0" 
                            style={{ backgroundColor: COLORS[index % COLORS.length] }}
                          />
                          <div className="flex-1 min-w-0">
                            <p className="font-semibold text-sm sm:text-base text-foreground truncate">
                              {item.category || "Sem categoria"}
                            </p>
                            <p className="text-xs text-muted-foreground">
                          {percent}% do total
                            </p>
                          </div>
                        </div>
                        <div className="text-right flex-shrink-0 ml-3">
                          <p className="font-bold text-sm sm:text-base text-success">
                            {formatCurrency(item.amount)}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            ) : (
              <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                <BarChart3 className="w-12 h-12 mb-4 opacity-50" />
                <p className="text-sm">Nenhuma receita cadastrada</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Despesas por Categoria */}
        <Card className="border-0 shadow-elegant">
          <CardHeader className="pb-3 sm:pb-4 px-3 sm:px-6">
            <CardTitle className="text-base sm:text-lg md:text-xl font-bold tracking-tight flex items-center gap-2">
              <BarChart3 className="w-4 h-4 sm:w-5 sm:h-5 text-destructive" />
              <span className="text-sm sm:text-base md:text-lg">Despesas por Categoria</span>
            </CardTitle>
            <p className="text-xs text-muted-foreground mt-1 font-medium">
              Período: {periodLabel}
            </p>
          </CardHeader>
          <CardContent className="px-3 sm:px-6 pb-4 sm:pb-6">
            {expensesByCategory && expensesByCategory.length > 0 ? (
              <>
                <ResponsiveContainer width="100%" height={(typeof window !== 'undefined' && window.innerWidth < 640) ? 400 : (typeof window !== 'undefined' && window.innerWidth < 768) ? 450 : 500}>
                  <BarChart 
                    data={expensesByCategory} 
                    layout="vertical"
                    margin={{ top: 5, right: 30, left: (typeof window !== 'undefined' && window.innerWidth < 640) ? 80 : 120, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted/20" />
                    <XAxis 
                      type="number"
                      tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: (typeof window !== 'undefined' && window.innerWidth < 640) ? 10 : 12 }}
                      tickFormatter={(value) => `R$ ${(value / 1000).toFixed(0)}k`}
                    />
                    <YAxis 
                      type="category" 
                      dataKey="category" 
                      width={(typeof window !== 'undefined' && window.innerWidth < 640) ? 75 : 115}
                      tick={{ fill: 'hsl(var(--foreground))', fontSize: (typeof window !== 'undefined' && window.innerWidth < 640) ? 11 : 13, fontWeight: 600 }}
                      tickFormatter={(value) => value.length > 15 ? value.substring(0, 15) + '...' : value}
                    />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: 'hsl(var(--popover))', 
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '0.75rem',
                        padding: '10px 14px',
                        fontSize: (typeof window !== 'undefined' && window.innerWidth < 640) ? '12px' : '14px',
                        boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)'
                  }}
                      formatter={(value: any, name: string, props: any) => {
                        const total = expensesByCategory.reduce((sum: number, item: any) => sum + item.amount, 0);
                        const percent = total > 0 ? ((value / total) * 100).toFixed(1) : '0';
                        return [
                          `${formatCurrency(value)} (${percent}%)`,
                          'Valor'
                        ];
                      }}
                      labelFormatter={(label) => `Categoria: ${label}`}
                      labelStyle={{ fontWeight: 'bold', marginBottom: '6px', fontSize: (typeof window !== 'undefined' && window.innerWidth < 640) ? '13px' : '15px' }}
                    />
                    <Bar 
                      dataKey="amount" 
                      radius={[0, 8, 8, 0]}
                    >
                      {expensesByCategory.map((entry: any, index: number) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
                {/* Lista detalhada abaixo do gráfico */}
                <div className="mt-6 space-y-3 max-h-[300px] overflow-y-auto pr-2">
                  {expensesByCategory.map((item: any, index: number) => {
                    const total = expensesByCategory.reduce((sum: number, i: any) => sum + i.amount, 0);
                    const percent = total > 0 ? ((item.amount / total) * 100).toFixed(1) : '0';
                    return (
                      <div 
                        key={index} 
                        className="flex items-center justify-between p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors border border-border/50"
                      >
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                          <div 
                            className="w-4 h-4 rounded-full flex-shrink-0" 
                            style={{ backgroundColor: COLORS[index % COLORS.length] }}
                          />
                          <div className="flex-1 min-w-0">
                            <p className="font-semibold text-sm sm:text-base text-foreground truncate">
                              {item.category || "Sem categoria"}
                            </p>
                            <p className="text-xs text-muted-foreground">
                          {percent}% do total
                            </p>
                          </div>
                        </div>
                        <div className="text-right flex-shrink-0 ml-3">
                          <p className="font-bold text-sm sm:text-base text-destructive">
                            {formatCurrency(item.amount)}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            ) : (
              <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                <BarChart3 className="w-12 h-12 mb-4 opacity-50" />
                <p className="text-sm">Nenhuma despesa cadastrada</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Gráfico de Barras - Receitas e Despesas Mensais */}
      <Card className="border-0 shadow-elegant mb-6">
        <CardHeader className="pb-3 sm:pb-4 px-3 sm:px-6">
          <CardTitle className="text-base sm:text-lg md:text-xl font-bold tracking-tight flex items-center gap-2">
            <BarChart3 className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
            <span className="text-sm sm:text-base md:text-lg">Análise Mensal Detalhada</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="px-3 sm:px-6 pb-3 sm:pb-6">
          <ResponsiveContainer width="100%" height={(typeof window !== 'undefined' && window.innerWidth < 640) ? 300 : 400}>
            <BarChart 
              data={revenueVsExpenses || []} 
              margin={{ top: 10, right: 10, left: 0, bottom: (typeof window !== 'undefined' && window.innerWidth < 640) ? 60 : 5 }}
              barCategoryGap="10%"
              barGap={8}
            >
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted/30" />
              <XAxis 
                dataKey="month" 
                className="text-xs"
                tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: (typeof window !== 'undefined' && window.innerWidth < 640) ? 10 : 12 }}
                angle={(typeof window !== 'undefined' && window.innerWidth < 640) ? -45 : 0}
                textAnchor={(typeof window !== 'undefined' && window.innerWidth < 640) ? "end" : "middle"}
                height={(typeof window !== 'undefined' && window.innerWidth < 640) ? 60 : 30}
              />
              <YAxis 
                className="text-xs"
                tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: (typeof window !== 'undefined' && window.innerWidth < 640) ? 10 : 12 }}
                tickFormatter={(value) => `R$ ${(value / 1000).toFixed(0)}k`}
                width={(typeof window !== 'undefined' && window.innerWidth < 640) ? 50 : 60}
              />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: 'hsl(var(--popover))', 
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '0.75rem',
                  padding: '8px 12px',
                  fontSize: (typeof window !== 'undefined' && window.innerWidth < 640) ? '11px' : '13px'
                }}
                formatter={(value: any, name: string) => {
                  const label = name === 'receitas' ? 'Receitas' : name === 'despesas' ? 'Despesas' : name;
                  return [formatCurrency(value), label];
                }}
                labelFormatter={(label) => `Mês: ${label}`}
                labelStyle={{ fontWeight: 'bold', marginBottom: '4px' }}
              />
              <Legend 
                wrapperStyle={{ 
                  paddingTop: '12px',
                  fontSize: (typeof window !== 'undefined' && window.innerWidth < 640) ? '11px' : '13px'
                }}
                iconType="square"
                iconSize={12}
                formatter={(value) => {
                  if (value === 'receitas') return 'Receitas';
                  if (value === 'despesas') return 'Despesas';
                  return value;
                }}
              />
              <Bar 
                dataKey="receitas" 
                fill="hsl(var(--success))" 
                name="Receitas" 
                radius={[6, 6, 0, 0]} 
                barSize={(typeof window !== 'undefined' && window.innerWidth < 640) ? 30 : 40}
              />
              <Bar 
                dataKey="despesas" 
                fill="hsl(var(--destructive))" 
                name="Despesas" 
                radius={[6, 6, 0, 0]} 
                barSize={(typeof window !== 'undefined' && window.innerWidth < 640) ? 30 : 40}
              />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Gráficos de Tarefas */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Tarefas por Status */}
        <Card className="border-0 shadow-elegant">
          <CardHeader className="pb-3 sm:pb-4 px-3 sm:px-6">
            <CardTitle className="text-base sm:text-lg md:text-xl font-bold tracking-tight flex items-center gap-2">
              <PieChart className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
              <span className="text-sm sm:text-base md:text-lg">Tarefas por Status</span>
            </CardTitle>
            <p className="text-xs text-muted-foreground mt-1 font-medium">
              Período: {periodLabel}
            </p>
          </CardHeader>
          <CardContent className="px-3 sm:px-6 pb-4 sm:pb-6">
            {tasksByStatus && tasksByStatus.length > 0 ? (
              <ResponsiveContainer width="100%" height={(typeof window !== 'undefined' && window.innerWidth < 640) ? 250 : 300}>
                <RechartsPieChart>
                  <Pie
                    data={tasksByStatus}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ status, percent }) => `${status}: ${(percent * 100).toFixed(0)}%`}
                    outerRadius={(typeof window !== 'undefined' && window.innerWidth < 640) ? 80 : 100}
                    fill="#8884d8"
                    dataKey="count"
                  >
                    {tasksByStatus.map((entry: any, index: number) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip 
                    formatter={(value: any) => [`${value} unidade(s)`, 'Quantidade']}
                    labelFormatter={(label) => {
                      if (propertiesByType?.find((p: any) => p.type === label)) return `Tipo: ${label}`;
                      if (tasksByStatus?.find((t: any) => t.status === label)) return `Status: ${label}`;
                      if (cattleByHealth?.find((c: any) => c.health === label)) return `Saúde: ${label}`;
                      if (clientsByType?.find((c: any) => c.type === label)) return `Tipo: ${label}`;
                      if (propertiesByDocStatus?.find((p: any) => p.status === label)) return `Status: ${label}`;
                      return label;
                    }}
                  />
                  <Legend 
                    formatter={(value) => value}
                  />
                </RechartsPieChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                <PieChart className="w-12 h-12 mb-4 opacity-50" />
                <p className="text-sm">Nenhuma tarefa cadastrada</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Tarefas por Categoria */}
        <Card className="border-0 shadow-elegant">
          <CardHeader className="pb-3 sm:pb-4 px-3 sm:px-6">
            <CardTitle className="text-base sm:text-lg md:text-xl font-bold tracking-tight flex items-center gap-2">
              <BarChart3 className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
              <span className="text-sm sm:text-base md:text-lg">Tarefas por Categoria</span>
            </CardTitle>
            <p className="text-xs text-muted-foreground mt-1 font-medium">
              Período: {periodLabel}
            </p>
          </CardHeader>
          <CardContent className="px-3 sm:px-6 pb-4 sm:pb-6">
            {tasksByCategory && tasksByCategory.length > 0 ? (
              <ResponsiveContainer width="100%" height={(typeof window !== 'undefined' && window.innerWidth < 640) ? 250 : 300}>
                <BarChart data={tasksByCategory} layout="vertical" margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis 
                    type="number" 
                    label={{ value: 'Quantidade', position: 'insideBottom', offset: -5 }}
                  />
                  <YAxis 
                    dataKey="category" 
                    type="category" 
                    width={100}
                    label={{ value: 'Categoria', angle: -90, position: 'insideLeft' }}
                  />
                  <Tooltip 
                    formatter={(value: any) => [`${value} tarefa(s)`, 'Quantidade']}
                    labelFormatter={(label) => `Categoria: ${label}`}
                  />
                  <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                    {tasksByCategory.map((entry: any, index: number) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Bar>
            </BarChart>
          </ResponsiveContainer>
            ) : (
              <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                <BarChart3 className="w-12 h-12 mb-4 opacity-50" />
                <p className="text-sm">Nenhuma tarefa cadastrada</p>
              </div>
            )}
        </CardContent>
      </Card>
      </div>

      {/* Gráficos de Imóveis */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        {/* Imóveis por Cidade */}
        <Card className="border-0 shadow-elegant">
          <CardHeader className="pb-3 sm:pb-4 px-3 sm:px-6">
            <CardTitle className="text-base sm:text-lg font-bold tracking-tight flex items-center gap-2">
              <Building2 className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
              <span className="text-sm sm:text-base">Imóveis por Cidade</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="px-3 sm:px-6 pb-4 sm:pb-6">
            {propertiesByCity && propertiesByCity.length > 0 ? (
              <ResponsiveContainer width="100%" height={(typeof window !== 'undefined' && window.innerWidth < 640) ? 250 : 300}>
                <BarChart data={propertiesByCity.slice(0, 10)} margin={{ top: 5, right: 30, left: 20, bottom: 60 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis 
                    dataKey="city" 
                    angle={-45} 
                    textAnchor="end" 
                    height={100}
                    label={{ value: 'Cidade', position: 'insideBottom', offset: -5 }}
                  />
                  <YAxis 
                    label={{ value: 'Quantidade', angle: -90, position: 'insideLeft' }}
                  />
                  <Tooltip 
                    formatter={(value: any) => [`${value} imóvel(is)`, 'Quantidade']}
                    labelFormatter={(label) => `Cidade: ${label}`}
                  />
                  <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                    {propertiesByCity.slice(0, 10).map((entry: any, index: number) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                <Building2 className="w-12 h-12 mb-4 opacity-50" />
                <p className="text-sm">Nenhum imóvel cadastrado</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Imóveis por Status de Documentação */}
        <Card className="border-0 shadow-elegant">
          <CardHeader className="pb-3 sm:pb-4 px-3 sm:px-6">
            <CardTitle className="text-base sm:text-lg font-bold tracking-tight flex items-center gap-2">
              <FileText className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
              <span className="text-sm sm:text-base">Status de Documentação</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="px-3 sm:px-6 pb-4 sm:pb-6">
            {propertiesByDocStatus && propertiesByDocStatus.length > 0 ? (
              <ResponsiveContainer width="100%" height={(typeof window !== 'undefined' && window.innerWidth < 640) ? 250 : 300}>
                <RechartsPieChart>
                  <Pie
                    data={propertiesByDocStatus}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ status, percent }) => `${status}: ${(percent * 100).toFixed(0)}%`}
                    outerRadius={(typeof window !== 'undefined' && window.innerWidth < 640) ? 80 : 100}
                    fill="#8884d8"
                    dataKey="count"
                  >
                    {propertiesByDocStatus.map((entry: any, index: number) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip 
                    formatter={(value: any) => [`${value} unidade(s)`, 'Quantidade']}
                    labelFormatter={(label) => {
                      if (propertiesByType?.find((p: any) => p.type === label)) return `Tipo: ${label}`;
                      if (tasksByStatus?.find((t: any) => t.status === label)) return `Status: ${label}`;
                      if (cattleByHealth?.find((c: any) => c.health === label)) return `Saúde: ${label}`;
                      if (clientsByType?.find((c: any) => c.type === label)) return `Tipo: ${label}`;
                      if (propertiesByDocStatus?.find((p: any) => p.status === label)) return `Status: ${label}`;
                      return label;
                    }}
                  />
                  <Legend 
                    formatter={(value) => value}
                  />
                </RechartsPieChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                <FileText className="w-12 h-12 mb-4 opacity-50" />
                <p className="text-sm">Nenhum imóvel cadastrado</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Imóveis por Tipo */}
        <Card className="border-0 shadow-elegant">
          <CardHeader className="pb-3 sm:pb-4 px-3 sm:px-6">
            <CardTitle className="text-base sm:text-lg font-bold tracking-tight flex items-center gap-2">
              <Wallet className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
              <span className="text-sm sm:text-base">Imóveis por Tipo</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="px-3 sm:px-6 pb-4 sm:pb-6">
            {propertiesByType && propertiesByType.length > 0 ? (
              <ResponsiveContainer width="100%" height={(typeof window !== 'undefined' && window.innerWidth < 640) ? 250 : 300}>
                <RechartsPieChart>
                  <Pie
                    data={propertiesByType}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ type, percent }) => `${type}: ${(percent * 100).toFixed(0)}%`}
                    outerRadius={(typeof window !== 'undefined' && window.innerWidth < 640) ? 80 : 100}
                    fill="#8884d8"
                    dataKey="count"
                  >
                    {propertiesByType.map((entry: any, index: number) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip 
                    formatter={(value: any) => [`${value} unidade(s)`, 'Quantidade']}
                    labelFormatter={(label) => {
                      if (propertiesByType?.find((p: any) => p.type === label)) return `Tipo: ${label}`;
                      if (tasksByStatus?.find((t: any) => t.status === label)) return `Status: ${label}`;
                      if (cattleByHealth?.find((c: any) => c.health === label)) return `Saúde: ${label}`;
                      if (clientsByType?.find((c: any) => c.type === label)) return `Tipo: ${label}`;
                      if (propertiesByDocStatus?.find((p: any) => p.status === label)) return `Status: ${label}`;
                      return label;
                    }}
                  />
                  <Legend 
                    formatter={(value) => value}
                  />
                </RechartsPieChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                <Wallet className="w-12 h-12 mb-4 opacity-50" />
                <p className="text-sm">Nenhum imóvel cadastrado</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Gráficos de Gado */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Gado por Categoria */}
        <Card className="border-0 shadow-elegant">
          <CardHeader className="pb-3 sm:pb-4 px-3 sm:px-6">
            <CardTitle className="text-base sm:text-lg md:text-xl font-bold tracking-tight flex items-center gap-2">
              <BarChart3 className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
              <span className="text-sm sm:text-base md:text-lg">Gado por Categoria</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="px-3 sm:px-6 pb-4 sm:pb-6">
            {cattleByCategory && cattleByCategory.length > 0 ? (
              <ResponsiveContainer width="100%" height={(typeof window !== 'undefined' && window.innerWidth < 640) ? 250 : 300}>
                <BarChart data={cattleByCategory} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis 
                    dataKey="category"
                    label={{ value: 'Categoria', position: 'insideBottom', offset: -5 }}
                  />
                  <YAxis 
                    label={{ value: 'Quantidade', angle: -90, position: 'insideLeft' }}
                  />
                  <Tooltip 
                    formatter={(value: any) => [`${value} cabeça(s)`, 'Quantidade']}
                    labelFormatter={(label) => `Categoria: ${label}`}
                  />
                  <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                    {cattleByCategory.map((entry: any, index: number) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                <BarChart3 className="w-12 h-12 mb-4 opacity-50" />
                <p className="text-sm">Nenhum gado cadastrado</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Gado por Status de Saúde */}
        <Card className="border-0 shadow-elegant">
          <CardHeader className="pb-3 sm:pb-4 px-3 sm:px-6">
            <CardTitle className="text-base sm:text-lg md:text-xl font-bold tracking-tight flex items-center gap-2">
              <PieChart className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
              <span className="text-sm sm:text-base md:text-lg">Gado por Status de Saúde</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="px-3 sm:px-6 pb-4 sm:pb-6">
            {cattleByHealth && cattleByHealth.length > 0 ? (
              <ResponsiveContainer width="100%" height={(typeof window !== 'undefined' && window.innerWidth < 640) ? 250 : 300}>
                <RechartsPieChart>
                  <Pie
                    data={cattleByHealth}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ health, percent }) => `${health}: ${(percent * 100).toFixed(0)}%`}
                    outerRadius={(typeof window !== 'undefined' && window.innerWidth < 640) ? 80 : 100}
                    fill="#8884d8"
                    dataKey="count"
                  >
                    {cattleByHealth.map((entry: any, index: number) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip 
                    formatter={(value: any) => [`${value} unidade(s)`, 'Quantidade']}
                    labelFormatter={(label) => {
                      if (propertiesByType?.find((p: any) => p.type === label)) return `Tipo: ${label}`;
                      if (tasksByStatus?.find((t: any) => t.status === label)) return `Status: ${label}`;
                      if (cattleByHealth?.find((c: any) => c.health === label)) return `Saúde: ${label}`;
                      if (clientsByType?.find((c: any) => c.type === label)) return `Tipo: ${label}`;
                      if (propertiesByDocStatus?.find((p: any) => p.status === label)) return `Status: ${label}`;
                      return label;
                    }}
                  />
                  <Legend 
                    formatter={(value) => value}
                  />
                </RechartsPieChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                <PieChart className="w-12 h-12 mb-4 opacity-50" />
                <p className="text-sm">Nenhum gado cadastrado</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Gráficos de Clientes, Processos e Leads */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        {/* Clientes por Tipo */}
        <Card className="border-0 shadow-elegant">
          <CardHeader className="pb-3 sm:pb-4 px-3 sm:px-6">
            <CardTitle className="text-base sm:text-lg font-bold tracking-tight flex items-center gap-2">
              <PieChart className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
              <span className="text-sm sm:text-base">Clientes por Tipo</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="px-3 sm:px-6 pb-4 sm:pb-6">
            {clientsByType && clientsByType.length > 0 ? (
              <ResponsiveContainer width="100%" height={(typeof window !== 'undefined' && window.innerWidth < 640) ? 250 : 300}>
                <RechartsPieChart>
                  <Pie
                    data={clientsByType}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ type, percent }) => `${type}: ${(percent * 100).toFixed(0)}%`}
                    outerRadius={(typeof window !== 'undefined' && window.innerWidth < 640) ? 80 : 100}
                    fill="#8884d8"
                    dataKey="count"
                  >
                    {clientsByType.map((entry: any, index: number) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip 
                    formatter={(value: any) => [`${value} unidade(s)`, 'Quantidade']}
                    labelFormatter={(label) => {
                      if (propertiesByType?.find((p: any) => p.type === label)) return `Tipo: ${label}`;
                      if (tasksByStatus?.find((t: any) => t.status === label)) return `Status: ${label}`;
                      if (cattleByHealth?.find((c: any) => c.health === label)) return `Saúde: ${label}`;
                      if (clientsByType?.find((c: any) => c.type === label)) return `Tipo: ${label}`;
                      if (propertiesByDocStatus?.find((p: any) => p.status === label)) return `Status: ${label}`;
                      return label;
                    }}
                  />
                  <Legend 
                    formatter={(value) => value}
                  />
                </RechartsPieChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                <PieChart className="w-12 h-12 mb-4 opacity-50" />
                <p className="text-sm">Nenhum cliente cadastrado</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Processos por Status */}
        <Card className="border-0 shadow-elegant">
          <CardHeader className="pb-3 sm:pb-4 px-3 sm:px-6">
            <CardTitle className="text-base sm:text-lg font-bold tracking-tight flex items-center gap-2">
              <BarChart3 className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
              <span className="text-sm sm:text-base">Processos por Status</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="px-3 sm:px-6 pb-4 sm:pb-6">
            {processesByStatus && processesByStatus.length > 0 ? (
              <ResponsiveContainer width="100%" height={(typeof window !== 'undefined' && window.innerWidth < 640) ? 250 : 300}>
                <BarChart data={processesByStatus} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis 
                    dataKey="status"
                    label={{ value: 'Status', position: 'insideBottom', offset: -5 }}
                  />
                  <YAxis 
                    label={{ value: 'Quantidade', angle: -90, position: 'insideLeft' }}
                  />
                  <Tooltip 
                    formatter={(value: any) => [`${value} processo(s)`, 'Quantidade']}
                    labelFormatter={(label) => `Status: ${label}`}
                  />
                  <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                    {processesByStatus.map((entry: any, index: number) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                <BarChart3 className="w-12 h-12 mb-4 opacity-50" />
                <p className="text-sm">Nenhum processo cadastrado</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Leads por Status */}
        <Card className="border-0 shadow-elegant">
          <CardHeader className="pb-3 sm:pb-4 px-3 sm:px-6">
            <CardTitle className="text-base sm:text-lg font-bold tracking-tight flex items-center gap-2">
              <TrendingUp className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
              <span className="text-sm sm:text-base">Leads por Status</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="px-3 sm:px-6 pb-4 sm:pb-6">
            {leadsByStatus && leadsByStatus.length > 0 ? (
              <ResponsiveContainer width="100%" height={(typeof window !== 'undefined' && window.innerWidth < 640) ? 250 : 300}>
                <BarChart data={leadsByStatus} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis 
                    dataKey="status"
                    label={{ value: 'Status', position: 'insideBottom', offset: -5 }}
                  />
                  <YAxis 
                    label={{ value: 'Quantidade', angle: -90, position: 'insideLeft' }}
                  />
                  <Tooltip 
                    formatter={(value: any) => [`${value} lead(s)`, 'Quantidade']}
                    labelFormatter={(label) => `Status: ${label}`}
                  />
                  <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                    {leadsByStatus.map((entry: any, index: number) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                <TrendingUp className="w-12 h-12 mb-4 opacity-50" />
                <p className="text-sm">Nenhum lead cadastrado</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Dialogs para detalhes dos cards */}
      <Dialog open={revenueDialogOpen} onOpenChange={setRevenueDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold bg-gradient-to-r from-success to-success/70 bg-clip-text text-transparent">
              Detalhes de Receitas
            </DialogTitle>
            <DialogDescription>
              Total: {formatCurrency(totalRevenue || 0)} - {revenueDetails?.length || 0} registro(s)
            </DialogDescription>
          </DialogHeader>
          <div className="mt-4">
            {revenueDetails && revenueDetails.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Descrição</TableHead>
                    <TableHead>Data</TableHead>
                    <TableHead>Categoria</TableHead>
                    <TableHead>Valor</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {revenueDetails.map((revenue: any) => (
                    <TableRow key={revenue.id}>
                      <TableCell>{revenue.description || "-"}</TableCell>
                      <TableCell>{format(new Date(revenue.date), "dd/MM/yyyy", { locale: ptBR })}</TableCell>
                      <TableCell>{revenue.category || "-"}</TableCell>
                      <TableCell className="font-semibold text-success">{formatCurrency(Number(revenue.amount || 0))}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <p className="text-center text-muted-foreground py-8">Nenhuma receita encontrada.</p>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={expenseDialogOpen} onOpenChange={setExpenseDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold bg-gradient-to-r from-destructive to-destructive/70 bg-clip-text text-transparent">
              Detalhes de Despesas
            </DialogTitle>
            <DialogDescription>
              Total: {formatCurrency(totalExpenses || 0)} - {expenseDetails?.length || 0} registro(s)
            </DialogDescription>
          </DialogHeader>
          <div className="mt-4">
            {expenseDetails && expenseDetails.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Descrição</TableHead>
                    <TableHead>Data</TableHead>
                    <TableHead>Categoria</TableHead>
                    <TableHead>Valor</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {expenseDetails.map((expense: any) => (
                    <TableRow key={expense.id}>
                      <TableCell>{expense.description || "-"}</TableCell>
                      <TableCell>{format(new Date(expense.date), "dd/MM/yyyy", { locale: ptBR })}</TableCell>
                      <TableCell>{expense.category || "-"}</TableCell>
                      <TableCell className="font-semibold text-destructive">{formatCurrency(Number(expense.amount || 0))}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <p className="text-center text-muted-foreground py-8">Nenhuma despesa encontrada.</p>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={balanceDialogOpen} onOpenChange={setBalanceDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent">
              Detalhes do Saldo
            </DialogTitle>
            <DialogDescription>
              Saldo Total: <span className={`font-bold ${saldo >= 0 ? 'text-success' : 'text-destructive'}`}>{formatCurrency(saldo)}</span>
            </DialogDescription>
          </DialogHeader>
          <div className="mt-4 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <Card className="p-4 bg-success/10 border-success/30">
                <p className="text-sm text-muted-foreground">Total de Receitas</p>
                <p className="text-2xl font-bold text-success">{formatCurrency(totalRevenue || 0)}</p>
              </Card>
              <Card className="p-4 bg-destructive/10 border-destructive/30">
                <p className="text-sm text-muted-foreground">Total de Despesas</p>
                <p className="text-2xl font-bold text-destructive">{formatCurrency(totalExpenses || 0)}</p>
              </Card>
            </div>
            <div className="space-y-2">
              <h3 className="font-semibold">Saldo Mensal</h3>
              {revenueVsExpenses && revenueVsExpenses.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Mês</TableHead>
                      <TableHead>Receitas</TableHead>
                      <TableHead>Despesas</TableHead>
                      <TableHead>Saldo</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {revenueVsExpenses.map((item: any, index: number) => (
                      <TableRow key={index}>
                        <TableCell>{item.month}</TableCell>
                        <TableCell className="text-success">{formatCurrency(item.receitas || 0)}</TableCell>
                        <TableCell className="text-destructive">{formatCurrency(item.despesas || 0)}</TableCell>
                        <TableCell className={`font-semibold ${(item.saldo || 0) >= 0 ? 'text-success' : 'text-destructive'}`}>
                          {formatCurrency(item.saldo || 0)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <p className="text-center text-muted-foreground py-4">Nenhum dado disponível.</p>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={propertiesDialogOpen} onOpenChange={setPropertiesDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent">
              Detalhes de Imóveis
            </DialogTitle>
            <DialogDescription>
              Total: {totalProperties || 0} imóvel(is) cadastrado(s)
            </DialogDescription>
          </DialogHeader>
          <div className="mt-4">
            {propertiesDetails && propertiesDetails.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Endereço</TableHead>
                    <TableHead>Cidade</TableHead>
                    <TableHead>Valor Venal</TableHead>
                    <TableHead>Status Documentação</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {propertiesDetails.map((property: any) => (
                    <TableRow key={property.id}>
                      <TableCell>{property.address || "-"}{property.number ? `, ${property.number}` : ""}{property.complement ? ` - ${property.complement}` : ""}</TableCell>
                      <TableCell>{property.city || "-"}</TableCell>
                      <TableCell className="font-semibold text-success">{property.venal_value ? formatCurrency(Number(property.venal_value)) : "-"}</TableCell>
                      <TableCell>
                        {property.documentation_status === "PAGO" ? (
                          <span className="text-success font-semibold">PAGO</span>
                        ) : property.documentation_status === "PENDENTE" ? (
                          <span className="text-destructive font-semibold">PENDENTE</span>
                        ) : (
                          property.documentation_status || "-"
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <p className="text-center text-muted-foreground py-8">Nenhum imóvel cadastrado.</p>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog para Relatório Completo */}
      <Dialog open={fullReportDialogOpen} onOpenChange={setFullReportDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto w-[95vw] sm:w-full p-3 sm:p-6">
          <DialogHeader className="px-0 sm:px-0">
            <DialogTitle className="text-lg sm:text-xl">Gerar Relatório Completo em PDF</DialogTitle>
            <DialogDescription className="text-xs sm:text-sm">
              Gere um relatório completo de todo o sistema (Receitas, Despesas, Imóveis, Clientes, etc.)
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 sm:space-y-6 py-2 sm:py-4 max-h-[calc(90vh-120px)] overflow-y-auto px-0 sm:px-0">
            {/* Filtros de Período */}
            <div className="space-y-2 sm:space-y-3">
              <Label className="text-sm sm:text-base font-semibold">Período</Label>
              <Select value={reportPeriodFilter} onValueChange={(value: any) => setReportPeriodFilter(value)}>
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
              
              {reportPeriodFilter === "personalizado" && (
                <div className="flex flex-col sm:flex-row gap-2">
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "w-full sm:w-[200px] justify-start text-left font-normal",
                          !reportCustomDateRange.from && "text-muted-foreground"
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {reportCustomDateRange.from ? (
                          format(reportCustomDateRange.from, "dd/MM/yyyy", { locale: ptBR })
                        ) : (
                          <span>Data inicial</span>
                        )}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={reportCustomDateRange.from}
                        onSelect={(date) => setReportCustomDateRange({ ...reportCustomDateRange, from: date })}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "w-full sm:w-[200px] justify-start text-left font-normal",
                          !reportCustomDateRange.to && "text-muted-foreground"
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {reportCustomDateRange.to ? (
                          format(reportCustomDateRange.to, "dd/MM/yyyy", { locale: ptBR })
                        ) : (
                          <span>Data final</span>
                        )}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={reportCustomDateRange.to}
                        onSelect={(date) => setReportCustomDateRange({ ...reportCustomDateRange, to: date })}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                </div>
              )}
            </div>

            {/* Seleção de Módulos */}
            <div className="space-y-2 sm:space-y-3">
              <Label className="text-sm sm:text-base font-semibold">Módulos a Incluir</Label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3 p-3 sm:p-4 border rounded-lg bg-muted/30">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="geral"
                    checked={selectedModules.geral}
                    onCheckedChange={() => handleModuleToggle("geral")}
                  />
                  <label
                    htmlFor="geral"
                    className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                  >
                    Geral (Todos)
                  </label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="receitas"
                    checked={selectedModules.receitas}
                    onCheckedChange={() => handleModuleToggle("receitas")}
                  />
                  <label
                    htmlFor="receitas"
                    className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                  >
                    Receitas
                  </label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="despesas"
                    checked={selectedModules.despesas}
                    onCheckedChange={() => handleModuleToggle("despesas")}
                  />
                  <label
                    htmlFor="despesas"
                    className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                  >
                    Despesas
                  </label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="tarefas"
                    checked={selectedModules.tarefas}
                    onCheckedChange={() => handleModuleToggle("tarefas")}
                  />
                  <label
                    htmlFor="tarefas"
                    className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                  >
                    Tarefas
                  </label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="imoveis"
                    checked={selectedModules.imoveis}
                    onCheckedChange={() => handleModuleToggle("imoveis")}
                  />
                  <label
                    htmlFor="imoveis"
                    className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                  >
                    Imóveis
                  </label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="gado"
                    checked={selectedModules.gado}
                    onCheckedChange={() => handleModuleToggle("gado")}
                  />
                  <label
                    htmlFor="gado"
                    className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                  >
                    Gado
                  </label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="clientes"
                    checked={selectedModules.clientes}
                    onCheckedChange={() => handleModuleToggle("clientes")}
                  />
                  <label
                    htmlFor="clientes"
                    className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                  >
                    Clientes
                  </label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="processos"
                    checked={selectedModules.processos}
                    onCheckedChange={() => handleModuleToggle("processos")}
                  />
                  <label
                    htmlFor="processos"
                    className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                  >
                    Processos
                  </label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="emprestimos"
                    checked={selectedModules.emprestimos}
                    onCheckedChange={() => handleModuleToggle("emprestimos")}
                  />
                  <label
                    htmlFor="emprestimos"
                    className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                  >
                    Empréstimos
                  </label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="aplicacoes"
                    checked={selectedModules.aplicacoes}
                    onCheckedChange={() => handleModuleToggle("aplicacoes")}
                  />
                  <label
                    htmlFor="aplicacoes"
                    className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                  >
                    Aplicações
                  </label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="leads"
                    checked={selectedModules.leads}
                    onCheckedChange={() => handleModuleToggle("leads")}
                  />
                  <label
                    htmlFor="leads"
                    className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                  >
                    Leads
                  </label>
                </div>
              </div>
            </div>

            {/* Outras Opções */}
            <div className="space-y-2 sm:space-y-3 border-t pt-3 sm:pt-4">
              <div className="space-y-2">
                <Label className="text-sm sm:text-base">Orientação</Label>
                <Select value={reportOrientation} onValueChange={(value: any) => setReportOrientation(value)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="portrait">Vertical (Retrato)</SelectItem>
                    <SelectItem value="landscape">Horizontal (Paisagem)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-2">
                <Label className="text-sm sm:text-base">Incluir Gráficos</Label>
                <Select value={includeDashboard ? "sim" : "nao"} onValueChange={(value) => setIncludeDashboard(value === "sim")}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="sim">Sim</SelectItem>
                    <SelectItem value="nao">Não</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Os gráficos serão incluídos ao final do relatório
                </p>
              </div>
            </div>
          </div>
          <div className="flex flex-col sm:flex-row justify-end gap-2 pt-2 sm:pt-0">
            <Button 
              variant="outline" 
              onClick={() => setFullReportDialogOpen(false)}
              className="w-full sm:w-auto text-sm sm:text-base"
            >
              Cancelar
            </Button>
            <Button 
              onClick={handleGenerateFullReportPDF} 
              className="gap-2 w-full sm:w-auto text-sm sm:text-base"
            >
              <Download className="h-4 w-4" />
              <span className="hidden sm:inline">Gerar Relatório Completo</span>
              <span className="sm:hidden">Gerar PDF</span>
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog de Filtros de Visualização */}
      <Dialog open={viewFiltersDialogOpen} onOpenChange={setViewFiltersDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold">Filtros de Visualização do Dashboard</DialogTitle>
            <DialogDescription>
              Configure quais informações deseja visualizar nos relatórios
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-6 mt-4">
            {/* Tipos de Gráficos */}
            <div className="space-y-3">
              <Label className="text-base font-semibold">Tipos de Gráficos</Label>
              <div className="space-y-2">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="showFinancial"
                    checked={viewFilters.showFinancial}
                    onCheckedChange={(checked) =>
                      setViewFilters({ ...viewFilters, showFinancial: checked as boolean })
                    }
                  />
                  <Label htmlFor="showFinancial" className="font-normal cursor-pointer">
                    Financeiro (Receitas e Despesas)
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="showTasks"
                    checked={viewFilters.showTasks}
                    onCheckedChange={(checked) =>
                      setViewFilters({ ...viewFilters, showTasks: checked as boolean })
                    }
                  />
                  <Label htmlFor="showTasks" className="font-normal cursor-pointer">
                    Tarefas
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="showProperties"
                    checked={viewFilters.showProperties}
                    onCheckedChange={(checked) =>
                      setViewFilters({ ...viewFilters, showProperties: checked as boolean })
                    }
                  />
                  <Label htmlFor="showProperties" className="font-normal cursor-pointer">
                    Imóveis
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="showCattle"
                    checked={viewFilters.showCattle}
                    onCheckedChange={(checked) =>
                      setViewFilters({ ...viewFilters, showCattle: checked as boolean })
                    }
                  />
                  <Label htmlFor="showCattle" className="font-normal cursor-pointer">
                    Gado
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="showClients"
                    checked={viewFilters.showClients}
                    onCheckedChange={(checked) =>
                      setViewFilters({ ...viewFilters, showClients: checked as boolean })
                    }
                  />
                  <Label htmlFor="showClients" className="font-normal cursor-pointer">
                    Clientes
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="showProcesses"
                    checked={viewFilters.showProcesses}
                    onCheckedChange={(checked) =>
                      setViewFilters({ ...viewFilters, showProcesses: checked as boolean })
                    }
                  />
                  <Label htmlFor="showProcesses" className="font-normal cursor-pointer">
                    Processos
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="showLeads"
                    checked={viewFilters.showLeads}
                    onCheckedChange={(checked) =>
                      setViewFilters({ ...viewFilters, showLeads: checked as boolean })
                    }
                  />
                  <Label htmlFor="showLeads" className="font-normal cursor-pointer">
                    Leads
                  </Label>
                </div>
              </div>
            </div>

            {/* Filtros de Tarefas */}
            {viewFilters.showTasks && (
              <div className="space-y-3 border-t pt-4">
                <Label className="text-base font-semibold">Filtro de Tarefas</Label>
                <Select
                  value={viewFilters.taskStatus}
                  onValueChange={(value: any) =>
                    setViewFilters({ ...viewFilters, taskStatus: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todas as Tarefas</SelectItem>
                    <SelectItem value="concluidas">Apenas Concluídas</SelectItem>
                    <SelectItem value="pendentes">Apenas Pendentes</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Comparativo de Períodos */}
            <div className="space-y-3 border-t pt-4">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="showPeriodComparison"
                  checked={viewFilters.showPeriodComparison}
                  onCheckedChange={(checked) =>
                    setViewFilters({ ...viewFilters, showPeriodComparison: checked as boolean })
                  }
                />
                <Label htmlFor="showPeriodComparison" className="font-normal cursor-pointer">
                  Mostrar Comparativo de Períodos
                </Label>
              </div>
              {viewFilters.showPeriodComparison && (
                <Select
                  value={viewFilters.comparisonPeriod}
                  onValueChange={(value: any) =>
                    setViewFilters({ ...viewFilters, comparisonPeriod: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="mes_passado">Mês Passado</SelectItem>
                    <SelectItem value="trimestre">Trimestre Anterior</SelectItem>
                    <SelectItem value="semestre">Semestre Anterior</SelectItem>
                    <SelectItem value="ano">Ano Anterior</SelectItem>
                  </SelectContent>
                </Select>
              )}
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t">
              <Button
                variant="outline"
                onClick={() => {
                  setViewFilters({
                    showFinancial: true,
                    showTasks: true,
                    showProperties: true,
                    showCattle: true,
                    showClients: true,
                    showProcesses: true,
                    showLeads: true,
                    taskStatus: "todos",
                    showPeriodComparison: false,
                    comparisonPeriod: "mes_passado",
                  });
                }}
              >
                Restaurar Padrão
              </Button>
              <Button onClick={() => setViewFiltersDialogOpen(false)}>
                Aplicar Filtros
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

    </div>
  );
}

