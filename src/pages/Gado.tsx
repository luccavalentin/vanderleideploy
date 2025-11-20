import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/layout/PageHeader";
import { StatsCard } from "@/components/layout/StatsCard";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { useTableSort } from "@/hooks/useTableSort";
import { useSmartSearch } from "@/hooks/useSmartSearch";
import { SmartSearchInput } from "@/components/SmartSearchInput";
import { StateSearchInput } from "@/components/StateSearchInput";
import { Pencil, Trash2, Download, Package, MapPin, DollarSign, Heart, FileText, TrendingUp, TrendingDown, Settings } from "lucide-react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { standardizeText, handleStandardizeInput, formatCurrencyInput, parseCurrency, normalizeConstraintValue } from "@/lib/validations";
import * as XLSX from "xlsx";

export default function Gado() {
  const navigate = useNavigate();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [cattleToDelete, setCattleToDelete] = useState<string | null>(null);
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [healthFilter, setHealthFilter] = useState<string>("all");
  const [detailsDialogOpen, setDetailsDialogOpen] = useState(false);
  const [selectedStat, setSelectedStat] = useState<string | null>(null);
  const [priceConfigDialogOpen, setPriceConfigDialogOpen] = useState(false);
  const [tempArrobaPrice, setTempArrobaPrice] = useState<string>("");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Preço do @ (arroba) - padrão R$ 310,00, pode ser alterado
  const [arrobaPrice, setArrobaPrice] = useState<number>(() => {
    const saved = localStorage.getItem('cattle_arroba_price');
    return saved ? parseFloat(saved) : 310;
  });

  const [formData, setFormData] = useState({
    description: "",
    category: "Fêmea",
    origin: "Mato Grosso (MT)",
    quantity: "",
    age_months: "",
    health_status: "Boa",
    location: "",
    purchase_price: "",
    purchase_date: "",
    weight: "", // Peso em kg
  });

  const { data: cattle, isLoading: cattleLoading } = useQuery({
    queryKey: ["cattle"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cattle")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
    retry: 2,
    retryDelay: 1000,
    staleTime: 300000, // Cache por 5 minutos
    refetchOnMount: true, // Buscar na montagem inicial
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    gcTime: 600000, // 10 minutos
  });

  const { searchTerm, setSearchTerm, filteredData: filteredCattle, resultCount, totalCount } = useSmartSearch(
    cattle,
    ["category", "origin", "location", "health_status"]
  );

  // Aplicar filtros adicionais
  const filteredByFilters = useMemo(() => {
    if (!filteredCattle) return [];
    let filtered = filteredCattle;
    
    if (categoryFilter !== "all") {
      filtered = filtered.filter((c: any) => {
        const category = (c.category || "").trim();
        return category === categoryFilter || category.toUpperCase() === categoryFilter.toUpperCase();
      });
    }
    
    if (healthFilter !== "all") {
      filtered = filtered.filter((c: any) => c.health_status === healthFilter);
    }
    
    return filtered;
  }, [filteredCattle, categoryFilter, healthFilter]);

  const { sortedData: sortedCattle, SortButton } = useTableSort(filteredByFilters);

  // Estatísticas
  const stats = useMemo(() => {
    if (!cattle) return { total: "0", femeas: "0", machos: "0", totalValue: 0, totalQuantity: 0 };
    
    // Soma as quantidades de fêmeas (não conta registros, soma as quantidades)
    // Compara "Fêmea" (padronizado) e variações em maiúsculas/minúsculas
    const femeas = cattle
      .filter((c: any) => {
        const category = (c.category || "").trim();
        const categoryUpper = category.toUpperCase();
        return category === "Fêmea" || categoryUpper === "FÊMEA" || categoryUpper === "FEMEA" || categoryUpper === "BEZERRA" || categoryUpper === "NOVILHA";
      })
      .reduce((sum: number, c: any) => {
      const quantity = parseInt(c.quantity) || 0;
      return sum + quantity;
    }, 0);
    
    // Soma as quantidades de machos (não conta registros, soma as quantidades)
    // Compara "Macho" (padronizado) e variações em maiúsculas/minúsculas
    const machos = cattle
      .filter((c: any) => {
        const category = (c.category || "").trim();
        const categoryUpper = category.toUpperCase();
        return category === "Macho" || categoryUpper === "MACHO" || categoryUpper === "BEZERRO" || categoryUpper === "NOVILHO";
      })
      .reduce((sum: number, c: any) => {
        const quantity = parseInt(c.quantity) || 0;
        return sum + quantity;
      }, 0);
    
    // Quantidade total: soma todas as quantidades de cada lote (fêmeas + machos)
    const totalQuantity = femeas + machos;
    
    // Total de registros (para informação, mas não usado nos cards principais)
    const totalRegistros = cattle.length;
    
    return { 
      total: totalQuantity.toString(), // Total de gado (soma de fêmeas + machos)
      femeas: femeas.toString(), 
      machos: machos.toString(), 
      totalValue: 0, // Não usado mais, o valor total vem do weightCalculator
      totalQuantity: totalQuantity.toString(),
      totalRegistros: totalRegistros.toString() // Total de registros/lotes
    };
  }, [cattle]);

  // Calculadora de Peso e Valor Total
  const weightCalculator = useMemo(() => {
    if (!cattle || cattle.length === 0) {
      return {
        totalWeightKg: 0,
        totalWeightArroba: 0,
        totalValue: 0,
        totalSaleValue: 0,
        totalCost: 0,
        totalProfit: 0,
        hasPurchasePrice: false
      };
    }

    // Soma o peso total: weight já é o peso total do lote, não precisa multiplicar por quantity
    const totalWeightKg = cattle.reduce((sum: number, c: any) => {
      const weight = parseFloat(c.weight || 0);
      return sum + weight;
    }, 0);

    // Converte para arroba (1 @ = 15 kg)
    const totalWeightArroba = totalWeightKg / 15;

    // Calcula o valor total: VALOR DO ARROBA X A QUANTIDADE DE KG = VALOR TOTAL
    const totalSaleValue = arrobaPrice * totalWeightKg;

    // Soma o custo total de compra e verifica se há algum preço informado
    const totalCost = cattle.reduce((sum: number, c: any) => {
      const cost = parseFloat(c.purchase_price || 0);
      return sum + cost;
    }, 0);

    // Verifica se há pelo menos um gado com preço de compra informado
    const hasPurchasePrice = cattle.some((c: any) => c.purchase_price && parseFloat(c.purchase_price) > 0);

    // Calcula o lucro total (valor de venda - custo de compra)
    const totalProfit = totalSaleValue - totalCost;

    return {
      totalWeightKg,
      totalWeightArroba,
      totalValue: totalProfit, // Valor Total agora é o lucro
      totalSaleValue, // Valor de venda (para referência)
      totalCost, // Custo total (para referência)
      totalProfit, // Lucro total
      hasPurchasePrice // Indica se há pelo menos um preço de compra informado
    };
  }, [cattle, arrobaPrice]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  const handleSaveArrobaPrice = () => {
    const price = parseFloat(tempArrobaPrice);
    if (isNaN(price) || price <= 0) {
      toast({
        title: "Erro",
        description: "Por favor, informe um valor válido maior que zero.",
        variant: "destructive",
      });
      return;
    }
    setArrobaPrice(price);
    localStorage.setItem('cattle_arroba_price', price.toString());
    setPriceConfigDialogOpen(false);
    setTempArrobaPrice("");
    toast({
      title: "Sucesso",
      description: `Preço do @ atualizado para ${formatCurrency(price)}`,
    });
  };

  const handleOpenPriceConfig = () => {
    setTempArrobaPrice(arrobaPrice.toString());
    setPriceConfigDialogOpen(true);
  };

  const [keepDialogOpen, setKeepDialogOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      const { error } = await supabase.from("cattle").insert([data]);
      if (error) throw error;
    },
    onSuccess: async () => {
      // Invalidar e refetch para garantir que os dados sejam atualizados
      await queryClient.invalidateQueries({ queryKey: ["cattle"] });
      await queryClient.refetchQueries({ queryKey: ["cattle"] });
      setIsSubmitting(false);
      // toast({ title: "Gado cadastrado com sucesso!" });
      if (keepDialogOpen) {
        setFormData({
          description: "",
          category: "Fêmea",
          origin: "Mato Grosso (MT)",
          quantity: "",
          age_months: "",
          health_status: "Boa",
          location: "",
          purchase_price: "",
          purchase_date: "",
          weight: "",
        });
        setKeepDialogOpen(false);
      } else {
        handleCloseDialog();
      }
    },
    onError: (error: any) => {
      setIsSubmitting(false);
      toast({
        title: "Erro ao cadastrar gado",
        description: error.message || "Ocorreu um erro ao salvar. Tente novamente.",
        variant: "destructive",
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      const { error } = await supabase.from("cattle").update(data).eq("id", id);
      if (error) throw error;
    },
    onSuccess: async () => {
      // Invalidar e refetch para garantir que os dados sejam atualizados
      await queryClient.invalidateQueries({ queryKey: ["cattle"] });
      await queryClient.refetchQueries({ queryKey: ["cattle"] });
      setIsSubmitting(false);
      toast({ title: "Gado atualizado com sucesso!" });
      handleCloseDialog();
    },
    onError: (error: any) => {
      setIsSubmitting(false);
      toast({
        title: "Erro ao atualizar gado",
        description: error.message || "Ocorreu um erro ao atualizar. Tente novamente.",
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("cattle").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["cattle"] });
      toast({ title: "Gado excluído com sucesso!" });
      setDeleteDialogOpen(false);
      setCattleToDelete(null);
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao excluir gado",
        description: error.message || "Ocorreu um erro ao excluir. Tente novamente.",
        variant: "destructive",
      });
      setDeleteDialogOpen(false);
      setCattleToDelete(null);
    },
  });

  const handleDelete = (id: string) => {
    setCattleToDelete(id);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = () => {
    if (cattleToDelete) {
      deleteMutation.mutate(cattleToDelete);
    }
  };

  const handleExportPDF = () => {
    if (!cattle || cattle.length === 0) {
      toast({
        title: "Nenhum dado para exportar",
        description: "Não há gado cadastrado para exportar.",
        variant: "destructive",
      });
      return;
    }

    try {
      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.getWidth();
      const margin = 15;
      let yPosition = margin;

      doc.setFontSize(18);
      doc.setFont("helvetica", "bold");
      doc.text("Relatório de Gado", pageWidth / 2, yPosition, { align: "center" });
      yPosition += 8;

      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      doc.text(`Gerado em: ${format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}`, pageWidth / 2, yPosition, { align: "center" });
      yPosition += 15;

      const tableData = cattle.map((c: any) => [
        c.category || "",
        c.origin || "",
        c.quantity || "",
        c.age_months || "",
        c.health_status || "",
        c.location || "",
        c.purchase_price ? formatCurrency(c.purchase_price) : "não informado",
        c.purchase_date ? format(new Date(c.purchase_date), "dd/MM/yyyy", { locale: ptBR }) : "",
      ]);

      autoTable(doc, {
        startY: yPosition,
        head: [["Categoria", "Origem", "Quantidade", "Idade (meses)", "Status Saúde", "Localização", "Preço Compra", "Data Compra"]],
        body: tableData,
        theme: "striped",
        headStyles: { fillColor: [33, 150, 243], textColor: 255, fontStyle: "bold" },
        styles: { fontSize: 7 },
        margin: { left: margin, right: margin },
      });

      const fileName = `Gado_${format(new Date(), "dd-MM-yyyy")}.pdf`;
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
    if (!cattle || cattle.length === 0) {
      toast({
        title: "Nenhum dado para exportar",
        description: "Não há gado cadastrado para exportar.",
        variant: "destructive",
      });
      return;
    }

    const data = cattle.map((c: any) => ({
      Categoria: c.category || "",
      Origem: c.origin || "",
      Quantidade: c.quantity || "",
      "Idade (meses)": c.age_months || "",
      "Status de Saúde": c.health_status || "",
      Localização: c.location || "",
      "Preço de Compra": c.purchase_price ? formatCurrency(c.purchase_price) : "não informado",
      "Data de Compra": c.purchase_date ? format(new Date(c.purchase_date), "dd/MM/yyyy", { locale: ptBR }) : "",
    }));

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Gado");
    XLSX.writeFile(wb, `gado_${format(new Date(), "yyyy-MM-dd")}.xlsx`);

    toast({
      title: "Exportação concluída",
      description: `${cattle.length} registro(s) exportado(s) com sucesso.`,
    });
  };

  const handleSubmitAndNew = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    setKeepDialogOpen(true);
    setIsSubmitting(true);
    await handleSubmitLogic();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    setKeepDialogOpen(false);
    setIsSubmitting(true);
    await handleSubmitLogic();
  };

  const handleSubmitLogic = async () => {
    // Normalizar category para "Fêmea" ou "Macho" (primeira letra maiúscula, resto minúscula)
    let normalizedCategory = formData.category || null;
    if (normalizedCategory) {
      const categoryUpper = normalizedCategory.toUpperCase().trim();
      if (categoryUpper === "FÊMEA" || categoryUpper === "FEMEA" || categoryUpper === "BEZERRA" || categoryUpper === "NOVILHA") {
        normalizedCategory = "Fêmea";
      } else if (categoryUpper === "MACHO" || categoryUpper === "BEZERRO" || categoryUpper === "NOVILHO") {
        normalizedCategory = "Macho";
      } else {
        // Se não for reconhecido, mantém o valor original mas padroniza
        normalizedCategory = normalizedCategory.charAt(0).toUpperCase() + normalizedCategory.slice(1).toLowerCase();
      }
    }

    const data = {
      description: formData.description ? standardizeText(formData.description) : null,
      category: normalizedCategory,
      location: formData.location ? standardizeText(formData.location) : null,
      origin: formData.origin ? standardizeText(formData.origin) : null,
      health_status: normalizeConstraintValue("health_status", formData.health_status), // Normaliza para 'Boa', 'Regular', 'Ruim'
      quantity: formData.quantity ? parseInt(formData.quantity) : 1,
      age_months: formData.age_months ? parseInt(formData.age_months) : null,
      weight: formData.weight ? parseFloat(formData.weight) : null,
      purchase_price: formData.purchase_price ? parseFloat(formData.purchase_price) : null,
      purchase_date: formData.purchase_date || null,
    };

    if (editingId) {
      await updateMutation.mutateAsync({ id: editingId, data });
    } else {
      await createMutation.mutateAsync(data);
    }
  };

  const handleEdit = (item: any) => {
    setEditingId(item.id);
    setFormData({
      description: item.description || "",
      category: item.category,
      origin: item.origin,
      quantity: item.quantity.toString(),
      age_months: item.age_months?.toString() || "",
      health_status: item.health_status || "Boa",
      location: item.location || "",
      purchase_price: item.purchase_price?.toString() || "",
      purchase_date: item.purchase_date || "",
      weight: item.weight?.toString() || "",
    });
    setIsDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setIsDialogOpen(false);
    setEditingId(null);
    setIsSubmitting(false);
    setFormData({
      description: "",
      category: "Fêmea",
      origin: "Mato Grosso (MT)",
      quantity: "",
      age_months: "",
      health_status: "Boa",
      location: "",
      purchase_price: "",
      purchase_date: "",
      weight: "",
    });
  };

  const handleNewItem = () => {
    setEditingId(null);
    setFormData({
      description: "",
      category: "Fêmea",
      origin: "Mato Grosso (MT)",
      quantity: "",
      age_months: "",
      health_status: "Boa",
      location: "",
      purchase_price: "",
      purchase_date: "",
      weight: "",
    });
    setIsDialogOpen(true);
  };

  return (
    <div className="w-full max-w-full overflow-x-hidden">
      <PageHeader
        title="Gado"
        description="Gerencie todo o rebanho"
        action={{
          label: "Novo Lote",
          onClick: handleNewItem,
        }}
      />

      {/* Calculadora de Peso e Valor Total */}
      <Card className="mb-6 border-2 border-primary/30 bg-gradient-to-br from-primary/5 to-primary/10 shadow-elegant-lg">
        <CardContent className="p-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex-1 w-full">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-lg font-bold text-foreground flex items-center gap-2">
                <Package className="w-5 h-5 text-primary" />
                Calculadora de Gado
              </h3>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleOpenPriceConfig}
                  className="gap-2"
                >
                  <Settings className="w-4 h-4" />
                  <span className="hidden sm:inline">Configurar Preço do @</span>
                  <span className="sm:hidden">Preço @</span>
                </Button>
              </div>
              <p className="text-sm text-muted-foreground mb-4">
                Peso total e valor estimado do rebanho
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                <div className="bg-card/50 rounded-lg p-3 sm:p-4 border border-border/50 hover:border-primary/30 transition-colors">
                  <p className="text-[10px] sm:text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                    PESO TOTAL (KG)
                  </p>
                  <p className="text-lg sm:text-xl md:text-2xl font-bold text-foreground break-words leading-tight">
                    {weightCalculator.totalWeightKg.toLocaleString('pt-BR', { 
                      minimumFractionDigits: 2, 
                      maximumFractionDigits: 2 
                    })} <span className="text-xs sm:text-sm font-normal text-muted-foreground">kg</span>
                  </p>
                </div>
                <div className="bg-card/50 rounded-lg p-3 sm:p-4 border border-border/50 hover:border-primary/30 transition-colors relative">
                  <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[1px] h-3/4 bg-border/50"></div>
                  <p className="text-[10px] sm:text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                    PESO TOTAL (@)
                  </p>
                  <p className="text-lg sm:text-xl md:text-2xl font-bold text-primary break-words leading-tight">
                    {weightCalculator.totalWeightArroba.toLocaleString('pt-BR', { 
                      minimumFractionDigits: 2, 
                      maximumFractionDigits: 2 
                    })} <span className="text-xs sm:text-sm font-normal text-muted-foreground">@</span>
                  </p>
                </div>
                <div className="bg-card/50 rounded-lg p-3 sm:p-4 border border-border/50 hover:border-warning/30 transition-colors relative">
                  <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[1px] h-3/4 bg-border/50"></div>
                  <p className="text-[10px] sm:text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                    VALOR DO @
                  </p>
                  <p className="text-lg sm:text-xl md:text-2xl font-bold text-warning break-words leading-tight">
                    {formatCurrency(arrobaPrice)}
                  </p>
                </div>
                <div className="bg-card/50 rounded-lg p-3 sm:p-4 border border-border/50 hover:border-success/30 transition-colors relative">
                  <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[1px] h-3/4 bg-border/50"></div>
                  <p className="text-[10px] sm:text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                    LUCRO TOTAL (R$)
                  </p>
                  {!weightCalculator.hasPurchasePrice && cattle && cattle.length > 0 ? (
                    <p className="text-[10px] sm:text-xs text-muted-foreground italic leading-tight" style={{ 
                      wordBreak: 'break-word', 
                      overflowWrap: 'break-word',
                      lineHeight: '1.4'
                    }}>
                      Para calcular lucro informe o valor de compra de cada gado
                    </p>
                  ) : (
                    <>
                  <p className={`text-sm sm:text-base md:text-lg lg:text-xl xl:text-2xl font-bold break-words leading-tight ${weightCalculator.totalValue >= 0 ? 'text-success' : 'text-destructive'}`} style={{ 
                    wordBreak: 'break-word', 
                    overflowWrap: 'break-word',
                    lineHeight: '1.2'
                  }}>
                    {formatCurrency(weightCalculator.totalValue)}
                  </p>
                  <p className="text-[10px] sm:text-xs text-muted-foreground mt-2 pt-2 border-t border-border/30">
                    Venda: {formatCurrency(weightCalculator.totalSaleValue)} | Custo: {formatCurrency(weightCalculator.totalCost)}
                  </p>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Botões de Custos e Receitas com Gado */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
        <Card className="border-2 border-destructive/30 hover:border-destructive/50 transition-colors cursor-pointer hover:shadow-lg">
          <CardContent className="p-6">
            <Button
              variant="ghost"
              className="w-full h-auto p-0 flex flex-col items-start gap-3 hover:bg-transparent"
              onClick={() => navigate("/despesas?novo=1&categoria=Gado")}
            >
              <div className="flex items-center gap-3 w-full">
                <div className="p-3 rounded-lg bg-destructive/10">
                  <TrendingDown className="h-6 w-6 text-destructive" />
                </div>
                <div className="flex-1 text-left">
                  <h3 className="font-bold text-lg text-foreground">Custos com os Gados</h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    Cadastrar nova despesa relacionada ao gado
                  </p>
                </div>
              </div>
            </Button>
          </CardContent>
        </Card>

        <Card className="border-2 border-success/30 hover:border-success/50 transition-colors cursor-pointer hover:shadow-lg">
          <CardContent className="p-6">
            <Button
              variant="ghost"
              className="w-full h-auto p-0 flex flex-col items-start gap-3 hover:bg-transparent"
              onClick={() => navigate("/receitas?novo=1&categoria=Gado&linked_source=Gado")}
            >
              <div className="flex items-center gap-3 w-full">
                <div className="p-3 rounded-lg bg-success/10">
                  <TrendingUp className="h-6 w-6 text-success" />
                </div>
                <div className="flex-1 text-left">
                  <h3 className="font-bold text-lg text-foreground">Receitas com os Gados</h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    Cadastrar nova receita relacionada ao gado
                  </p>
                </div>
              </div>
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Cards de Estatísticas */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
        <StatsCard
          title="Total de Gado"
          value={stats.total}
          icon={Package}
          className="bg-gradient-to-br from-primary/10 to-primary/5"
          onClick={() => {
            setSelectedStat("total");
            setDetailsDialogOpen(true);
          }}
        />
        <StatsCard
          title="Fêmeas"
          value={stats.femeas}
          icon={Package}
          className="bg-gradient-to-br from-pink-500/10 to-pink-500/5"
          onClick={() => {
            setSelectedStat("femeas");
            setDetailsDialogOpen(true);
          }}
        />
        <StatsCard
          title="Machos"
          value={stats.machos}
          icon={Package}
          className="bg-gradient-to-br from-blue-500/10 to-blue-500/5"
          onClick={() => {
            setSelectedStat("machos");
            setDetailsDialogOpen(true);
          }}
        />
        <StatsCard
          title="Quantidade Total"
          value={stats.totalQuantity}
          icon={Package}
          className="bg-gradient-to-br from-success/10 to-success/5"
          onClick={() => {
            setSelectedStat("quantity");
            setDetailsDialogOpen(true);
          }}
        />
        <StatsCard
          title="Valor Total de Venda"
          value={formatCurrency(weightCalculator.totalSaleValue)}
          icon={DollarSign}
          variant="warning"
          className="bg-gradient-to-br from-warning/10 to-warning/5"
          onClick={() => {
            setSelectedStat("value");
            setDetailsDialogOpen(true);
          }}
        />
      </div>

      {/* Filtros e Busca */}
      <Card className="mb-4 border-2 border-border/50 rounded-2xl shadow-elegant-lg">
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
            <div className="flex-1 w-full">
        <SmartSearchInput
          value={searchTerm}
          onChange={setSearchTerm}
          placeholder="Buscar por categoria, origem, localização, saúde..."
        />
            </div>
            <div className="flex gap-2 flex-wrap">
              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue placeholder="Categoria" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas Categorias</SelectItem>
                  <SelectItem value="Fêmea">Fêmea</SelectItem>
                  <SelectItem value="Macho">Macho</SelectItem>
                </SelectContent>
              </Select>
              <Select value={healthFilter} onValueChange={setHealthFilter}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue placeholder="Saúde" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos Status</SelectItem>
                  <SelectItem value="Boa">Boa</SelectItem>
                  <SelectItem value="Regular">Regular</SelectItem>
                  <SelectItem value="Ruim">Ruim</SelectItem>
                </SelectContent>
              </Select>
              <Button onClick={handleExportPDF} className="gap-2 shadow-elegant hover:shadow-elegant-lg">
                <FileText className="w-4 h-4" />
                <span className="hidden sm:inline">Exportar PDF</span>
                <span className="sm:hidden">PDF</span>
              </Button>
              <Button onClick={handleExportExcel} variant="outline" className="gap-2 shadow-sm hover:shadow-elegant">
                <Download className="w-4 h-4" />
                <span className="hidden sm:inline">Exportar Excel</span>
                <span className="sm:hidden">Excel</span>
              </Button>
            </div>
          </div>
        {searchTerm && (
            <div className="mt-3 text-sm text-muted-foreground">
            Mostrando {resultCount} de {totalCount} {resultCount === 1 ? "lote" : "lotes"}
          </div>
        )}
        </CardContent>
      </Card>

      <div className="bg-card rounded-2xl shadow-elegant-lg border border-border/50 overflow-x-auto">
        <Table className="w-full border-separate border-spacing-0 min-w-[1200px]">
          <TableHeader>
            <TableRow className="border-b-2 border-primary/30 hover:bg-transparent">
              <TableHead className="bg-gradient-to-r from-primary/10 to-primary/5 backdrop-blur-sm font-bold border-r border-border/50 rounded-tl-xl px-1.5 sm:px-2 text-xs text-center">Descrição</TableHead>
              <TableHead className="bg-gradient-to-r from-primary/10 to-primary/5 backdrop-blur-sm font-bold border-r border-border/50 px-1.5 sm:px-2 text-xs text-center">Categoria</TableHead>
              <TableHead className="bg-gradient-to-r from-primary/10 to-primary/5 backdrop-blur-sm font-bold border-r border-border/50 px-1.5 sm:px-2 text-xs text-center">Origem</TableHead>
              <TableHead className="bg-gradient-to-r from-primary/10 to-primary/5 backdrop-blur-sm font-bold border-r border-border/50 px-1.5 sm:px-2 text-xs text-center">Quantidade</TableHead>
              <TableHead className="bg-gradient-to-r from-primary/10 to-primary/5 backdrop-blur-sm font-bold border-r border-border/50 px-1.5 sm:px-2 text-xs text-center">Idade (meses)</TableHead>
              <TableHead className="bg-gradient-to-r from-primary/10 to-primary/5 backdrop-blur-sm font-bold border-r border-border/50 px-1.5 sm:px-2 text-xs text-center">Peso (kg/@)</TableHead>
              <TableHead className="bg-gradient-to-r from-primary/10 to-primary/5 backdrop-blur-sm font-bold border-r border-border/50 px-1.5 sm:px-2 text-xs text-center">Saúde</TableHead>
              <TableHead className="bg-gradient-to-r from-primary/10 to-primary/5 backdrop-blur-sm font-bold border-r border-border/50 px-1.5 sm:px-2 text-xs text-center">Localização</TableHead>
              <TableHead className="bg-gradient-to-r from-primary/10 to-primary/5 backdrop-blur-sm font-bold border-r border-border/50 px-1.5 sm:px-2 text-xs text-center">Data Compra</TableHead>
              <TableHead className="bg-gradient-to-r from-primary/10 to-primary/5 backdrop-blur-sm font-bold border-r border-border/50 px-1.5 sm:px-2 text-xs text-center">Preço Compra</TableHead>
              <TableHead className="bg-gradient-to-r from-primary/10 to-primary/5 backdrop-blur-sm font-bold border-r border-border/50 px-1.5 sm:px-2 text-xs w-16 text-center">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {cattleLoading ? (
              <TableRow>
                <TableCell colSpan={10} className="text-center py-12 text-muted-foreground/70 border-0">
                  <div className="flex flex-col items-center gap-2">
                    <div className="w-16 h-16 rounded-full bg-muted/30 border-2 border-border/50 flex items-center justify-center">
                      <span className="text-2xl animate-pulse">🐄</span>
                    </div>
                    <span className="font-medium">Carregando gado...</span>
                  </div>
                </TableCell>
              </TableRow>
            ) : sortedCattle?.length === 0 ? (
              <TableRow>
                <TableCell colSpan={11} className="text-center py-12 text-muted-foreground/70 border-0">
                  <div className="flex flex-col items-center gap-2">
                    <div className="w-16 h-16 rounded-full bg-muted/30 border-2 border-border/50 flex items-center justify-center">
                      <span className="text-2xl">🐄</span>
                    </div>
                    <span className="font-medium">Nenhum lote de gado cadastrado</span>
                  </div>
                </TableCell>
              </TableRow>
            ) :
              sortedCattle?.map((item, index) => (
                <TableRow
                  key={item.id}
                  className={`border-b border-border/30 hover:bg-primary/10 cursor-pointer transition-colors ${index % 2 === 0 ? "bg-card" : "bg-muted/5"}`}
                  onClick={() => {
                    setSelectedStat(item.id);
                    setDetailsDialogOpen(true);
                  }}
                >
                  <TableCell className="font-semibold text-foreground border-r border-border/30 px-1.5 sm:px-2 text-xs max-w-[150px] truncate text-center">{item.description || "-"}</TableCell>
                  <TableCell className="font-medium text-foreground border-r border-border/30 px-1.5 sm:px-2 text-xs whitespace-nowrap text-center">{item.category || "-"}</TableCell>
                  <TableCell className="font-medium text-foreground border-r border-border/30 px-1.5 sm:px-2 text-xs whitespace-nowrap text-center">{item.origin || "-"}</TableCell>
                  <TableCell className="font-medium text-foreground border-r border-border/30 px-1.5 sm:px-2 text-xs whitespace-nowrap text-center">{item.quantity || "-"}</TableCell>
                  <TableCell className="font-medium text-foreground border-r border-border/30 px-1.5 sm:px-2 text-xs whitespace-nowrap text-center">{item.age_months || "-"}</TableCell>
                  <TableCell className="font-medium text-foreground border-r border-border/30 px-1.5 sm:px-2 text-xs whitespace-nowrap text-center">
                    {item.weight ? `${item.weight} kg (${(parseFloat(item.weight) / 15).toFixed(2)} @)` : "-"}
                  </TableCell>
                  <TableCell className="font-medium text-foreground border-r border-border/30 px-1.5 sm:px-2 text-xs whitespace-nowrap text-center">{item.health_status || "-"}</TableCell>
                  <TableCell className="font-medium text-foreground border-r border-border/30 px-1.5 sm:px-2 text-xs max-w-[120px] truncate text-center">{item.location || "-"}</TableCell>
                  <TableCell className="font-medium text-foreground border-r border-border/30 px-1.5 sm:px-2 text-xs whitespace-nowrap text-center">{item.purchase_date ? format(new Date(item.purchase_date), "dd/MM/yyyy") : "-"}</TableCell>
                  <TableCell className="font-medium text-foreground border-r border-border/30 px-1.5 sm:px-2 text-xs whitespace-nowrap text-center">{item.purchase_price ? formatCurrency(item.purchase_price) : <span className="text-muted-foreground italic">não informado</span>}</TableCell>
                  <TableCell className="text-center border-r border-border/30 px-1.5 sm:px-2 text-xs w-16">
                    <div className="flex gap-1 justify-center">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleEdit(item);
                        }}
                        aria-label="Editar gado"
                        title="Editar gado"
                        className="h-8 w-8"
                      >
                        <Pencil className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDelete(item.id);
                        }}
                        aria-label="Excluir gado"
                        title="Excluir gado"
                        className="h-8 w-8 text-destructive hover:text-destructive"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            }
          </TableBody>
        </Table>
      </div>

      {/* Dialog de detalhes do lote de gado - renderizado fora do Table */}
      <Dialog open={detailsDialogOpen} onOpenChange={setDetailsDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {selectedStat === "total" ? "Todos os Registros de Gado" :
               selectedStat === "femeas" ? "Fêmeas" :
               selectedStat === "machos" ? "Machos" :
               selectedStat === "quantity" ? "Todos os Registros (Quantidade)" :
               selectedStat === "value" ? "Todos os Registros (Valor)" :
               "Detalhes do Lote"}
            </DialogTitle>
          </DialogHeader>
          {selectedStat && (() => {
            // Verificar se cattle está carregando ou vazio
            if (cattleLoading) {
              return <div className="text-muted-foreground">Carregando dados...</div>;
            }
            
            if (!cattle || cattle.length === 0) {
              return <div className="text-muted-foreground">Nenhum lote de gado cadastrado.</div>;
            }
            
            // Se for "value", mostrar explicação detalhada do cálculo
            if (selectedStat === "value") {
              const itemsToShow = cattle || [];
              if (itemsToShow.length === 0) {
                return <div className="text-muted-foreground">Nenhum lote de gado cadastrado.</div>;
              }
              
              return (
                <div className="space-y-6">
                  {/* Explicação do Cálculo */}
                  <div className="bg-primary/5 border-2 border-primary/20 rounded-lg p-4 space-y-3">
                    <h3 className="font-bold text-lg text-foreground">Como é calculado o Valor Total?</h3>
                    <div className="space-y-2 text-sm">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold">Fórmula:</span>
                        <span className="bg-card px-2 py-1 rounded border border-border">Preço do @ × Quantidade de KG = Valor Total</span>
                      </div>
                      <div className="grid grid-cols-1 gap-2 pt-2 border-t border-border/30">
                        <div className="flex justify-between items-center">
                          <span className="text-muted-foreground">Preço do @ (arroba):</span>
                          <span className="font-semibold">{formatCurrency(arrobaPrice)}</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-muted-foreground">Peso Total (KG):</span>
                          <span className="font-semibold">{weightCalculator.totalWeightKg.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} kg</span>
                        </div>
                        <div className="flex justify-between items-center pt-2 border-t border-border/30">
                          <span className="text-muted-foreground">Cálculo:</span>
                          <span className="font-semibold text-primary">
                            {formatCurrency(arrobaPrice)} × {weightCalculator.totalWeightKg.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} kg
                          </span>
                        </div>
                        <div className="flex justify-between items-center pt-2 border-t-2 border-primary/30">
                          <span className="font-bold text-lg">Valor Total de Venda:</span>
                          <span className="font-bold text-lg text-primary">{formatCurrency(weightCalculator.totalSaleValue)}</span>
                        </div>
                        <div className="flex justify-between items-center pt-2 border-t border-border/30">
                          <span className="text-muted-foreground">Custo Total de Compra:</span>
                          <span className="font-semibold text-destructive">{formatCurrency(weightCalculator.totalCost)}</span>
                        </div>
                        <div className="flex justify-between items-center pt-2 border-t-2 border-success/30">
                          <span className="font-bold text-lg">Lucro Total:</span>
                          <span className={`font-bold text-lg ${weightCalculator.totalProfit >= 0 ? 'text-success' : 'text-destructive'}`}>
                            {formatCurrency(weightCalculator.totalProfit)}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Detalhamento por Lote */}
                  <div className="space-y-3">
                    <h3 className="font-bold text-lg text-foreground">Detalhamento por Lote:</h3>
                    {itemsToShow.map((item: any) => {
                      const itemWeight = parseFloat(item.weight || 0);
                      const itemValue = arrobaPrice * itemWeight;
                      return (
                        <div key={item.id} className="border border-border/30 rounded-lg p-3 space-y-2 bg-card/50">
                          <div className="font-semibold text-foreground">{item.description || "Sem descrição"}</div>
                          <div className="grid grid-cols-2 gap-2 text-sm">
                            <div><b>Categoria:</b> {item.category || "-"}</div>
                            <div><b>Origem:</b> {item.origin || "-"}</div>
                            <div><b>Peso:</b> {item.weight ? `${item.weight} kg` : "-"}</div>
                            <div><b>Preço Compra:</b> {item.purchase_price ? formatCurrency(item.purchase_price) : <span className="text-muted-foreground italic">não informado</span>}</div>
                          </div>
                          {itemWeight > 0 && (
                            <div className="pt-2 border-t border-border/30 text-sm">
                              <div className="flex justify-between items-center">
                                <span className="text-muted-foreground">Cálculo do lote:</span>
                                <span className="font-semibold">
                                  {formatCurrency(arrobaPrice)} × {itemWeight.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} kg = {formatCurrency(itemValue)}
                                </span>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            }
            
            // Se for um filtro (total, quantity), mostrar lista de registros
            if (selectedStat === "total" || selectedStat === "quantity") {
              const itemsToShow = cattle || [];
              if (!itemsToShow || itemsToShow.length === 0) {
                return <div className="text-muted-foreground">Nenhum lote de gado cadastrado.</div>;
              }
              return (
                <div className="space-y-4">
                  {itemsToShow.map((item: any) => (
                    <div key={item.id} className="border-b border-border/30 pb-3 space-y-3">
                      <div className="font-semibold">{item.description || "Sem descrição"}</div>
                      <div className="grid grid-cols-2 gap-2 text-sm">
                        <div><b>Categoria:</b> {item.category || "-"}</div>
                        <div><b>Origem:</b> {item.origin || "-"}</div>
                        <div><b>Quantidade:</b> {item.quantity || "-"}</div>
                        <div><b>Idade (meses):</b> {item.age_months || "-"}</div>
                        <div><b>Peso:</b> {item.weight ? `${item.weight} kg (${(parseFloat(item.weight) / 15).toFixed(2)} @)` : "-"}</div>
                        <div><b>Saúde:</b> {item.health_status || "-"}</div>
                        <div><b>Localização:</b> {item.location || "-"}</div>
                        <div><b>Data Compra:</b> {item.purchase_date ? format(new Date(item.purchase_date), "dd/MM/yyyy") : "-"}</div>
                        <div><b>Preço Compra:</b> {item.purchase_price ? formatCurrency(item.purchase_price) : <span className="text-muted-foreground italic">não informado</span>}</div>
                      </div>
                      <div className="flex justify-end">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setDetailsDialogOpen(false);
                            handleEdit(item);
                          }}
                          className="gap-2"
                        >
                          <Pencil className="w-3 h-3" />
                          Editar
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              );
            } else if (selectedStat === "femeas") {
              // Usar cattle diretamente ao invés de sortedCattle para garantir que todos os dados estão disponíveis
              if (!cattle || cattle.length === 0) {
                return <div className="text-muted-foreground">Nenhum gado cadastrado.</div>;
              }
              
              const femeas = cattle.filter((c: any) => {
                if (!c || !c.category) return false;
                const category = (c.category || "").trim();
                const categoryUpper = category.toUpperCase();
                return category === "Fêmea" || categoryUpper === "FÊMEA" || categoryUpper === "FEMEA" || categoryUpper === "BEZERRA" || categoryUpper === "NOVILHA";
              });
              
              if (!femeas || femeas.length === 0) {
                return (
                  <div className="text-muted-foreground">
                    <p>Nenhuma fêmea cadastrada.</p>
                    <p className="text-xs mt-2">Total de registros: {cattle.length}</p>
                  </div>
                );
              }
              
              return (
                <div className="space-y-4">
                  <div className="text-sm text-muted-foreground mb-2">
                    Total de fêmeas: {femeas.length} lote(s)
                  </div>
                  {femeas.map((item: any) => (
                    <div key={item.id} className="border-b border-border/30 pb-3 space-y-3">
                      <div className="font-semibold">{item.description || "Sem descrição"}</div>
                      <div className="grid grid-cols-2 gap-2 text-sm">
                        <div><b>Categoria:</b> {item.category || "-"}</div>
                        <div><b>Origem:</b> {item.origin || "-"}</div>
                        <div><b>Quantidade:</b> {item.quantity || "-"}</div>
                        <div><b>Idade (meses):</b> {item.age_months || "-"}</div>
                        <div><b>Peso:</b> {item.weight ? `${item.weight} kg (${(parseFloat(item.weight) / 15).toFixed(2)} @)` : "-"}</div>
                        <div><b>Saúde:</b> {item.health_status || "-"}</div>
                        <div><b>Localização:</b> {item.location || "-"}</div>
                        <div><b>Data Compra:</b> {item.purchase_date ? format(new Date(item.purchase_date), "dd/MM/yyyy") : "-"}</div>
                        <div><b>Preço Compra:</b> {item.purchase_price ? formatCurrency(item.purchase_price) : <span className="text-muted-foreground italic">não informado</span>}</div>
                      </div>
                      <div className="flex justify-end">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setDetailsDialogOpen(false);
                            handleEdit(item);
                          }}
                          className="gap-2"
                        >
                          <Pencil className="w-3 h-3" />
                          Editar
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              );
            } else if (selectedStat === "machos") {
              // Usar cattle diretamente ao invés de sortedCattle para garantir que todos os dados estão disponíveis
              if (!cattle || cattle.length === 0) {
                return <div className="text-muted-foreground">Nenhum gado cadastrado.</div>;
              }
              
              const machos = cattle.filter((c: any) => {
                if (!c || !c.category) return false;
                const category = (c.category || "").trim();
                const categoryUpper = category.toUpperCase();
                return category === "Macho" || categoryUpper === "MACHO" || categoryUpper === "BEZERRO" || categoryUpper === "NOVILHO";
              });
              
              if (!machos || machos.length === 0) {
                return (
                  <div className="text-muted-foreground">
                    <p>Nenhum macho cadastrado.</p>
                    <p className="text-xs mt-2">Total de registros: {cattle.length}</p>
                  </div>
                );
              }
              
              return (
                <div className="space-y-4">
                  <div className="text-sm text-muted-foreground mb-2">
                    Total de machos: {machos.length} lote(s)
                  </div>
                  {machos.map((item: any) => (
                    <div key={item.id} className="border-b border-border/30 pb-3 space-y-3">
                      <div className="font-semibold">{item.description || "Sem descrição"}</div>
                      <div className="grid grid-cols-2 gap-2 text-sm">
                        <div><b>Categoria:</b> {item.category || "-"}</div>
                        <div><b>Origem:</b> {item.origin || "-"}</div>
                        <div><b>Quantidade:</b> {item.quantity || "-"}</div>
                        <div><b>Idade (meses):</b> {item.age_months || "-"}</div>
                        <div><b>Peso:</b> {item.weight ? `${item.weight} kg (${(parseFloat(item.weight) / 15).toFixed(2)} @)` : "-"}</div>
                        <div><b>Saúde:</b> {item.health_status || "-"}</div>
                        <div><b>Localização:</b> {item.location || "-"}</div>
                        <div><b>Data Compra:</b> {item.purchase_date ? format(new Date(item.purchase_date), "dd/MM/yyyy") : "-"}</div>
                        <div><b>Preço Compra:</b> {item.purchase_price ? formatCurrency(item.purchase_price) : <span className="text-muted-foreground italic">não informado</span>}</div>
                      </div>
                      <div className="flex justify-end">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setDetailsDialogOpen(false);
                            handleEdit(item);
                          }}
                          className="gap-2"
                        >
                          <Pencil className="w-3 h-3" />
                          Editar
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              );
            }
            
            // Se for um ID específico, mostrar detalhes de um lote
            const item = sortedCattle?.find((c) => c.id === selectedStat);
            if (!item) return <div className="text-muted-foreground">Lote não encontrado.</div>;
            return (
              <div className="space-y-4">
                <div className="space-y-2">
                  <div><b>Descrição:</b> {item.description || "-"}</div>
                  <div><b>Categoria:</b> {item.category || "-"}</div>
                  <div><b>Origem:</b> {item.origin || "-"}</div>
                  <div><b>Quantidade:</b> {item.quantity || "-"}</div>
                  <div><b>Idade (meses):</b> {item.age_months || "-"}</div>
                  <div><b>Peso:</b> {item.weight ? `${item.weight} kg (${(parseFloat(item.weight) / 15).toFixed(2)} @)` : "-"}</div>
                  <div><b>Saúde:</b> {item.health_status || "-"}</div>
                  <div><b>Localização:</b> {item.location || "-"}</div>
                  <div><b>Data Compra:</b> {item.purchase_date ? format(new Date(item.purchase_date), "dd/MM/yyyy") : "-"}</div>
                  <div><b>Preço Compra:</b> {item.purchase_price ? formatCurrency(item.purchase_price) : <span className="text-muted-foreground italic">não informado</span>}</div>
                </div>
                <div className="flex justify-end gap-2 pt-4 border-t">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setDetailsDialogOpen(false);
                      handleEdit(item);
                    }}
                    className="gap-2"
                  >
                    <Pencil className="w-4 h-4" />
                    Editar
                  </Button>
                </div>
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>

      <Dialog open={isDialogOpen} onOpenChange={(open) => {
        if (!open) {
          handleCloseDialog();
        } else {
          setIsDialogOpen(true);
        }
      }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editingId ? "Editar Lote" : "Novo Lote de Gado"}</DialogTitle>
            <DialogDescription>
              {editingId ? "Edite os dados do lote de gado abaixo." : "Preencha os dados para cadastrar um novo lote de gado."}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={(e) => { e.preventDefault(); handleSubmit(e); }} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="description">Descrição</Label>
              <Input
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                onBlur={(e) => handleStandardizeInput(e.target.value, (value) => setFormData({ ...formData, description: value }))}
                placeholder="Ex: Lote de Novilhas - Fazenda São João"
              />
              <p className="text-xs text-muted-foreground">Identifique o lote de forma clara (opcional)</p>
            </div>
            
            <div className="pt-2 border-t">
              <h3 className="text-sm font-semibold mb-3 text-muted-foreground">Detalhes do Lote</h3>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 sm:gap-4">
              <div className="space-y-2">
                <Label htmlFor="category">Categoria</Label>
                <Select value={formData.category} onValueChange={(value) => setFormData({ ...formData, category: value })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-popover z-50">
                    <SelectItem value="Bezerra">Bezerra</SelectItem>
                    <SelectItem value="Fêmea">Fêmea</SelectItem>
                    <SelectItem value="Macho">Macho</SelectItem>
                    <SelectItem value="Novilha">Novilha</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="origin">Origem</Label>
                <StateSearchInput
                  value={formData.origin}
                  onChange={(value) => setFormData({ ...formData, origin: value })}
                  placeholder="Buscar estado..."
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="quantity">Quantidade</Label>
                <Input
                  id="quantity"
                  type="number"
                  value={formData.quantity}
                  onChange={(e) => setFormData({ ...formData, quantity: e.target.value })}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 sm:gap-4">
              <div className="space-y-2">
                <Label htmlFor="age_months">Idade (meses)</Label>
                <Input
                  id="age_months"
                  type="number"
                  value={formData.age_months}
                  onChange={(e) => setFormData({ ...formData, age_months: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="health_status">Status de Saúde</Label>
                <Select value={formData.health_status} onValueChange={(value) => setFormData({ ...formData, health_status: value })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-popover z-50">
                    <SelectItem value="Boa">Boa</SelectItem>
                    <SelectItem value="Regular">Regular</SelectItem>
                    <SelectItem value="Ruim">Ruim</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="location">Localização</Label>
                <Input
                  id="location"
                  value={formData.location}
                  onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                  onBlur={(e) => handleStandardizeInput(e.target.value, (value) => setFormData({ ...formData, location: value }))}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-4">
              <div className="space-y-2">
                <Label htmlFor="purchase_date">Data da Compra</Label>
                <Input
                  id="purchase_date"
                  type="date"
                  value={formData.purchase_date}
                  onChange={(e) => setFormData({ ...formData, purchase_date: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="weight">Peso (kg)</Label>
                <Input
                  id="weight"
                  type="number"
                  step="0.01"
                  value={formData.weight}
                  onChange={(e) => setFormData({ ...formData, weight: e.target.value })}
                  placeholder="Ex: 450 (kg)"
                />
                <p className="text-xs text-muted-foreground">
                  1 @ = 15 kg (opcional)
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-4">
              <div className="space-y-2">
                <Label htmlFor="purchase_price">Preço de Compra (R$)</Label>
                <Input
                  id="purchase_price"
                  type="number"
                  step="0.01"
                  value={formData.purchase_price}
                  onChange={(e) => setFormData({ ...formData, purchase_price: e.target.value })}
                  placeholder="Informe o valor de compra (opcional)"
                />
                <p className="text-xs text-muted-foreground">
                  Informe manualmente o valor pago na compra (opcional)
                </p>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-4 border-t">
              <Button type="button" variant="outline" onClick={handleCloseDialog} disabled={isSubmitting}>
                Cancelar
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? "Salvando..." : editingId ? "Atualizar" : "Cadastrar"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Dialog para Configurar Preço do @ */}
      <Dialog open={priceConfigDialogOpen} onOpenChange={setPriceConfigDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Configurar Preço do @ (Arroba)</DialogTitle>
            <DialogDescription>
              Defina o preço da arroba (1 @ = 15 kg) para calcular o valor estimado do rebanho.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="arroba_price">Preço do @ (R$)</Label>
              <Input
                id="arroba_price"
                type="number"
                step="0.01"
                min="0"
                value={tempArrobaPrice}
                onChange={(e) => setTempArrobaPrice(e.target.value)}
                placeholder="Ex: 310.00"
              />
              <p className="text-xs text-muted-foreground">
                Preço atual: <span className="font-semibold">{formatCurrency(arrobaPrice)}</span>
              </p>
            </div>
            <div className="flex justify-end gap-2 pt-4 border-t">
              <Button 
                type="button" 
                variant="outline" 
                onClick={() => {
                  setPriceConfigDialogOpen(false);
                  setTempArrobaPrice("");
                }}
              >
                Cancelar
              </Button>
              <Button type="button" onClick={handleSaveArrobaPrice}>
                Salvar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}


