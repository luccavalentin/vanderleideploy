import { useState, useMemo, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/layout/PageHeader";
import { StatsCard } from "@/components/layout/StatsCard";
import { QuickActions } from "@/components/QuickActions";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { useTableSort } from "@/hooks/useTableSort";
import { useSmartSearch } from "@/hooks/useSmartSearch";
import { SmartSearchInput } from "@/components/SmartSearchInput";
import { Pencil, Trash2, TrendingDown, Download, FileText, DollarSign } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { standardizeText, handleStandardizeInput } from "@/lib/validations";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from "recharts";
import { ScrollIndicator } from "@/components/ui/ScrollIndicator";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

export default function Despesas() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [expenseToDelete, setExpenseToDelete] = useState<string | null>(null);
  const [detailsDialogOpen, setDetailsDialogOpen] = useState(false);
  const [selectedCard, setSelectedCard] = useState<"expense" | "balance" | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const tableContainerRef = useRef<HTMLDivElement>(null);
  
  // Ler parâmetros da URL para filtros
  const categoriaFilter = searchParams.get("categoria") || "";
  const buscaFilter = searchParams.get("busca") || "";
  const novoParam = searchParams.get("novo") || "";
  const linkedSourceParam = searchParams.get("linked_source") || "";

  const [formData, setFormData] = useState({
    description: "",
    amount: "",
    date: "", // "A partir de..." (opcional)
    category: "",
    frequency: "", // Vazio por padrão = "Anual Fixo"
    frequency_type: "", // "tempo_determinado" ou vazio
    installments: "", // Quantidade de parcelas
    status: "PENDENTE",
    linked_source: "", // Vínculo com outras telas (Escritório, Gado, etc)
  });

  const { data: expenses, isLoading: expensesLoading } = useQuery({
    queryKey: ["expenses"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("expenses")
        .select("*, clients(name)");
      if (error) throw error;
      return data;
    },
    staleTime: 300000, // Cache por 5 minutos
    refetchOnMount: true, // Buscar na montagem inicial
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    gcTime: 600000, // 10 minutos
  });

  // Buscar receitas para calcular o saldo
  const { data: revenues, isLoading: revenuesLoading } = useQuery({
    queryKey: ["revenues"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("revenue")
        .select("id, amount, date, description");
      if (error) throw error;
      return data;
    },
    staleTime: 300000, // Cache por 5 minutos
    refetchOnMount: true, // Buscar na montagem inicial
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    gcTime: 600000, // 10 minutos
  });

  const { searchTerm, setSearchTerm, filteredData: filteredExpenses, resultCount, totalCount } = useSmartSearch(
    expenses,
    ["description", "category", "status"]
  );

  // Aplicar filtros da URL ao termo de busca
  useEffect(() => {
    if (categoriaFilter || buscaFilter) {
      const filterTerm = categoriaFilter ? categoriaFilter : buscaFilter;
      setSearchTerm(filterTerm);
    }
  }, [categoriaFilter, buscaFilter, setSearchTerm]);

  // Abrir dialog de novo cadastro se parâmetro novo=1 estiver na URL
  useEffect(() => {
    if (novoParam === "1") {
      setEditingId(null);
      setFormData({
        description: "",
        amount: "",
        date: "",
        category: categoriaFilter || "", // Pré-preenche categoria se especificada
        frequency: "",
        frequency_type: "",
        installments: "",
        status: "PENDENTE",
        linked_source: linkedSourceParam || "", // Pré-preenche linked_source se especificado
      });
      setIsDialogOpen(true);
      // Remove apenas o parâmetro "novo" da URL, mantendo "categoria" e "linked_source" se existirem
      const newSearchParams = new URLSearchParams(searchParams);
      newSearchParams.delete("novo");
      setSearchParams(newSearchParams, { replace: true });
    }
  }, [novoParam, categoriaFilter, linkedSourceParam, searchParams, setSearchParams]);

  // Aplicar filtro adicional por categoria e linked_source se especificado na URL
  const finalFilteredExpenses = useMemo(() => {
    if (!filteredExpenses) return [];
    let result = filteredExpenses;
    
    // Filtrar por categoria se especificado
    if (categoriaFilter) {
      result = result.filter((expense: any) => {
      const category = (expense.category || "").toLowerCase();
      return category.includes(categoriaFilter.toLowerCase());
    });
    }
    
    // Filtrar por linked_source se especificado
    if (linkedSourceParam) {
      result = result.filter((expense: any) => {
        const linkedSource = (expense.linked_source || "").toLowerCase();
        const isLinkedSourceMatch = linkedSource.includes(linkedSourceParam.toLowerCase());
        
        // Se for "Imóveis", filtrar também por property_id ou categorias relacionadas
        if (linkedSourceParam.toLowerCase() === "imóveis" || linkedSourceParam.toLowerCase() === "imoveis") {
          const hasPropertyId = !!expense.property_id;
          const category = (expense.category || "").toLowerCase();
          const description = (expense.description || "").toLowerCase();
          
          // Categorias relacionadas a imóveis
          const propertyRelatedCategories = [
            "aluguel", "arrendamento", "locação", "locacao", "rent", "rental",
            "condomínio", "condominio", "iptu", "taxa", "manutenção", "manutencao",
            "reforma", "reparo", "seguro", "segurança", "seguranca", "limpeza",
            "pintura", "jardinagem", "elétrica", "eletrica", "hidráulica", "hidraulica"
          ];
          
          const isPropertyCategory = propertyRelatedCategories.some(cat => 
            category.includes(cat) || description.includes(cat)
          );
          
          return (isLinkedSourceMatch || hasPropertyId || isPropertyCategory);
        }
        
        return isLinkedSourceMatch;
      });
    }
    
    return result;
  }, [filteredExpenses, categoriaFilter, linkedSourceParam]);

  const { sortedData: sortedExpenses, SortButton } = useTableSort(finalFilteredExpenses);

  // Calcular dados para o gráfico de pizza por categoria
  const expenseByCategory = useMemo(() => {
    if (!expenses) return [];
    
    const categoryMap: Record<string, number> = {};
    
    expenses.forEach((expense: any) => {
      const category = expense.category || "Sem Categoria";
      const amount = Number(expense.amount) || 0;
      
      if (!categoryMap[category]) {
        categoryMap[category] = 0;
      }
      categoryMap[category] += amount;
    });
    
    return Object.entries(categoryMap)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [expenses]);

  const COLORS = ['hsl(var(--primary))', 'hsl(var(--destructive))', 'hsl(var(--warning))', 'hsl(var(--success))', 'hsl(var(--chart-2))', 'hsl(var(--chart-3))'];

  // Calcular totais e saldo em tempo real (acumulado do ano atual)
  const financialStats = useMemo(() => {
    const currentYear = new Date().getFullYear();
    const currentYearStart = new Date(currentYear, 0, 1); // 1º de janeiro do ano atual
    const currentYearEnd = new Date(currentYear, 11, 31, 23, 59, 59); // 31 de dezembro do ano atual

    // Filtrar receitas do ano atual
    const revenuesThisYear = revenues?.filter((revenue: any) => {
      if (!revenue.date) return false;
      const revenueDate = new Date(revenue.date);
      // Verificar se a data é válida
      if (isNaN(revenueDate.getTime())) return false;
      return revenueDate >= currentYearStart && revenueDate <= currentYearEnd;
    }) || [];

    // Filtrar despesas do ano atual
    const expensesThisYear = expenses?.filter((expense: any) => {
      if (!expense.date) return false;
      const expenseDate = new Date(expense.date);
      // Verificar se a data é válida
      if (isNaN(expenseDate.getTime())) return false;
      return expenseDate >= currentYearStart && expenseDate <= currentYearEnd;
    }) || [];

    const totalRevenue = revenuesThisYear.reduce((sum: number, revenue: any) => {
      return sum + (Number(revenue.amount) || 0);
    }, 0);

    const totalExpenses = expensesThisYear.reduce((sum: number, expense: any) => {
      return sum + (Number(expense.amount) || 0);
    }, 0);

    const saldo = totalRevenue - totalExpenses;

    return {
      totalRevenue,
      totalExpenses,
      saldo,
      currentYear,
      revenuesThisYear,
      expensesThisYear
    };
  }, [revenues, expenses]);

  const [keepDialogOpen, setKeepDialogOpen] = useState(false);

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      const { error } = await supabase.from("expenses").insert([data]);
      if (error) throw error;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["expenses"] });
      await queryClient.invalidateQueries({ queryKey: ["revenues"] });
      await queryClient.invalidateQueries({ queryKey: ["expenses-by-category"] });
      await queryClient.invalidateQueries({ queryKey: ["monthly-analysis"] });
      toast({ title: "Despesa cadastrada com sucesso!" });
      if (keepDialogOpen) {
        // Limpar formulário mas manter dialog aberto
        // Manter categoria e linked_source se vierem da URL (ex: quando vem da tela de Gado ou Escritório)
        const categoryFromUrl = categoriaFilter || "";
        const linkedSourceFromUrl = linkedSourceParam || "";
        setFormData({
          description: "",
          amount: "",
          date: "",
          category: categoryFromUrl, // Mantém categoria da URL se existir
          frequency: "",
          frequency_type: "",
          installments: "",
          status: "PENDENTE",
          linked_source: linkedSourceFromUrl, // Mantém linked_source da URL se existir
        });
        setKeepDialogOpen(false);
      } else {
      handleCloseDialog();
      }
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao cadastrar despesa",
        description: error.message || "Ocorreu um erro ao salvar. Tente novamente.",
        variant: "destructive",
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      const { error } = await supabase.from("expenses").update(data).eq("id", id);
      if (error) throw error;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["expenses"] });
      await queryClient.invalidateQueries({ queryKey: ["revenues"] });
      await queryClient.invalidateQueries({ queryKey: ["expenses-by-category"] });
      await queryClient.invalidateQueries({ queryKey: ["monthly-analysis"] });
      toast({ title: "Despesa atualizada com sucesso!" });
      handleCloseDialog();
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao atualizar despesa",
        description: error.message || "Ocorreu um erro ao atualizar. Tente novamente.",
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("expenses").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["expenses"] });
      await queryClient.invalidateQueries({ queryKey: ["revenues"] });
      await queryClient.invalidateQueries({ queryKey: ["expenses-by-category"] });
      await queryClient.invalidateQueries({ queryKey: ["monthly-analysis"] });
      toast({ title: "Despesa excluída com sucesso!" });
      setDeleteDialogOpen(false);
      setExpenseToDelete(null);
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao excluir despesa",
        description: error.message || "Ocorreu um erro ao excluir. Tente novamente.",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setKeepDialogOpen(false);
    await handleSubmitLogic();
  };
    
  const handleSubmitLogic = async () => {
    try {
      // Validação: descrição é obrigatória
      if (!formData.description || !formData.description.trim()) {
        toast({
          title: "Erro de validação",
          description: "A descrição é obrigatória.",
          variant: "destructive",
        });
        return;
      }
      
      // Limpar campos vazios e converter para null
      // Construir a frequency completa baseada no tipo
      // Se não selecionar nada, considerar "Anual Fixo"
      let frequencyValue = formData.frequency || "Anual";
      let frequencyType = formData.frequency_type || "";
      
      // Se não selecionou tipo e é Mensal ou Anual, considerar Fixo
      if ((formData.frequency === "Mensal" || formData.frequency === "Anual") && !frequencyType) {
        frequencyType = "fixo";
      }
      
      // Se não selecionou periodicidade, considerar "Anual Fixo"
      if (!formData.frequency) {
        frequencyValue = "Anual";
        frequencyType = "fixo";
      }
      
      if (frequencyValue === "Mensal" || frequencyValue === "Anual") {
        if (frequencyType === "fixo") {
          frequencyValue = frequencyValue === "Mensal" ? "Mensal Fixo" : "Anual Fixo";
        } else if (frequencyType === "tempo_determinado") {
          if (!formData.installments || parseInt(formData.installments) < 1) {
            toast({
              title: "Erro de validação",
              description: "Por favor, informe a quantidade de parcelas.",
              variant: "destructive",
            });
            return;
          }
          frequencyValue = frequencyValue === "Mensal" 
            ? `Mensal por Tempo Determinado (${formData.installments} parcelas)`
            : `Anual por Tempo Determinado (${formData.installments} parcelas)`;
        }
      }
      
      // Se não preencheu "A partir de...", usar data atual
      const startDate = formData.date || new Date().toISOString().split('T')[0];

      // Garantir que o status seja válido
      const validStatuses = ["PENDENTE", "PAGO", "AGENDADO"];
      const statusValue = formData.status && validStatuses.includes(formData.status) 
        ? formData.status 
        : "PENDENTE";

      const data: any = {
        description: formData.description ? standardizeText(formData.description) : null,
        category: formData.category ? standardizeText(formData.category) : null,
        amount: formData.amount ? parseFloat(formData.amount) : 0,
        date: startDate, // Usa "A partir de..." se preenchido, senão data atual
        frequency: frequencyValue,
        installments: frequencyType === "tempo_determinado" && formData.installments 
          ? parseInt(formData.installments) 
          : null,
        status: statusValue,
        linked_source: formData.linked_source ? standardizeText(formData.linked_source) : null,
      };

      // Remove campos undefined ou string vazia (exceto status que já foi validado)
      Object.keys(data).forEach(key => {
        if (key !== "status" && (data[key] === "" || data[key] === undefined)) {
          data[key] = null;
        }
      });

      if (editingId) {
        await updateMutation.mutateAsync({ id: editingId, data });
      } else {
        await createMutation.mutateAsync(data);
      }
    } catch (error: any) {
      console.error("Erro ao salvar despesa:", error);
      // Erro já é tratado no onError da mutation
    }
  };

  const handleEdit = (expense: any) => {
    setEditingId(expense.id);
    // Parse da frequency para separar tipo e periodicidade
    const frequency = expense.frequency || "Única";
    let frequency_type = "";
    let installments = "";
    
    if (frequency.includes("Fixo")) {
      frequency_type = "fixo";
      if (frequency.includes("Mensal")) {
        setFormData({
          description: expense.description,
          amount: expense.amount.toString(),
          date: expense.date,
          category: expense.category || "",
          frequency: "Mensal",
          frequency_type: "fixo",
          installments: "",
          status: expense.status || "PENDENTE",
          linked_source: expense.linked_source || "",
        });
      } else if (frequency.includes("Anual")) {
        setFormData({
          description: expense.description,
          amount: expense.amount.toString(),
          date: expense.date,
          category: expense.category || "",
          frequency: "Anual",
          frequency_type: "fixo",
          installments: "",
          status: expense.status || "PENDENTE",
          linked_source: expense.linked_source || "",
        });
      }
    } else if (frequency.includes("Tempo Determinado")) {
      frequency_type = "tempo_determinado";
      installments = expense.installments?.toString() || "";
      if (frequency.includes("Mensal")) {
        setFormData({
          description: expense.description,
          amount: expense.amount.toString(),
          date: expense.date,
          category: expense.category || "",
          frequency: "Mensal",
          frequency_type: "tempo_determinado",
          installments: installments,
          status: expense.status || "PENDENTE",
          linked_source: expense.linked_source || "",
        });
      } else if (frequency.includes("Anual")) {
        setFormData({
          description: expense.description,
          amount: expense.amount.toString(),
          date: expense.date,
          category: expense.category || "",
          frequency: "Anual",
          frequency_type: "tempo_determinado",
          installments: installments,
          status: expense.status || "PENDENTE",
          linked_source: expense.linked_source || "",
        });
      }
    } else {
      setFormData({
        description: expense.description,
        amount: expense.amount.toString(),
        date: expense.date,
        category: expense.category || "",
        frequency: frequency,
        frequency_type: "",
        installments: "",
        status: expense.status || "PENDENTE",
        linked_source: expense.linked_source || "",
      });
    }
    setIsDialogOpen(true);
  };

  const handleDelete = (id: string) => {
    setExpenseToDelete(id);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = () => {
    if (expenseToDelete) {
      deleteMutation.mutate(expenseToDelete);
      setDeleteDialogOpen(false);
      setExpenseToDelete(null);
    }
  };

  const handleCloseDialog = () => {
    setIsDialogOpen(false);
    setEditingId(null);
    // Manter categoria e linked_source se vierem da URL (ex: quando vem da tela de Gado ou Escritório)
    const categoryFromUrl = categoriaFilter || "";
    const linkedSourceFromUrl = linkedSourceParam || "";
    setFormData({
      description: "",
      amount: "",
      date: "",
      category: categoryFromUrl, // Mantém categoria da URL se existir
      frequency: "",
      frequency_type: "",
      installments: "",
      status: "PENDENTE",
      linked_source: linkedSourceFromUrl, // Mantém linked_source da URL se existir
    });
  };

  const handleNewItem = () => {
    setEditingId(null);
    setFormData({
      description: "",
      amount: "",
      date: "",
      category: "",
      frequency: "",
      frequency_type: "",
      installments: "",
      status: "PENDENTE",
      linked_source: "",
    });
    setIsDialogOpen(true);
  };


  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "PAGO":
        return "bg-success/10 text-success";
      case "PENDENTE":
        return "bg-warning/10 text-warning";
      case "AGENDADO":
        return "bg-accent/10 text-accent";
      default:
        return "bg-muted/10 text-muted-foreground";
    }
  };

  const handleExportPDF = () => {
    if (!sortedExpenses || sortedExpenses.length === 0) {
      toast({
        title: "Erro",
        description: "Não há dados para exportar.",
        variant: "destructive",
      });
      return;
    }

    try {
      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.getWidth();
      const margin = 15;
      let yPosition = margin;

      // Título
      doc.setFontSize(18);
      doc.setFont("helvetica", "bold");
      doc.text("Relatório de Despesas", pageWidth / 2, yPosition, { align: "center" });
      yPosition += 8;

      // Data de geração
      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      doc.text(`Gerado em: ${format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}`, pageWidth / 2, yPosition, { align: "center" });
      yPosition += 15;

      // Preparar dados da tabela
      const tableData = sortedExpenses.map((expense) => [
        expense.date ? (() => {
          const date = new Date(expense.date);
          return isNaN(date.getTime()) ? "" : format(date, "dd/MM/yyyy");
        })() : "",
        expense.description || "",
        expense.category || "",
        expense.clients?.name || "",
        expense.status || "",
        formatCurrency(Number(expense.amount) || 0),
      ]);

      autoTable(doc, {
        startY: yPosition,
        head: [["Data", "Descrição", "Categoria", "Fornecedor", "Status", "Valor"]],
        body: tableData,
        theme: "striped",
        headStyles: { fillColor: [33, 150, 243], textColor: 255, fontStyle: "bold" },
        styles: { fontSize: 9 },
        margin: { left: margin, right: margin },
      });

      const fileName = `Despesas_${format(new Date(), "dd-MM-yyyy")}.pdf`;
      doc.save(fileName);

      toast({
        title: "Sucesso",
        description: "Arquivo PDF exportado com sucesso!",
      });
    } catch (error: any) {
      toast({
        title: "Erro",
        description: error.message || "Erro ao exportar PDF.",
        variant: "destructive",
      });
    }
  };

  const handleExportExcel = () => {
    if (!sortedExpenses || sortedExpenses.length === 0) {
      toast({
        title: "Erro",
        description: "Não há dados para exportar.",
        variant: "destructive",
      });
      return;
    }

    const data = sortedExpenses.map((expense) => ({
      Data: expense.date ? (() => {
        const date = new Date(expense.date);
        return isNaN(date.getTime()) ? "" : format(date, "dd/MM/yyyy");
      })() : "",
      Descrição: expense.description || "",
      Categoria: expense.category || "",
      Fornecedor: expense.clients?.name || "",
      Status: expense.status || "",
      Valor: expense.amount || 0,
    }));

    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Despesas");
    
    const fileName = `Despesas_${format(new Date(), "dd-MM-yyyy")}.xlsx`;
    XLSX.writeFile(workbook, fileName);

    toast({
      title: "Sucesso",
      description: "Arquivo Excel exportado com sucesso!",
    });
  };

  return (
    <div className="w-full max-w-full overflow-x-hidden">
      <PageHeader
        title="Despesas"
        description="Gerencie todas as despesas e pagamentos"
        action={{
          label: "Nova Despesa",
          onClick: handleNewItem,
        }}
      />

      <QuickActions />

      {/* Cards de Valor Total e Saldo (Acumulado do Ano) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
        <Card 
          className="border-2 border-destructive/30 rounded-2xl shadow-elegant-lg bg-gradient-card hover:scale-[1.01] transition-all duration-300 cursor-pointer"
          onClick={() => setSelectedCard("expense")}
        >
          <CardContent className="p-4 sm:p-6">
            <div className="flex items-center justify-between">
              <div className="space-y-1 flex-1">
                  <p className="text-[10px] sm:text-xs font-semibold uppercase tracking-wider text-destructive">
                  VALOR TOTAL DE DESPESAS
                </p>
                <p className="text-[8px] sm:text-[9px] text-muted-foreground/70 font-medium">
                  Acumulado {financialStats.currentYear}
                  </p>
                <p className="text-xl sm:text-2xl md:text-3xl font-bold tracking-tight leading-none text-destructive break-words">
                  {formatCurrency(financialStats.totalExpenses)}
                  </p>
                </div>
                <div className="relative p-3 sm:p-4 md:p-5 rounded-lg sm:rounded-xl shadow-sm bg-destructive/10 text-destructive flex-shrink-0 ml-2 sm:ml-4">
                  <TrendingDown className="w-5 h-5 sm:w-6 sm:h-6 md:w-7 md:h-7" strokeWidth={2.5} />
                </div>
              </div>
          </CardContent>
        </Card>

        <Card 
          className="border-2 border-primary/30 rounded-2xl shadow-elegant-lg bg-gradient-card hover:scale-[1.01] transition-all duration-300 cursor-pointer"
          onClick={() => setSelectedCard("balance")}
        >
          <CardContent className="p-4 sm:p-6">
            <div className="flex items-center justify-between">
              <div className="space-y-1 flex-1">
                <p className="text-[10px] sm:text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  SALDO (RECEITAS - DESPESAS)
                </p>
                <p className="text-[8px] sm:text-[9px] text-muted-foreground/70 font-medium">
                  Acumulado {financialStats.currentYear}
                </p>
                <p className={`text-xl sm:text-2xl md:text-3xl font-bold tracking-tight leading-none break-words ${financialStats.saldo >= 0 ? 'text-success' : 'text-destructive'}`}>
                  {formatCurrency(financialStats.saldo)}
                </p>
                </div>
              <div className={`relative p-3 sm:p-4 md:p-5 rounded-lg sm:rounded-xl shadow-sm flex-shrink-0 ml-2 sm:ml-4 ${financialStats.saldo >= 0 ? 'bg-success/10 text-success' : 'bg-destructive/10 text-destructive'}`}>
                <DollarSign className="w-5 h-5 sm:w-6 sm:h-6 md:w-7 md:h-7" strokeWidth={2.5} />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Gráfico de Origem das Despesas */}
      {expenseByCategory.length > 0 && (
        <Card className="mb-6 border-2 border-border/50 rounded-2xl shadow-elegant-lg bg-gradient-to-br from-card to-card/95">
          <CardContent className="p-5 sm:p-6">
            <div className="mb-4">
              <h3 className="text-lg font-bold text-foreground">Origem das Despesas</h3>
              <p className="text-sm text-muted-foreground">Distribuição por categoria</p>
            </div>
                  <div className="w-full overflow-visible">
              <ResponsiveContainer width="100%" height={typeof window !== 'undefined' && window.innerWidth < 640 ? 320 : window.innerWidth < 768 ? 350 : 400} className="min-h-[320px] sm:min-h-[350px] md:min-h-[400px]">
                      <PieChart margin={{ top: 10, right: 10, bottom: typeof window !== 'undefined' && window.innerWidth < 640 ? 120 : 80, left: 10 }}>
                        <Pie
                          data={expenseByCategory}
                          cx="50%"
                          cy={typeof window !== 'undefined' && window.innerWidth < 640 ? "40%" : "45%"}
                          labelLine={false}
                          label={false}
                    outerRadius={typeof window !== 'undefined' && window.innerWidth < 640 ? 80 : 100}
                          fill="#8884d8"
                          dataKey="value"
                        >
                          {expenseByCategory.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip 
                          contentStyle={{ 
                            backgroundColor: 'hsl(var(--popover))', 
                            border: '1px solid hsl(var(--border))',
                            borderRadius: '0.75rem',
                            padding: typeof window !== 'undefined' && window.innerWidth < 640 ? '8px' : '12px',
                            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
                            fontSize: typeof window !== 'undefined' && window.innerWidth < 640 ? '11px' : '13px'
                          }}
                          formatter={(value: any) => formatCurrency(value)}
                        />
                        <Legend 
                          verticalAlign="bottom" 
                          height={typeof window !== 'undefined' && window.innerWidth < 640 ? 100 : 60}
                          iconType="circle"
                          wrapperStyle={{ 
                            paddingTop: typeof window !== 'undefined' && window.innerWidth < 640 ? '10px' : '20px',
                            fontSize: typeof window !== 'undefined' && window.innerWidth < 640 ? '10px' : '11px',
                            fontWeight: '500',
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            gap: typeof window !== 'undefined' && window.innerWidth < 640 ? '8px' : '12px',
                            width: '100%',
                            maxWidth: '100%',
                            overflow: 'visible',
                            lineHeight: '1.6',
                            wordBreak: 'break-word',
                            whiteSpace: 'normal'
                          }}
                          formatter={(value) => {
                            const maxLength = typeof window !== 'undefined' && window.innerWidth < 640 ? 20 : 30;
                            return value.length > maxLength ? value.substring(0, maxLength) + '...' : value;
                          }}
                        />
                      </PieChart>
                    </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Filtros e Busca */}
      <Card className="mb-6 border-2 border-border/50 rounded-2xl shadow-elegant-lg bg-gradient-to-br from-card to-card/95">
        <CardContent className="p-5 sm:p-6">
          <div className="flex flex-col gap-4">
            <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
              <div className="flex-1 w-full">
        <SmartSearchInput
          value={searchTerm}
          onChange={setSearchTerm}
          placeholder="Buscar por descrição, categoria, status..."
        />
              </div>
              <div className="flex gap-2 flex-wrap w-full sm:w-auto">
                <Button onClick={handleExportPDF} className="gap-2 shadow-elegant hover:shadow-elegant-lg flex-1 sm:flex-initial">
                  <FileText className="w-4 h-4" />
                  <span className="hidden sm:inline">Exportar PDF</span>
                  <span className="sm:hidden">PDF</span>
                </Button>
                <Button onClick={handleExportExcel} variant="outline" className="gap-2 shadow-sm hover:shadow-elegant flex-1 sm:flex-initial">
                  <Download className="w-4 h-4" />
                  <span className="hidden sm:inline">Exportar Excel</span>
                  <span className="sm:hidden">Excel</span>
                </Button>
              </div>
            </div>
        {searchTerm && (
              <div className="pt-3 border-t border-border/30">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-muted-foreground">
                    Mostrando <span className="font-semibold text-foreground">{resultCount}</span> de <span className="font-semibold text-foreground">{totalCount}</span> {totalCount === 1 ? "despesa" : "despesas"}
                  </span>
                  {searchTerm && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setSearchTerm("")}
                      className="text-xs h-7"
                    >
                      Limpar busca
                    </Button>
                  )}
                </div>
          </div>
        )}
      </div>
        </CardContent>
      </Card>

      <div className="bg-card rounded-2xl shadow-elegant-lg border border-border/50 overflow-hidden">
        <div ref={tableContainerRef} className="overflow-x-auto relative">
          <ScrollIndicator scrollContainerRef={tableContainerRef} direction="both" />
          <Table className="w-full border-separate border-spacing-0 min-w-[700px] sm:min-w-[900px] md:min-w-[1100px] lg:min-w-[1200px]">
          <TableHeader>
            <TableRow className="border-b-2 border-destructive/30 hover:bg-transparent">
              <TableHead className="bg-gradient-to-r from-destructive/10 to-destructive/5 backdrop-blur-sm font-bold border-r border-border/50 rounded-tl-xl text-xs text-center whitespace-nowrap">Data</TableHead>
              <TableHead className="bg-gradient-to-r from-destructive/10 to-destructive/5 backdrop-blur-sm font-bold border-r border-border/50 text-xs text-center whitespace-nowrap">Descrição</TableHead>
              <TableHead className="bg-gradient-to-r from-destructive/10 to-destructive/5 backdrop-blur-sm font-bold border-r border-border/50 text-xs text-center whitespace-nowrap">Categoria</TableHead>
              <TableHead className="bg-gradient-to-r from-destructive/10 to-destructive/5 backdrop-blur-sm font-bold border-r border-border/50 text-xs text-center whitespace-nowrap">Fornecedor</TableHead>
              <TableHead className="bg-gradient-to-r from-destructive/10 to-destructive/5 backdrop-blur-sm font-bold border-r border-border/50 text-xs text-center whitespace-nowrap">Status</TableHead>
              <TableHead className="bg-gradient-to-r from-destructive/10 to-destructive/5 backdrop-blur-sm font-bold border-r border-border/50 text-xs text-center whitespace-nowrap">Valor</TableHead>
              <TableHead className="bg-gradient-to-r from-destructive/10 to-destructive/5 backdrop-blur-sm font-bold border-r border-border/50 text-xs w-16 text-center whitespace-nowrap">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedExpenses?.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-12 text-muted-foreground/70 border-0">
                  <div className="flex flex-col items-center gap-2">
                    <div className="w-16 h-16 rounded-full bg-muted/30 border-2 border-border/50 flex items-center justify-center">
                      <span className="text-2xl">📊</span>
                    </div>
                    <span className="font-medium">Nenhuma despesa cadastrada</span>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              sortedExpenses?.map((expense, index) => (
                <TableRow 
                  key={expense.id} 
                  className={`border-b border-border/30 hover:bg-primary/5 transition-all duration-200 cursor-pointer group ${index % 2 === 0 ? "bg-card" : "bg-muted/5"}`}
                  onDoubleClick={() => handleEdit(expense)}
                >
                  <TableCell className="font-semibold text-foreground border-r border-border/30 px-1.5 sm:px-2 text-xs whitespace-nowrap text-center">
                    {expense.date ? (() => {
                      const date = new Date(expense.date);
                      return isNaN(date.getTime()) ? "-" : format(date, "dd/MM/yyyy");
                    })() : "-"}
                  </TableCell>
                  <TableCell className="font-semibold text-foreground border-r border-border/30 px-1.5 sm:px-2 text-xs max-w-[120px] text-center group-hover:text-primary transition-colors">
                    <div className="flex items-center justify-center gap-1 flex-wrap">
                      <span className="truncate">{expense.description}</span>
                      {expense.linked_source && (
                        <Badge variant="outline" className="text-[9px] px-1 py-0 h-4 bg-primary/10 text-primary border-primary/30">
                          🎯 {expense.linked_source}
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="font-medium text-foreground border-r border-border/30 px-1.5 sm:px-2 text-xs whitespace-nowrap text-center">{expense.category || "-"}</TableCell>
                  <TableCell className="font-medium text-foreground border-r border-border/30 px-1.5 sm:px-2 text-xs max-w-[100px] truncate text-center">{expense.clients?.name || "-"}</TableCell>
                  <TableCell className="border-r border-border/30 px-1.5 sm:px-2 text-xs text-center">
                    <span className={`px-1.5 py-0.5 rounded text-xs font-medium whitespace-nowrap ${getStatusColor(expense.status || "")}`}>
                      {expense.status || "N/A"}
                    </span>
                  </TableCell>
                  <TableCell className="text-center font-bold text-destructive border-r border-border/30 px-1.5 sm:px-2 text-xs whitespace-nowrap">
                    {formatCurrency(expense.amount)}
                  </TableCell>
                  <TableCell className="text-center border-r border-border/30 px-1.5 sm:px-2 text-xs w-16">
                    <div className="flex gap-1 justify-center">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleEdit(expense);
                        }}
                        aria-label="Editar despesa"
                        title="Editar despesa"
                        className="h-8 w-8 hover:bg-primary/10 hover:text-primary transition-all"
                      >
                        <Pencil className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDelete(expense.id);
                        }}
                        aria-label="Excluir despesa"
                        title="Excluir despesa"
                        className="h-8 w-8 text-destructive/70 hover:text-destructive hover:bg-destructive/10 transition-all"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
        </div>
      </div>

      <Dialog open={isDialogOpen} onOpenChange={(open) => {
        if (!open) {
          handleCloseDialog();
        } else {
          setIsDialogOpen(true);
        }
      }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editingId ? "Editar Despesa" : "Nova Despesa"}</DialogTitle>
            <DialogDescription>
              {editingId ? "Edite os dados da despesa abaixo." : "Preencha os dados para cadastrar uma nova despesa."}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={(e) => { e.preventDefault(); handleSubmit(e); }} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-4">
              <div className="space-y-2">
                <Label htmlFor="description">Descrição *</Label>
                <Input
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  onBlur={(e) => handleStandardizeInput(e.target.value, (value) => setFormData({ ...formData, description: value }))}
                  placeholder="Ex: Pagamento de fornecedor, manutenção, etc."
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="amount">Valor</Label>
                <Input
                  id="amount"
                  type="number"
                  step="0.01"
                  value={formData.amount}
                  onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-4">
              <div className="space-y-2">
                <Label htmlFor="date">A partir de... (Opcional)</Label>
                <Input
                  id="date"
                  type="date"
                  value={formData.date}
                  onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                  placeholder="Deixe vazio para começar hoje"
                />
                <p className="text-xs text-muted-foreground">
                  Se preenchido, a recorrência começa nesta data. Se vazio, começa hoje.
                </p>
              </div>
              {formData.frequency === "Única" && (
                <div className="space-y-2">
                  <Label htmlFor="status">Status</Label>
                  <Select value={formData.status || "PENDENTE"} onValueChange={(value) => setFormData({ ...formData, status: value })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-popover z-50">
                      <SelectItem value="PAGO">PAGO</SelectItem>
                      <SelectItem value="PENDENTE">PENDENTE</SelectItem>
                      <SelectItem value="AGENDADO">AGENDADO</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-4">
              <div className="space-y-2">
                <Label htmlFor="category">Categoria</Label>
                <Select value={formData.category || "none"} onValueChange={(value) => setFormData({ ...formData, category: value === "none" ? "" : value })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent className="bg-popover z-50">
                    <SelectItem value="none">Nenhuma</SelectItem>
                    <SelectItem value="Arrendamento">Arrendamento</SelectItem>
                    <SelectItem value="Funcionários">Funcionários</SelectItem>
                    <SelectItem value="Manutenção">Manutenção</SelectItem>
                    <SelectItem value="Empréstimos">Empréstimos</SelectItem>
                    <SelectItem value="Investimentos Gado">Investimentos Gado</SelectItem>
                    <SelectItem value="Outros">Outros</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-4">
              <div className="space-y-2">
                <Label htmlFor="frequency">Periodicidade</Label>
                <Select 
                  value={formData.frequency || "none"} 
                  onValueChange={(value) => {
                    // Resetar tipo e parcelas quando mudar a periodicidade principal
                    setFormData({ 
                      ...formData, 
                      frequency: value === "none" ? "" : value,
                      frequency_type: "",
                      installments: ""
                    });
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Nenhuma (Anual Fixo por padrão)" />
                  </SelectTrigger>
                  <SelectContent className="bg-popover z-50">
                    <SelectItem value="none">Nenhuma (Anual Fixo por padrão)</SelectItem>
                    <SelectItem value="Única">Única</SelectItem>
                    <SelectItem value="Mensal">Mensal</SelectItem>
                    <SelectItem value="Anual">Anual</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {(formData.frequency === "Mensal" || formData.frequency === "Anual") ? (
                <div className="space-y-2">
                  <Label htmlFor="frequency_type">Tipo de Periodicidade</Label>
                  <Select 
                    value={formData.frequency_type || "none"} 
                    onValueChange={(value) => {
                      setFormData({ 
                        ...formData, 
                        frequency_type: value === "none" ? "" : value,
                        installments: value === "tempo_determinado" ? formData.installments : ""
                      });
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o tipo" />
                    </SelectTrigger>
                    <SelectContent className="bg-popover z-50">
                      <SelectItem value="none">Nenhum (será considerado Fixo)</SelectItem>
                      <SelectItem value="tempo_determinado">{formData.frequency === "Mensal" ? "Mensal por Tempo Determinado" : "Anual por Tempo Determinado"}</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    Se não selecionar, será considerado {formData.frequency === "Mensal" ? "Mensal Fixo" : "Anual Fixo"}.
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  <Label htmlFor="status">Status</Label>
                  <Select value={formData.status || "PENDENTE"} onValueChange={(value) => setFormData({ ...formData, status: value })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-popover z-50">
                      <SelectItem value="PAGO">PAGO</SelectItem>
                      <SelectItem value="PENDENTE">PENDENTE</SelectItem>
                      <SelectItem value="AGENDADO">AGENDADO</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>

            {/* Campo de Parcelas - aparece quando é por tempo determinado */}
            {formData.frequency_type === "tempo_determinado" && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-4">
                <div className="space-y-2">
                  <Label htmlFor="installments">Quantidade de Parcelas *</Label>
                  <Input
                    id="installments"
                    type="number"
                    min="1"
                    value={formData.installments}
                    onChange={(e) => setFormData({ ...formData, installments: e.target.value })}
                    placeholder="Ex: 12"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="status">Status</Label>
                  <Select value={formData.status || "PENDENTE"} onValueChange={(value) => setFormData({ ...formData, status: value })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-popover z-50">
                      <SelectItem value="PAGO">PAGO</SelectItem>
                      <SelectItem value="PENDENTE">PENDENTE</SelectItem>
                      <SelectItem value="AGENDADO">AGENDADO</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-4 border-t">
              <Button type="button" variant="outline" onClick={handleCloseDialog}>
                Cancelar
              </Button>
              <Button type="submit">
                {editingId ? "Atualizar" : "Cadastrar"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Dialog de Detalhes dos Cards */}
      <Dialog open={selectedCard !== null} onOpenChange={(open) => !open && setSelectedCard(null)}>
        <DialogContent className="max-w-5xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {selectedCard === "expense" 
                ? `Detalhes - Valor Total de Despesas (${financialStats.currentYear})`
                : `Detalhes - Saldo (Receitas - Despesas) (${financialStats.currentYear})`
              }
            </DialogTitle>
            <DialogDescription>
              {selectedCard === "expense"
                ? `Explicação detalhada do cálculo do valor total de despesas acumulado em ${financialStats.currentYear}.`
                : `Explicação detalhada do cálculo do saldo (receitas - despesas) acumulado em ${financialStats.currentYear}.`
              }
            </DialogDescription>
          </DialogHeader>
          
          {selectedCard === "expense" ? (
            <div className="space-y-6">
              {/* Explicação do Cálculo */}
              <div className="bg-destructive/5 border-2 border-destructive/20 rounded-lg p-4 space-y-3">
                <h3 className="font-bold text-lg text-foreground">Como é calculado o Valor Total de Despesas?</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold">Fórmula:</span>
                    <span className="bg-card px-2 py-1 rounded border border-border">
                      Soma de todas as despesas do ano {financialStats.currentYear}
                    </span>
                  </div>
                  <div className="grid grid-cols-1 gap-2 pt-2 border-t border-border/30">
                    <div className="flex justify-between items-center">
                      <span className="text-muted-foreground">Total de despesas encontradas:</span>
                      <span className="font-semibold">{financialStats.expensesThisYear.length} {financialStats.expensesThisYear.length === 1 ? "despesa" : "despesas"}</span>
                    </div>
                    <div className="flex justify-between items-center pt-2 border-t-2 border-destructive/30">
                      <span className="font-bold text-lg">Valor Total de Despesas:</span>
                      <span className="font-bold text-lg text-destructive">{formatCurrency(financialStats.totalExpenses)}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Lista de Despesas */}
              <div className="space-y-3">
                <h3 className="font-bold text-lg text-foreground">Despesas que compõem o total ({financialStats.expensesThisYear.length}):</h3>
                <div className="max-h-[400px] overflow-y-auto border border-border/30 rounded-lg">
            <Table>
              <TableHeader>
                <TableRow>
                        <TableHead>Data</TableHead>
                  <TableHead>Descrição</TableHead>
                  <TableHead>Categoria</TableHead>
                  <TableHead>Status</TableHead>
                        <TableHead className="text-right">Valor</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                      {financialStats.expensesThisYear.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                            Nenhuma despesa encontrada para o ano {financialStats.currentYear}
                          </TableCell>
                        </TableRow>
                      ) : (
                        financialStats.expensesThisYear.map((expense: any) => (
                  <TableRow key={expense.id}>
                            <TableCell className="text-xs">
                              {expense.date ? (() => {
                                const date = new Date(expense.date);
                                return isNaN(date.getTime()) ? "-" : format(date, "dd/MM/yyyy");
                              })() : "-"}
                    </TableCell>
                            <TableCell className="font-medium text-xs max-w-[200px] truncate">{expense.description || "-"}</TableCell>
                            <TableCell className="text-xs">{expense.category || "-"}</TableCell>
                            <TableCell className="text-xs">
                              <Badge variant={expense.status === "PAGO" ? "default" : expense.status === "PENDENTE" ? "destructive" : "secondary"} className="text-[10px]">
                        {expense.status || "PENDENTE"}
                      </Badge>
                    </TableCell>
                            <TableCell className="text-right font-bold text-destructive text-xs">
                              {formatCurrency(expense.amount || 0)}
                            </TableCell>
                  </TableRow>
                        ))
                      )}
              </TableBody>
            </Table>
          </div>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Explicação do Cálculo */}
              <div className="bg-primary/5 border-2 border-primary/20 rounded-lg p-4 space-y-3">
                <h3 className="font-bold text-lg text-foreground">Como é calculado o Saldo?</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold">Fórmula:</span>
                    <span className="bg-card px-2 py-1 rounded border border-border">
                      Total de Receitas - Total de Despesas = Saldo
                    </span>
                  </div>
                  <div className="grid grid-cols-1 gap-2 pt-2 border-t border-border/30">
                    <div className="flex justify-between items-center">
                      <span className="text-muted-foreground">Total de Receitas ({financialStats.currentYear}):</span>
                      <span className="font-semibold text-success">{formatCurrency(financialStats.totalRevenue)}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-muted-foreground">Total de Despesas ({financialStats.currentYear}):</span>
                      <span className="font-semibold text-destructive">{formatCurrency(financialStats.totalExpenses)}</span>
                    </div>
                    <div className="flex justify-between items-center pt-2 border-t-2 border-primary/30">
                      <span className="font-bold text-lg">Cálculo:</span>
                      <span className="font-semibold text-primary">
                        {formatCurrency(financialStats.totalRevenue)} - {formatCurrency(financialStats.totalExpenses)}
                      </span>
                    </div>
                    <div className="flex justify-between items-center pt-2 border-t-2 border-primary/30">
                      <span className="font-bold text-lg">Saldo Final:</span>
                      <span className={`font-bold text-lg ${financialStats.saldo >= 0 ? 'text-success' : 'text-destructive'}`}>
                        {formatCurrency(financialStats.saldo)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Resumo */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-3">
                  <h3 className="font-bold text-lg text-success">Receitas ({financialStats.revenuesThisYear.length}):</h3>
                  <div className="max-h-[300px] overflow-y-auto border border-border/30 rounded-lg">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="text-xs">Data</TableHead>
                          <TableHead className="text-xs">Descrição</TableHead>
                          <TableHead className="text-xs text-right">Valor</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {financialStats.revenuesThisYear.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={3} className="text-center py-4 text-muted-foreground text-xs">
                              Nenhuma receita
                            </TableCell>
                          </TableRow>
                        ) : (
                          financialStats.revenuesThisYear.map((revenue: any) => (
                            <TableRow key={revenue.id}>
                              <TableCell className="text-xs">
                                {revenue.date ? (() => {
                                  const date = new Date(revenue.date);
                                  return isNaN(date.getTime()) ? "-" : format(date, "dd/MM/yyyy");
                                })() : "-"}
                              </TableCell>
                              <TableCell className="font-medium text-xs max-w-[150px] truncate">{revenue.description || "-"}</TableCell>
                              <TableCell className="text-right font-bold text-success text-xs">
                                {formatCurrency(revenue.amount || 0)}
                              </TableCell>
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </div>

                <div className="space-y-3">
                  <h3 className="font-bold text-lg text-destructive">Despesas ({financialStats.expensesThisYear.length}):</h3>
                  <div className="max-h-[300px] overflow-y-auto border border-border/30 rounded-lg">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="text-xs">Data</TableHead>
                          <TableHead className="text-xs">Descrição</TableHead>
                          <TableHead className="text-xs text-right">Valor</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {financialStats.expensesThisYear.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={3} className="text-center py-4 text-muted-foreground text-xs">
                              Nenhuma despesa
                            </TableCell>
                          </TableRow>
                        ) : (
                          financialStats.expensesThisYear.map((expense: any) => (
                            <TableRow key={expense.id}>
                              <TableCell className="text-xs">
                                {expense.date ? (() => {
                                  const date = new Date(expense.date);
                                  return isNaN(date.getTime()) ? "-" : format(date, "dd/MM/yyyy");
                                })() : "-"}
                              </TableCell>
                              <TableCell className="font-medium text-xs max-w-[150px] truncate">{expense.description || "-"}</TableCell>
                              <TableCell className="text-right font-bold text-destructive text-xs">
                                {formatCurrency(expense.amount || 0)}
                              </TableCell>
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Dialog de Confirmação de Exclusão */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar Exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir esta despesa? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

