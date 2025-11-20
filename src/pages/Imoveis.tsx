import { useState, useMemo, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/layout/PageHeader";
import { StatsCard } from "@/components/layout/StatsCard";
import { QuickActions } from "@/components/QuickActions";
import { Building2, Download, CheckCircle2, XCircle, DollarSign, FileText, Key, Home, TrendingUp, Percent, AlertCircle } from "lucide-react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useTableSort } from "@/hooks/useTableSort";
import { useSmartSearch } from "@/hooks/useSmartSearch";
import { SmartSearchInput } from "@/components/SmartSearchInput";
import { Pencil, Trash2 } from "lucide-react";
import { IconButton } from "@/components/ui/IconButton";
import { format, addMonths } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  formatCEP,
  validateCEP,
  fetchAddressByCEP,
  standardizeText,
  handleStandardizeInput,
  formatCurrencyOnInput,
  parseCurrency,
  formatCurrencyInput,
  formatCurrency,
  normalizeConstraintValue,
} from "@/lib/validations";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollIndicator } from "@/components/ui/ScrollIndicator";
import * as XLSX from "xlsx";

export default function Imoveis() {
  const tableContainerRef = useRef<HTMLDivElement>(null);
  const [searchParams, setSearchParams] = useSearchParams();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [propertyToDelete, setPropertyToDelete] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [cityFilter, setCityFilter] = useState<string>("all");
  const [detailsDialogOpen, setDetailsDialogOpen] = useState(false);
  const [selectedStat, setSelectedStat] = useState<string | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  // Ler parâmetro de tipo da URL
  const tipoFilter = searchParams.get("tipo") || "";

  const [formData, setFormData] = useState({
    address: "",
    number: "",
    complement: "",
    city: "",
    cep: "",
    documentation_status: "PENDENTE",
    water_ownership: "PROPRIO",
    energy_ownership: "PROPRIO",
    outstanding_bills: "",
    contract_start: "",
    contract_end: "",
    venal_value: "",
    municipal_registration: "",
    rent_adjustment_type: "",
    rent_adjustment_value: "",
    is_rental: false, // Imóvel de Locação
    monthly_rent: "", // Valor da Locação Mensal
    // Campos para gerar despesa
    create_expense: false,
    parcel_expense: false,
    expense_due_date: "",
    expense_installments: "",
    expense_amount: "",
  });

  const [isLoadingCEP, setIsLoadingCEP] = useState(false);

  const { data: properties, isLoading: propertiesLoading } = useQuery({
    queryKey: ["properties"],
    queryFn: async () => {
      const { data, error } = await supabase.from("properties").select("*");
      if (error) throw error;
      return data;
    },
    staleTime: 300000, // Cache por 5 minutos
    refetchOnMount: true, // Buscar na montagem inicial
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    gcTime: 600000, // 10 minutos
  });

  // Buscar receitas vinculadas a imóveis para identificar inquilinos e calcular renda
  const { data: revenues } = useQuery({
    queryKey: ["revenues"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("revenue")
        .select("id, property_id, client_id, amount, frequency, date, description")
        .not("property_id", "is", null);
      if (error) throw error;
      return data;
    },
    staleTime: 300000, // Cache por 5 minutos
    refetchOnMount: true, // Buscar na montagem inicial
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    gcTime: 600000, // 10 minutos
  });

  // Criar mapa de imóveis com inquilinos (receitas vinculadas)
  const propertiesWithTenants = useMemo(() => {
    if (!revenues) return new Set<string>();
    return new Set(
      revenues
        .filter((r: any) => r.property_id && r.client_id)
        .map((r: any) => r.property_id)
    );
  }, [revenues]);

  const {
    searchTerm,
    setSearchTerm,
    filteredData: filteredProperties,
    resultCount,
    totalCount,
  } = useSmartSearch(properties, [
    "address",
    "city",
    "cep",
    "number",
    "complement",
    "documentation_status",
    "municipal_registration",
  ]);

  // Aplicar filtros adicionais
  const filteredByFilters = useMemo(() => {
    if (!filteredProperties) return [];
    let result = filteredProperties;
    
    // Filtro por tipo (locacao ou venda)
    if (tipoFilter === "locacao") {
      result = result.filter((p: any) => {
        // Considera como locação se:
        // 1. is_rental === true OU
        // 2. Tem contract_start preenchido OU
        // 3. Tem contract_end preenchido OU
        // 4. Tem receitas vinculadas (indicando inquilino) OU
        // 5. Tem water_ownership ou energy_ownership = TERCEIROS (INQUILINO)
        const hasContract = p.contract_start || p.contract_end;
        const hasTenant = propertiesWithTenants.has(p.id);
        const hasInquilino = p.water_ownership === "TERCEIROS" || p.energy_ownership === "TERCEIROS";
        return p.is_rental === true || hasContract || hasTenant || hasInquilino;
      });
    } else if (tipoFilter === "venda") {
      result = result.filter((p: any) => {
        // Considera como venda se:
        // 1. is_rental === false/null E
        // 2. NÃO tem contract_start E
        // 3. NÃO tem contract_end E
        // 4. NÃO tem receitas vinculadas E
        // 5. NÃO tem water_ownership ou energy_ownership = TERCEIROS (INQUILINO)
        const hasContract = p.contract_start || p.contract_end;
        const hasTenant = propertiesWithTenants.has(p.id);
        const hasInquilino = p.water_ownership === "TERCEIROS" || p.energy_ownership === "TERCEIROS";
        return (p.is_rental === false || p.is_rental === null) && !hasContract && !hasTenant && !hasInquilino;
      });
    }
    
    if (statusFilter !== "all") {
      result = result.filter((p: any) => p.documentation_status === statusFilter);
    }
    
    if (cityFilter !== "all") {
      result = result.filter((p: any) => {
        const cityName = p.city?.toLowerCase() || "";
        return cityName.includes(cityFilter.toLowerCase());
      });
    }
    
    return result;
  }, [filteredProperties, statusFilter, cityFilter, tipoFilter, propertiesWithTenants]);
  
  // Aplicar filtro de tipo quando o parâmetro da URL mudar
  useEffect(() => {
    if (tipoFilter) {
      // O filtro já está sendo aplicado no useMemo acima
    }
  }, [tipoFilter]);

  // Lista de cidades únicas para filtro
  const uniqueCities = useMemo(() => {
    if (!properties) return [];
    const cities = new Set<string>();
    properties.forEach((p: any) => {
      if (p.city) {
        const cityName = p.city.split(" - ")[0]?.trim();
        if (cityName) cities.add(cityName);
      }
    });
    return Array.from(cities).sort();
  }, [properties]);

  const { sortedData: sortedProperties, SortButton } =
    useTableSort(filteredByFilters);

  // Estatísticas gerais (para tela inicial sem filtro)
  const generalStats = useMemo(() => {
    if (!properties || !revenues) return {
      total: 0,
      forRental: 0,
      rented: 0,
      available: 0,
      monthlyRevenue: 0,
      occupancyRate: 0,
      paid: 0,
      pending: 0,
      totalValue: 0,
    };

    // Imóveis para locação
    const rentalProperties = properties.filter((p: any) => {
      const hasContract = p.contract_start || p.contract_end;
      const hasTenant = propertiesWithTenants.has(p.id);
      const hasInquilino = p.water_ownership === "TERCEIROS" || p.energy_ownership === "TERCEIROS";
      return p.is_rental === true || hasContract || hasTenant || hasInquilino;
    });

    // Imóveis alugados
    const today = new Date();
    const rentedProperties = rentalProperties.filter((p: any) => {
      const hasActiveContract = p.contract_end && new Date(p.contract_end) >= today;
      const hasTenant = propertiesWithTenants.has(p.id);
      return hasActiveContract || hasTenant;
    });

    // Renda mensal total
    const monthlyRentFromProperties = rentedProperties.reduce((sum: number, p: any) => {
      return sum + (Number(p.monthly_rent) || 0);
    }, 0);

    const rentalRevenues = revenues.filter((r: any) => {
      if (!r.property_id) return false;
      const property = rentalProperties.find((p: any) => p.id === r.property_id);
      if (!property) return false;
      return r.frequency === "Mensal" || r.property_id;
    });

    const monthlyRevenues = rentalRevenues.filter((r: any) => r.frequency === "Mensal");
    const monthlyRevenueFromRevenues = monthlyRevenues.reduce((sum: number, r: any) => sum + (Number(r.amount) || 0), 0);

    const propertiesWithoutMonthlyRent = rentedProperties.filter((p: any) => !p.monthly_rent || Number(p.monthly_rent) === 0);
    const revenuesFromPropertiesWithoutRent = monthlyRevenues.filter((r: any) => 
      propertiesWithoutMonthlyRent.some((p: any) => p.id === r.property_id)
    );
    const additionalRevenue = revenuesFromPropertiesWithoutRent.reduce((sum: number, r: any) => sum + (Number(r.amount) || 0), 0);
    
    const calculatedMonthlyRevenue = monthlyRentFromProperties + additionalRevenue;

    const total = properties.length;
    const forRental = rentalProperties.length;
    const rented = rentedProperties.length;
    const available = forRental - rented;
    const occupancyRate = forRental > 0 ? (rented / forRental) * 100 : 0;

    return {
      total,
      forRental,
      rented,
      available,
      monthlyRevenue: calculatedMonthlyRevenue,
      occupancyRate,
      paid: properties.filter((p: any) => p.documentation_status === "PAGO").length,
      pending: properties.filter((p: any) => p.documentation_status === "PENDENTE").length,
      totalValue: properties.reduce((sum: number, p: any) => sum + (p.venal_value || 0), 0),
    };
  }, [properties, revenues, propertiesWithTenants]);

  // Estatísticas gerais (para compatibilidade com código existente)
  const stats = useMemo(() => {
    if (!properties) return { 
      total: 0, 
      paid: 0, 
      pending: 0, 
      totalValue: 0,
      withContract: 0 
    };
    
    return {
      total: properties.length,
      paid: properties.filter((p: any) => p.documentation_status === "PAGO").length,
      pending: properties.filter((p: any) => p.documentation_status === "PENDENTE").length,
      totalValue: properties.reduce((sum: number, p: any) => sum + (p.venal_value || 0), 0),
      withContract: properties.filter((p: any) => p.contract_start && p.contract_end).length,
    };
  }, [properties]);

  // Estatísticas específicas para locação
  const rentalStats = useMemo(() => {
    if (!properties || !revenues) return {
      total: 0,
      rented: 0,
      available: 0,
      monthlyRevenue: 0,
      occupancyRate: 0,
    };

    // Filtrar imóveis de locação (mesma lógica do filtro)
    const rentalProperties = properties.filter((p: any) => {
      const hasContract = p.contract_start || p.contract_end;
      const hasTenant = propertiesWithTenants.has(p.id);
      const hasInquilino = p.water_ownership === "TERCEIROS" || p.energy_ownership === "TERCEIROS";
      return p.is_rental === true || hasContract || hasTenant || hasInquilino;
    });

    // Imóveis alugados (com contrato ativo ou receitas recentes)
    const today = new Date();
    const rentedProperties = rentalProperties.filter((p: any) => {
      const hasActiveContract = p.contract_end && new Date(p.contract_end) >= today;
      const hasTenant = propertiesWithTenants.has(p.id);
      return hasActiveContract || hasTenant;
    });

    // Calcular renda mensal total
    // PRIMEIRO: Soma os valores de monthly_rent dos imóveis alugados
    const monthlyRentFromProperties = rentedProperties.reduce((sum: number, p: any) => {
      return sum + (Number(p.monthly_rent) || 0);
    }, 0);

    // SEGUNDO: Considera receitas mensais vinculadas a imóveis de locação (como complemento)
    const rentalRevenues = revenues.filter((r: any) => {
      if (!r.property_id) return false;
      const property = rentalProperties.find((p: any) => p.id === r.property_id);
      if (!property) return false;
      
      // Verifica se é receita de aluguel/locação pela descrição ou categoria
      const description = (r.description || "").toLowerCase();
      const category = (r.category || "").toLowerCase();
      const isRentalRevenue = 
        description.includes("aluguel") || 
        description.includes("locação") || 
        description.includes("locacao") ||
        category.includes("aluguel") ||
        category.includes("locação") ||
        category.includes("locacao");
      
      return isRentalRevenue || r.property_id; // Se está vinculada a imóvel, considera
    });

    // Receitas mensais explícitas
    const monthlyRevenues = rentalRevenues.filter((r: any) => r.frequency === "Mensal");
    const monthlyRevenueFromRevenues = monthlyRevenues.reduce((sum: number, r: any) => sum + (Number(r.amount) || 0), 0);

    // Se não houver receitas mensais explícitas, calcula pela média das receitas recentes
    const recentRevenues = rentalRevenues.filter((r: any) => {
      const revenueDate = new Date(r.date);
      const monthsAgo = (today.getTime() - revenueDate.getTime()) / (1000 * 60 * 60 * 24 * 30);
      return monthsAgo <= 3; // Últimos 3 meses
    });

    let calculatedMonthlyRevenueFromRevenues = monthlyRevenueFromRevenues;
    if (monthlyRevenueFromRevenues === 0 && recentRevenues.length > 0) {
      // Calcula média mensal das receitas recentes
      const totalRecent = recentRevenues.reduce((sum: number, r: any) => sum + (Number(r.amount) || 0), 0);
      const uniqueProperties = new Set(recentRevenues.map((r: any) => r.property_id));
      // Se há receitas recentes, calcula média mensal
      calculatedMonthlyRevenueFromRevenues = totalRecent / Math.max(uniqueProperties.size, 1);
    } else if (monthlyRevenueFromRevenues === 0 && rentalRevenues.length > 0) {
      // Se não há receitas recentes mas há receitas vinculadas, usa a última receita como referência
      const lastRevenue = rentalRevenues
        .sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime())[0];
      if (lastRevenue) {
        calculatedMonthlyRevenueFromRevenues = Number(lastRevenue.amount) || 0;
      }
    }

    // Soma o valor dos imóveis (prioritário) com as receitas (complementar)
    // Se o imóvel já tem monthly_rent cadastrado, não soma receitas duplicadas
    let calculatedMonthlyRevenue = monthlyRentFromProperties;
    
    // Adiciona receitas apenas de imóveis que não têm monthly_rent cadastrado
    const propertiesWithoutMonthlyRent = rentedProperties.filter((p: any) => !p.monthly_rent || Number(p.monthly_rent) === 0);
    const revenuesFromPropertiesWithoutRent = monthlyRevenues.filter((r: any) => 
      propertiesWithoutMonthlyRent.some((p: any) => p.id === r.property_id)
    );
    const additionalRevenue = revenuesFromPropertiesWithoutRent.reduce((sum: number, r: any) => sum + (Number(r.amount) || 0), 0);
    
    calculatedMonthlyRevenue = monthlyRentFromProperties + additionalRevenue;

    const total = rentalProperties.length;
    const rented = rentedProperties.length;
    const available = total - rented;
    const occupancyRate = total > 0 ? (rented / total) * 100 : 0;

    return {
      total,
      rented,
      available,
      monthlyRevenue: calculatedMonthlyRevenue,
      occupancyRate,
    };
  }, [properties, revenues, propertiesWithTenants]);

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      const { data: insertedData, error } = await supabase
        .from("properties")
        .insert([data])
        .select();
      if (error) {
        // Se o erro for de coluna não encontrada, tenta novamente sem essas colunas
        if (error.code === "PGRST204") {
          const safeData = { ...data };
          // Remove colunas que podem não existir ainda
          if (error.message?.includes("complement")) delete safeData.complement;
          if (error.message?.includes("number")) delete safeData.number;
          if (error.message?.includes("municipal_registration"))
            delete safeData.municipal_registration;
          if (error.message?.includes("rent_adjustment_percentage"))
            delete safeData.rent_adjustment_percentage;
          if (error.message?.includes("rent_adjustment_text"))
            delete safeData.rent_adjustment_text;
          if (error.message?.includes("rent_adjustment_type"))
            delete safeData.rent_adjustment_type;

          const { data: retryData, error: retryError } = await supabase
            .from("properties")
            .insert([safeData])
            .select();
          if (retryError) throw retryError;
          return retryData[0];
        }
        throw error;
      }
      return insertedData[0];
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["properties"] });
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao cadastrar imóvel",
        description:
          error.message ||
          "Tente novamente. Execute as migrações: 20251115120003_add_property_fields.sql e 20251115120004_add_number_complement_to_properties.sql",
        variant: "destructive",
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      const { error } = await supabase
        .from("properties")
        .update(data)
        .eq("id", id);
      if (error) {
        // Se o erro for de coluna não encontrada, tenta novamente sem essas colunas
        if (error.code === "PGRST204") {
          const safeData = { ...data };
          // Remove colunas que podem não existir ainda
          if (error.message?.includes("complement")) delete safeData.complement;
          if (error.message?.includes("number")) delete safeData.number;
          if (error.message?.includes("municipal_registration"))
            delete safeData.municipal_registration;
          if (error.message?.includes("rent_adjustment_percentage"))
            delete safeData.rent_adjustment_percentage;
          if (error.message?.includes("rent_adjustment_text"))
            delete safeData.rent_adjustment_text;
          if (error.message?.includes("rent_adjustment_type"))
            delete safeData.rent_adjustment_type;

          const { error: retryError } = await supabase
            .from("properties")
            .update(safeData)
            .eq("id", id);
          if (retryError) throw retryError;
          return;
        }
        throw error;
      }
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao atualizar imóvel",
        description:
          error.message ||
          "Tente novamente. Execute as migrações: 20251115120003_add_property_fields.sql e 20251115120004_add_number_complement_to_properties.sql",
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("properties").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["properties"] });
      toast({ title: "Imóvel excluído com sucesso!" });
      setDeleteDialogOpen(false);
      setPropertyToDelete(null);
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao excluir imóvel",
        description: error.message || "Ocorreu um erro ao excluir. Tente novamente.",
        variant: "destructive",
      });
    },
  });

  const handleDelete = (id: string) => {
    setPropertyToDelete(id);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = () => {
    if (propertyToDelete) {
      deleteMutation.mutate(propertyToDelete);
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  const handleExportPDF = () => {
    if (!sortedProperties || sortedProperties.length === 0) {
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

      doc.setFontSize(18);
      doc.setFont("helvetica", "bold");
      doc.text("Relatório de Imóveis", pageWidth / 2, yPosition, { align: "center" });
      yPosition += 8;

      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      doc.text(`Gerado em: ${format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}`, pageWidth / 2, yPosition, { align: "center" });
      yPosition += 15;

      const tableData = sortedProperties.map((property: any) => [
        property.address || "",
        property.city || "",
        property.documentation_status || "",
        formatCurrency(Number(property.venal_value) || 0),
      ]);

      autoTable(doc, {
        startY: yPosition,
        head: [["Endereço", "Cidade", "Status Documentação", "Valor Venal"]],
        body: tableData,
        theme: "striped",
        headStyles: { fillColor: [33, 150, 243], textColor: 255, fontStyle: "bold" },
        styles: { fontSize: 8 },
        margin: { left: margin, right: margin },
      });

      const fileName = `Imoveis_${format(new Date(), "dd-MM-yyyy")}.pdf`;
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
    if (!sortedProperties || sortedProperties.length === 0) {
      toast({
        title: "Erro",
        description: "Não há dados para exportar.",
        variant: "destructive",
      });
      return;
    }

    const data = sortedProperties.map((property: any) => ({
      "Endereço": property.address || "",
      "Número": property.number || "",
      "Complemento": property.complement || "",
      "Cidade": property.city || "",
      "CEP": property.cep || "",
      "Status Documentação": property.documentation_status || "",
      "Titularidade Água": property.water_ownership === "TERCEIROS" ? "INQUILINO" : property.water_ownership || "",
      "Titularidade Energia": property.energy_ownership === "TERCEIROS" ? "INQUILINO" : property.energy_ownership || "",
      "Contas em Aberto": property.outstanding_bills || "",
      "Início Contrato": property.contract_start ? format(new Date(property.contract_start), "dd/MM/yyyy", { locale: ptBR }) : "",
      "Fim Contrato": property.contract_end ? format(new Date(property.contract_end), "dd/MM/yyyy", { locale: ptBR }) : "",
      "Inscrição Municipal": property.municipal_registration || "",
      "Valor Venal": property.venal_value || 0,
      "Imóvel de Locação": (property as any).is_rental ? "SIM" : "NÃO",
      "Reajuste Locação": property.rent_adjustment_type ? `${property.rent_adjustment_type}: ${property.rent_adjustment_text || property.rent_adjustment_percentage || ""}` : "",
    }));

    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Imóveis");
    
    const fileName = `Imoveis_${format(new Date(), "dd-MM-yyyy")}.xlsx`;
    XLSX.writeFile(workbook, fileName);

    toast({
      title: "Sucesso",
      description: "Arquivo Excel exportado com sucesso!",
    });
  };

  const handleCEPChange = async (value: string) => {
    const formatted = formatCEP(value);
    setFormData({ ...formData, cep: formatted });

    // Valida e busca endereço quando CEP está completo
    if (validateCEP(formatted)) {
      setIsLoadingCEP(true);
      try {
        const addressData = await fetchAddressByCEP(formatted);

        if (addressData && !addressData.erro) {
          // Monta o endereço completo com logradouro e bairro
          const fullAddress = [
            addressData.logradouro,
            addressData.bairro ? ` - ${addressData.bairro}` : "",
          ]
            .filter(Boolean)
            .join("");

          setFormData((prev) => ({
            ...prev,
            address: fullAddress || prev.address,
            city: addressData.localidade
              ? `${addressData.localidade} - ${addressData.uf}`
              : prev.city,
          }));
          toast({
            title: "Endereço encontrado!",
            description: "Os dados foram preenchidos automaticamente.",
          });
        } else {
          toast({
            title: "CEP não encontrado",
            description: "Verifique o CEP digitado.",
            variant: "destructive",
          });
        }
      } catch (error) {
        toast({
          title: "Erro ao buscar CEP",
          description: "Tente novamente mais tarde.",
          variant: "destructive",
        });
      } finally {
        setIsLoadingCEP(false);
      }
    }
  };

  const generateExpenses = async (propertyId: string) => {
    if (
      !formData.create_expense ||
      !formData.expense_amount ||
      !formData.expense_due_date
    ) {
      return;
    }

    const baseAmount = parseFloat(formData.expense_amount);
    const installments =
      formData.parcel_expense && formData.expense_installments
        ? parseInt(formData.expense_installments)
        : 1;
    const amountPerInstallment = baseAmount / installments;
    const startDate = new Date(formData.expense_due_date);

    const expensesToCreate = [];
    for (let i = 0; i < installments; i++) {
      const dueDate = addMonths(startDate, i);
      expensesToCreate.push({
        description: standardizeText(
          `Documentação Imóvel - ${formData.address || "Imóvel"}${
            installments > 1 ? ` - Parcela ${i + 1}/${installments}` : ""
          }`
        ),
        amount: amountPerInstallment,
        date: format(dueDate, "yyyy-MM-dd"),
        category: "Documentação",
        status: "PENDENTE",
        client_id: null,
      });
    }

    try {
      const { error } = await supabase
        .from("expenses")
        .insert(expensesToCreate);
      if (error) throw error;
      toast({
        title: "Despesas geradas com sucesso!",
        description: `${installments} ${
          installments === 1 ? "despesa" : "despesas"
        } criada${installments > 1 ? "s" : ""} automaticamente.`,
      });
    } catch (error: any) {
      toast({
        title: "Erro ao gerar despesas",
        description: error.message || "Tente novamente.",
        variant: "destructive",
      });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const data: any = {
        address: standardizeText(formData.address),
        city: standardizeText(formData.city),
        cep: formData.cep || null,
        venal_value: formData.venal_value
          ? parseCurrency(formData.venal_value)
          : null,
        contract_start: formData.contract_start || null,
        contract_end: formData.contract_end || null,
        documentation_status: normalizeConstraintValue("documentation_status", formData.documentation_status),
        water_ownership: normalizeConstraintValue("water_ownership", formData.water_ownership),
        energy_ownership: normalizeConstraintValue("energy_ownership", formData.energy_ownership),
        outstanding_bills: formData.outstanding_bills || null,
        municipal_registration: formData.municipal_registration
          ? standardizeText(formData.municipal_registration)
          : null,
        rent_adjustment_percentage: formData.rent_adjustment_type && formData.rent_adjustment_value && formData.rent_adjustment_type !== "text"
          ? parseFloat(formData.rent_adjustment_value)
          : null,
        rent_adjustment_text: formData.rent_adjustment_type === "text" && formData.rent_adjustment_value
          ? formData.rent_adjustment_value
          : null,
        rent_adjustment_type: formData.rent_adjustment_type || null,
        is_rental: formData.is_rental || false,
        monthly_rent: formData.monthly_rent
          ? parseCurrency(formData.monthly_rent)
          : null,
      };

      // Adiciona number e complement
      data.number = formData.number ? standardizeText(formData.number) : null;
      data.complement = formData.complement
        ? standardizeText(formData.complement)
        : null;

      // Remove campos de despesa do objeto de dados do imóvel
      delete (data as any).create_expense;
      delete (data as any).parcel_expense;
      delete (data as any).expense_due_date;
      delete (data as any).expense_installments;
      delete (data as any).expense_amount;

      let propertyId: string;

      if (editingId) {
        await updateMutation.mutateAsync({ id: editingId, data });
        propertyId = editingId;
        await queryClient.invalidateQueries({ queryKey: ["properties"] });
        toast({ title: "Imóvel atualizado com sucesso!" });
      } else {
        const insertedProperty = await createMutation.mutateAsync(data);
        propertyId = insertedProperty.id;
        await queryClient.invalidateQueries({ queryKey: ["properties"] });
        // toast({ title: "Imóvel cadastrado com sucesso!" });
      }

      // Gerar despesas se necessário
      if (
        formData.documentation_status === "PENDENTE" &&
        formData.create_expense
      ) {
        await generateExpenses(propertyId);
        queryClient.invalidateQueries({ queryKey: ["expenses"] });
      }

      handleCloseDialog();
    } catch (error: any) {
      // Erro já é tratado nas mutations, mas garantimos que não quebra a aplicação
      console.error("Erro ao salvar imóvel:", error);
    }
  };

  const handleEdit = (property: any) => {
    setEditingId(property.id);
    setFormData({
      address: property.address || "",
      number: property.number || "",
      complement: property.complement || "",
      city: property.city || "",
      cep: property.cep || "",
      documentation_status: property.documentation_status || "PENDENTE",
      water_ownership: property.water_ownership || "PROPRIO",
      energy_ownership: property.energy_ownership || "PROPRIO",
      outstanding_bills: property.outstanding_bills || "",
      contract_start: property.contract_start || "",
      contract_end: property.contract_end || "",
      venal_value: property.venal_value
        ? formatCurrencyInput(property.venal_value)
        : "",
      municipal_registration: property.municipal_registration || "",
      rent_adjustment_type: property.rent_adjustment_type || "",
      rent_adjustment_value: property.rent_adjustment_type === "text"
        ? property.rent_adjustment_text || ""
        : property.rent_adjustment_percentage?.toString() || "",
      is_rental: property.is_rental || false,
      monthly_rent: property.monthly_rent
        ? formatCurrencyInput(property.monthly_rent)
        : "",
      create_expense: false,
      parcel_expense: false,
      expense_due_date: "",
      expense_installments: "",
      expense_amount: "",
    });
    setIsDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setIsDialogOpen(false);
    setEditingId(null);
    setFormData({
      address: "",
      number: "",
      complement: "",
      city: "",
      cep: "",
      documentation_status: "PENDENTE",
      water_ownership: "PROPRIO",
      energy_ownership: "PROPRIO",
      outstanding_bills: "",
      contract_start: "",
      contract_end: "",
      venal_value: "",
      municipal_registration: "",
      rent_adjustment_type: "",
      rent_adjustment_value: "",
      is_rental: false,
      monthly_rent: "",
      create_expense: false,
      parcel_expense: false,
      expense_due_date: "",
      expense_installments: "",
      expense_amount: "",
    });
  };

  const handleNewItem = () => {
    setEditingId(null);
    setFormData({
      address: "",
      number: "",
      complement: "",
      city: "",
      cep: "",
      documentation_status: "PENDENTE",
      water_ownership: "PROPRIO",
      energy_ownership: "PROPRIO",
      outstanding_bills: "",
      contract_start: "",
      contract_end: "",
      venal_value: "",
      municipal_registration: "",
      rent_adjustment_type: "",
      rent_adjustment_value: "",
      is_rental: false,
      monthly_rent: "",
      create_expense: false,
      parcel_expense: false,
      expense_due_date: "",
      expense_installments: "",
      expense_amount: "",
    });
    setIsDialogOpen(true);
  };

  return (
    <div className="w-full max-w-full overflow-x-hidden">
      <PageHeader
        title={tipoFilter === "locacao" ? "Imóveis para Locação" : 
               tipoFilter === "venda" ? "Imóveis para Venda" : 
               "Gestão de Imóveis"}
        description={tipoFilter === "locacao" ? "Gerencie imóveis destinados à locação" : 
                     tipoFilter === "venda" ? "Gerencie imóveis destinados à venda" : 
                     "Visão geral e gestão completa de todos os seus imóveis"}
        action={{
          label: "Novo Imóvel",
          onClick: handleNewItem,
        }}
      />

      <QuickActions />

      {/* Cards de Estatísticas - Tela Inicial (sem filtro) */}
      {!tipoFilter ? (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-4 sm:mb-6 w-full">
        <StatsCard
          title="Total de Imóveis"
            value={generalStats.total.toString()}
          icon={Building2}
            variant="default"
            onClick={() => {
              setSelectedStat("total");
              setDetailsDialogOpen(true);
            }}
          />
          <StatsCard
            title="Para Locação"
            value={generalStats.forRental.toString()}
            icon={Key}
            variant="default"
            onClick={() => {
              setSelectedStat("forRental");
              setDetailsDialogOpen(true);
            }}
          />
          <StatsCard
            title="Locados"
            value={generalStats.rented.toString()}
            icon={CheckCircle2}
            variant="success"
            onClick={() => {
              setSelectedStat("rented");
              setDetailsDialogOpen(true);
            }}
          />
          <StatsCard
            title="Disponíveis"
            value={generalStats.available.toString()}
            icon={Home}
            variant="default"
            onClick={() => {
              setSelectedStat("available");
              setDetailsDialogOpen(true);
            }}
          />
        </div>
      ) : tipoFilter === "locacao" ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-4 sm:mb-6 w-full">
          <StatsCard
            title="Total de Imóveis"
            value={rentalStats.total.toString()}
            icon={Building2}
            variant="default"
            onClick={() => {
              setSelectedStat("total");
              setDetailsDialogOpen(true);
            }}
          />
          <StatsCard
            title="Alugados"
            value={rentalStats.rented.toString()}
            icon={Key}
            variant="success"
            onClick={() => {
              setSelectedStat("rented");
              setDetailsDialogOpen(true);
            }}
          />
          <StatsCard
            title="Disponíveis"
            value={rentalStats.available.toString()}
            icon={Home}
            variant="default"
            onClick={() => {
              setSelectedStat("available");
              setDetailsDialogOpen(true);
            }}
          />
          <StatsCard
            title="Renda Mensal"
            value={formatCurrency(rentalStats.monthlyRevenue)}
            icon={TrendingUp}
            variant="warning"
            onClick={() => {
              setSelectedStat("revenue");
              setDetailsDialogOpen(true);
            }}
          />
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-4 sm:mb-6 w-full">
          <StatsCard
            title="Total de Imóveis"
            value={stats.total.toString()}
            icon={Building2}
            variant="default"
          onClick={() => {
            setSelectedStat("total");
            setDetailsDialogOpen(true);
          }}
        />
        <StatsCard
          title="Documentação Paga"
            value={stats.paid.toString()}
          icon={CheckCircle2}
            variant="success"
          onClick={() => {
            setSelectedStat("paid");
            setDetailsDialogOpen(true);
          }}
        />
        <StatsCard
          title="Documentação Pendente"
            value={stats.pending.toString()}
          icon={XCircle}
            variant="destructive"
          onClick={() => {
            setSelectedStat("pending");
            setDetailsDialogOpen(true);
          }}
        />
        <StatsCard
          title="Valor Total Venal"
          value={formatCurrency(stats.totalValue)}
          icon={DollarSign}
            variant="warning"
          onClick={() => {
            setSelectedStat("value");
            setDetailsDialogOpen(true);
          }}
        />
      </div>
      )}

      {/* Cards adicionais para tela inicial */}
      {!tipoFilter && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-4 sm:mb-6 w-full">
          <StatsCard
            title="Renda Mensal Total"
            value={formatCurrency(generalStats.monthlyRevenue)}
            icon={TrendingUp}
            variant="warning"
            onClick={() => {
              setSelectedStat("revenue");
              setDetailsDialogOpen(true);
            }}
          />
          <StatsCard
            title="Taxa de Ocupação"
            value={`${generalStats.occupancyRate.toFixed(1)}%`}
            icon={Percent}
            variant="default"
            onClick={() => {
              setSelectedStat("occupancy");
              setDetailsDialogOpen(true);
            }}
          />
          <StatsCard
            title="Documentação Paga"
            value={generalStats.paid.toString()}
            icon={CheckCircle2}
            variant="success"
            onClick={() => {
              setSelectedStat("paid");
              setDetailsDialogOpen(true);
            }}
          />
          <StatsCard
            title="Valor Total Venal"
            value={formatCurrency(generalStats.totalValue)}
            icon={DollarSign}
            variant="warning"
            onClick={() => {
              setSelectedStat("value");
              setDetailsDialogOpen(true);
            }}
          />
        </div>
      )}

      {/* Alerta quando renda mensal estiver zerada */}
      {tipoFilter === "locacao" && rentalStats.monthlyRevenue === 0 && (
        <div className="mb-4 sm:mb-6 w-full">
          <Card className="bg-gradient-to-br from-amber-500/10 to-amber-500/5 border-amber-500/20">
            <CardContent className="p-4 sm:p-6">
              <div className="flex items-start gap-3">
                <div className="p-2 rounded-lg bg-amber-500/20 flex-shrink-0">
                  <AlertCircle className="w-5 h-5 text-amber-600 dark:text-amber-400" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-semibold text-foreground mb-1">Atenção: Renda Mensal não cadastrada</p>
                  <p className="text-sm text-muted-foreground">
                    Cadastre o valor da locação de seus imóveis para saber sua renda mensal total. 
                    Acesse cada imóvel e preencha o campo "Valor da Locação" quando marcar "Locar? SIM".
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Card adicional de Taxa de Ocupação para Locação */}
      {tipoFilter === "locacao" && (
        <div className="mb-4 sm:mb-6 w-full">
          <StatsCard
            title="Taxa de Ocupação"
            value={`${rentalStats.occupancyRate.toFixed(1)}%`}
            icon={Percent}
            variant="default"
            onClick={() => {
              setSelectedStat("occupancy");
              setDetailsDialogOpen(true);
            }}
          />
        </div>
      )}

      {/* Filtros e Busca */}
      <Card className="mb-4 border-2 border-border/50 rounded-2xl shadow-elegant-lg w-full max-w-full">
        <CardContent className="p-3 sm:p-4">
          <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 items-start sm:items-center w-full">
            <div className="flex-1 w-full min-w-0">
        <SmartSearchInput
          value={searchTerm}
          onChange={setSearchTerm}
                placeholder="Buscar por endereço, cidade, CEP, número, inscrição municipal..."
        />
          </div>
            <div className="flex gap-2 flex-wrap w-full sm:w-auto">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-full sm:w-[140px]">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos Status</SelectItem>
                  <SelectItem value="PAGO">PAGO</SelectItem>
                  <SelectItem value="PENDENTE">PENDENTE</SelectItem>
                </SelectContent>
              </Select>
              <Select value={cityFilter} onValueChange={setCityFilter}>
                <SelectTrigger className="w-full sm:w-[160px]">
                  <SelectValue placeholder="Cidade" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas Cidades</SelectItem>
                  {uniqueCities.map((city) => (
                    <SelectItem key={city} value={city}>
                      {city}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button onClick={handleExportPDF} className="gap-2 shadow-elegant hover:shadow-elegant-lg w-full sm:w-auto">
                <FileText className="w-4 h-4" />
                <span className="hidden sm:inline">Exportar PDF</span>
                <span className="sm:hidden">PDF</span>
              </Button>
              <Button onClick={handleExportExcel} variant="outline" className="gap-2 shadow-sm hover:shadow-elegant w-full sm:w-auto">
                <Download className="w-4 h-4" />
                <span className="hidden sm:inline">Exportar Excel</span>
                <span className="sm:hidden">Excel</span>
              </Button>
      </div>
          </div>
          {(searchTerm || statusFilter !== "all" || cityFilter !== "all") && (
            <div className="mt-3 text-sm text-muted-foreground">
              Mostrando {sortedProperties?.length || 0} de {totalCount} {totalCount === 1 ? "imóvel" : "imóveis"}
            </div>
          )}
        </CardContent>
      </Card>

      <div ref={tableContainerRef} className="bg-card rounded-2xl shadow-elegant-lg border border-border/50 overflow-x-auto w-full relative">
        <ScrollIndicator scrollContainerRef={tableContainerRef} direction="both" />
        <Table className="w-full border-separate border-spacing-0 min-w-[600px] sm:min-w-[800px] md:min-w-[1000px] lg:min-w-[1200px]">
          <TableHeader>
            <TableRow className="border-b-2 border-primary/30 hover:bg-transparent">
              <TableHead className="bg-gradient-to-r from-primary/10 to-primary/5 backdrop-blur-sm font-bold border-r border-border/50 rounded-tl-xl text-xs text-center whitespace-nowrap">
                <SortButton column="address">Endereço</SortButton>
              </TableHead>
              <TableHead className="bg-gradient-to-r from-primary/10 to-primary/5 backdrop-blur-sm font-bold border-r border-border/50 text-xs text-center whitespace-nowrap">
                <SortButton column="city">Cidade</SortButton>
              </TableHead>
              <TableHead className="bg-gradient-to-r from-primary/10 to-primary/5 backdrop-blur-sm font-bold border-r border-border/50 text-xs text-center whitespace-nowrap">
                <SortButton column="documentation_status">
                  Status Doc.
                </SortButton>
              </TableHead>
              <TableHead className="bg-gradient-to-r from-primary/10 to-primary/5 backdrop-blur-sm font-bold border-r border-border/50 text-xs text-center whitespace-nowrap">
                <SortButton column="water_ownership">Água</SortButton>
              </TableHead>
              <TableHead className="bg-gradient-to-r from-primary/10 to-primary/5 backdrop-blur-sm font-bold border-r border-border/50 text-xs text-center whitespace-nowrap">
                <SortButton column="energy_ownership">Energia</SortButton>
              </TableHead>
              <TableHead className="bg-gradient-to-r from-primary/10 to-primary/5 backdrop-blur-sm font-bold border-r border-border/50 text-xs text-center whitespace-nowrap">
                <span className="hidden sm:inline">Vigência Contrato</span>
                <span className="sm:hidden">Vig. Contrato</span>
              </TableHead>
              <TableHead className="bg-gradient-to-r from-primary/10 to-primary/5 backdrop-blur-sm font-bold border-r border-border/50 text-xs text-center whitespace-nowrap">
                <span className="hidden sm:inline">Inscrição Municipal</span>
                <span className="sm:hidden">Insc. Municipal</span>
              </TableHead>
              <TableHead className="bg-gradient-to-r from-primary/10 to-primary/5 backdrop-blur-sm font-bold border-r border-border/50 text-xs text-center whitespace-nowrap">
                <SortButton column="venal_value">
                  <span className="hidden sm:inline">Valor Venal</span>
                  <span className="sm:hidden">Valor</span>
                </SortButton>
              </TableHead>
              <TableHead className="bg-gradient-to-r from-primary/10 to-primary/5 backdrop-blur-sm font-bold border-r border-border/50 text-xs text-center whitespace-nowrap">
                Locação
              </TableHead>
              <TableHead className="bg-gradient-to-r from-primary/10 to-primary/5 backdrop-blur-sm font-bold border-r border-border/50 text-xs w-16 text-center">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedProperties?.length === 0 ? (
              <TableRow>
                <TableCell colSpan={10} className="text-center py-12 text-muted-foreground/70 border-0">
                  <div className="flex flex-col items-center gap-2">
                    <div className="w-16 h-16 rounded-full bg-muted/30 border-2 border-border/50 flex items-center justify-center">
                      <span className="text-2xl">🏠</span>
                    </div>
                    <span className="font-medium">Nenhum imóvel cadastrado</span>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              sortedProperties?.map((property, index) => (
                <TableRow
                  key={property.id}
                  className={`border-b border-border/30 hover:bg-muted/20 transition-colors ${
                    index % 2 === 0 ? "bg-card" : "bg-muted/5"
                  }`}
                  onDoubleClick={() => handleEdit(property)}
                >
                  <TableCell className="font-semibold text-foreground border-r border-border/30 text-xs text-center break-words">
                    <div className="flex flex-col items-center gap-1">
                      <span className="break-words text-center">{property.address || "-"}</span>
                      {(property.number || property.complement) && (
                        <span className="text-xs text-foreground/70 break-words font-medium">
                          {[property.number, property.complement]
                            .filter(Boolean)
                            .join(", ")}
                        </span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="font-medium text-foreground border-r border-border/30 text-xs text-center break-words">{property.city || "-"}</TableCell>
                  <TableCell className="border-r border-border/30 px-1.5 sm:px-2 text-xs text-center">
                    {property.documentation_status === "PAGO" ? (
                      <Badge className="bg-success/20 text-success hover:bg-success/30">
                        <CheckCircle2 className="w-3 h-3 mr-1" />
                        PAGO
                      </Badge>
                    ) : property.documentation_status === "PENDENTE" ? (
                      <Badge className="bg-destructive/20 text-destructive hover:bg-destructive/30">
                        <XCircle className="w-3 h-3 mr-1" />
                        PENDENTE
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-muted-foreground">
                        {property.documentation_status || "-"}
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="font-medium text-foreground border-r border-border/30 px-1.5 sm:px-2 text-xs whitespace-nowrap text-center">
                    {property.water_ownership === "TERCEIROS"
                      ? "INQUILINO"
                      : property.water_ownership || "-"}
                  </TableCell>
                  <TableCell className="font-medium text-foreground border-r border-border/30 px-1.5 sm:px-2 text-xs whitespace-nowrap text-center">
                    {property.energy_ownership === "TERCEIROS"
                      ? "INQUILINO"
                      : property.energy_ownership || "-"}
                  </TableCell>
                  <TableCell className="font-medium text-foreground text-xs border-r border-border/30 text-center">
                    {property.contract_start && property.contract_end
                      ? `${format(
                          new Date(property.contract_start),
                          "dd/MM/yy"
                        )} - ${format(
                          new Date(property.contract_end),
                          "dd/MM/yy"
                        )}`
                      : "-"}
                  </TableCell>
                  <TableCell className="font-medium text-foreground border-r border-border/30 text-xs text-center">{property.municipal_registration || "-"}</TableCell>
                  <TableCell className="text-center font-bold text-success border-r border-border/30 text-xs whitespace-nowrap">
                    {property.venal_value
                      ? formatCurrency(property.venal_value)
                      : "-"}
                  </TableCell>
                  <TableCell className="text-center border-r border-border/30 px-1.5 sm:px-2 text-xs">
                    {(property as any).is_rental ? (
                      <Badge className="bg-primary/20 text-primary hover:bg-primary/30">
                        SIM
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-muted-foreground">
                        NÃO
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-center border-r border-border/30 px-1.5 sm:px-2 text-xs w-16">
                    <div className="flex gap-1 justify-center">
                      <IconButton
                        icon={Pencil}
                        onClick={() => handleEdit(property)}
                        variant="edit"
                      />
                      <IconButton
                        icon={Trash2}
                        onClick={() => handleDelete(property.id)}
                        variant="delete"
                      />
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={isDialogOpen} onOpenChange={(open) => {
        if (!open) {
          handleCloseDialog();
        } else {
          setIsDialogOpen(true);
        }
      }}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold flex items-center gap-2">
              <Building2 className="w-6 h-6 text-primary" />
              {editingId ? "Editar Imóvel" : "Novo Imóvel"}
            </DialogTitle>
            <DialogDescription className="text-base">
              {editingId
                ? "Atualize as informações do imóvel abaixo."
                : "Preencha os dados do novo imóvel abaixo."}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-6" onKeyDown={(e) => {
            // Previne mudanças de foco indesejadas ao pressionar Enter
            if (e.key === 'Enter' && e.target instanceof HTMLInputElement && e.target.type !== 'submit') {
              e.preventDefault();
              const form = e.currentTarget;
              const inputs = Array.from(form.querySelectorAll('input, select, textarea')) as HTMLElement[];
              const currentIndex = inputs.indexOf(e.target);
              const nextInput = inputs[currentIndex + 1];
              if (nextInput) {
                nextInput.focus();
              }
            }
          }}>
            {/* Seção: Endereço */}
            <div className="space-y-4 p-4 bg-gradient-to-br from-primary/5 to-primary/10 rounded-xl border border-primary/20">
              <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
                <Building2 className="w-5 h-5 text-primary" />
                Endereço do Imóvel
              </h3>
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="cep" className="text-sm font-medium">CEP</Label>
                <div className="relative">
                  <Input
                    id="cep"
                    tabIndex={1}
                    value={formData.cep}
                    onChange={(e) => handleCEPChange(e.target.value)}
                    placeholder="00000-000"
                    maxLength={9}
                    disabled={isLoadingCEP}
                    className={
                      validateCEP(formData.cep) ? "border-green-500" : ""
                    }
                  />
                  {isLoadingCEP && (
                    <div className="absolute right-3 top-1/2 -translate-y-1/2">
                      <div className="h-4 w-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                    </div>
                  )}
                </div>
                {formData.cep &&
                  !validateCEP(formData.cep) &&
                  formData.cep.length >= 5 && (
                    <p className="text-xs text-muted-foreground">
                      Digite um CEP válido (8 dígitos)
                    </p>
                  )}
              </div>
              <div className="space-y-2 col-span-2">
                <Label htmlFor="address" className="text-sm font-medium">Endereço</Label>
                <Input
                  id="address"
                  tabIndex={2}
                  value={formData.address}
                  onChange={(e) =>
                    setFormData({ ...formData, address: e.target.value })
                  }
                  onBlur={(e) => {
                    // Usa setTimeout para evitar mudanças de foco durante o blur
                    setTimeout(() => {
                      handleStandardizeInput(e.target.value, (value) => {
                        if (value !== formData.address) {
                          setFormData({ ...formData, address: value });
                        }
                      });
                    }, 0);
                  }}
                  placeholder="Rua, Avenida, etc."
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="number" className="text-sm font-medium">Número</Label>
                <Input
                  id="number"
                  tabIndex={3}
                  value={formData.number}
                  onChange={(e) =>
                    setFormData({ ...formData, number: e.target.value })
                  }
                  onBlur={(e) => {
                    // Usa setTimeout para evitar mudanças de foco durante o blur
                    setTimeout(() => {
                      handleStandardizeInput(e.target.value, (value) => {
                        if (value !== formData.number) {
                          setFormData({ ...formData, number: value });
                        }
                      });
                    }, 0);
                  }}
                  placeholder="123"
                />
              </div>
              <div className="space-y-2 col-span-2">
                <Label htmlFor="complement" className="text-sm font-medium">Complemento</Label>
                <Input
                  id="complement"
                  tabIndex={4}
                  value={formData.complement}
                  onChange={(e) =>
                    setFormData({ ...formData, complement: e.target.value })
                  }
                  onBlur={(e) => {
                    // Usa setTimeout para evitar mudanças de foco durante o blur
                    setTimeout(() => {
                      handleStandardizeInput(e.target.value, (value) => {
                        if (value !== formData.complement) {
                          setFormData({ ...formData, complement: value });
                        }
                      });
                    }, 0);
                  }}
                  placeholder="Apto, Bloco, etc."
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="city" className="text-sm font-medium">Cidade</Label>
              <Input
                id="city"
                tabIndex={5}
                value={formData.city}
                onChange={(e) =>
                  setFormData({ ...formData, city: e.target.value })
                }
                onBlur={(e) => {
                  // Usa setTimeout para evitar mudanças de foco durante o blur
                  setTimeout(() => {
                    handleStandardizeInput(e.target.value, (value) => {
                      if (value !== formData.city) {
                        setFormData({ ...formData, city: value });
                      }
                    });
                  }, 0);
                }}
              />
            </div>
            </div>

            {/* Seção: Informações do Imóvel */}
            <div className="space-y-4 p-4 bg-gradient-to-br from-success/5 to-success/10 rounded-xl border border-success/20">
              <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-success" />
                Informações do Imóvel
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="documentation_status" className="text-sm font-medium">
                  Status Documentação
                </Label>
                <Select
                  value={formData.documentation_status}
                  onValueChange={(value) =>
                    setFormData({ ...formData, documentation_status: value })
                  }
                >
                  <SelectTrigger tabIndex={6}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-popover z-50">
                    <SelectItem value="PAGO">PAGO</SelectItem>
                    <SelectItem value="PENDENTE">PENDENTE</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="is_rental" className="text-sm font-medium">Locar?</Label>
                <Select
                  value={formData.is_rental ? "SIM" : "NÃO"}
                  onValueChange={(value) =>
                    setFormData({ ...formData, is_rental: value === "SIM" })
                  }
                >
                  <SelectTrigger tabIndex={7} className="w-full">
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent className="bg-popover z-50">
                    <SelectItem value="SIM">SIM</SelectItem>
                    <SelectItem value="NÃO">NÃO</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {formData.is_rental && (
                <div className="space-y-2">
                  <Label htmlFor="monthly_rent" className="text-sm font-medium">Valor da Locação (R$)</Label>
                  <Input
                    id="monthly_rent"
                    tabIndex={8}
                    value={formatCurrencyInput(formData.monthly_rent)}
                    onChange={(e) => {
                      const formatted = formatCurrencyOnInput(e.target.value);
                      setFormData({ ...formData, monthly_rent: formatted });
                    }}
                    placeholder="0,00"
                  />
                </div>
              )}
              <div className="space-y-2">
                <Label htmlFor="water_ownership" className="text-sm font-medium">Titularidade Água</Label>
                <Select
                  value={formData.water_ownership}
                  onValueChange={(value) => {
                    // Se selecionar INQUILINO (TERCEIROS), marca automaticamente como locação
                    const newData = { ...formData, water_ownership: value };
                    if (value === "TERCEIROS") {
                      newData.is_rental = true;
                    }
                    setFormData(newData);
                  }}
                >
                  <SelectTrigger tabIndex={8}>
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent className="bg-popover z-50">
                    <SelectItem value="PROPRIO">PRÓPRIO</SelectItem>
                    <SelectItem value="TERCEIROS">INQUILINO</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="energy_ownership" className="text-sm font-medium">Titularidade Energia</Label>
                <Select
                  value={formData.energy_ownership}
                  onValueChange={(value) => {
                    // Se selecionar INQUILINO (TERCEIROS), marca automaticamente como locação
                    const newData = { ...formData, energy_ownership: value };
                    if (value === "TERCEIROS") {
                      newData.is_rental = true;
                    }
                    setFormData(newData);
                  }}
                >
                  <SelectTrigger tabIndex={formData.is_rental ? 10 : 9}>
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent className="bg-popover z-50">
                    <SelectItem value="PROPRIO">PRÓPRIO</SelectItem>
                    <SelectItem value="TERCEIROS">INQUILINO</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="outstanding_bills" className="text-sm font-medium">Contas em Aberto</Label>
              <Textarea
                id="outstanding_bills"
                tabIndex={10}
                value={formData.outstanding_bills}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    outstanding_bills: e.target.value,
                  })
                }
                rows={3}
              />
            </div>
            </div>

            {/* Seção: Contrato e Locação */}
            <div className="space-y-4 p-4 bg-gradient-to-br from-warning/5 to-warning/10 rounded-xl border border-warning/20">
              <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
                <DollarSign className="w-5 h-5 text-warning" />
                Contrato e Locação
              </h3>
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="contract_start" className="text-sm font-medium">
                  Início Contrato (Vigência)
                </Label>
                <Input
                  id="contract_start"
                  tabIndex={11}
                  type="date"
                  value={formData.contract_start}
                  onChange={(e) =>
                    setFormData({ ...formData, contract_start: e.target.value })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="contract_end" className="text-sm font-medium">Fim Contrato (Vigência)</Label>
                <Input
                  id="contract_end"
                  tabIndex={12}
                  type="date"
                  value={formData.contract_end}
                  onChange={(e) =>
                    setFormData({ ...formData, contract_end: e.target.value })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="rent_adjustment_type" className="text-sm font-medium">
                  Reajuste Locação
                </Label>
                <div className="grid grid-cols-2 gap-3">
                  <Select
                    value={formData.rent_adjustment_type}
                    onValueChange={(value) =>
                      setFormData({
                        ...formData,
                        rent_adjustment_type: value,
                        rent_adjustment_value: "",
                      })
                    }
                  >
                    <SelectTrigger tabIndex={13}>
                      <SelectValue placeholder="Tipo" />
                    </SelectTrigger>
                    <SelectContent className="bg-popover z-50">
                      <SelectItem value="percent">%</SelectItem>
                      <SelectItem value="currency">R$</SelectItem>
                      <SelectItem value="text">Texto</SelectItem>
                    </SelectContent>
                  </Select>
                  {formData.rent_adjustment_type && (
                    <Input
                      id="rent_adjustment_value"
                      tabIndex={14}
                      type={formData.rent_adjustment_type === "text" ? "text" : "number"}
                      step={formData.rent_adjustment_type === "percent" ? "0.01" : "0.01"}
                      value={formData.rent_adjustment_value}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          rent_adjustment_value: e.target.value,
                        })
                      }
                      placeholder={
                        formData.rent_adjustment_type === "percent"
                          ? "Ex: 5.5"
                          : formData.rent_adjustment_type === "currency"
                          ? "Ex: 100.00"
                          : "Digite o texto"
                      }
                    />
                  )}
                </div>
                </div>
              </div>
            </div>

            {/* Seção: Valores e Documentação */}
            <div className="space-y-4 p-4 bg-gradient-to-br from-primary/5 to-primary/10 rounded-xl border border-primary/20">
              <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
                <FileText className="w-5 h-5 text-primary" />
                Valores e Documentação
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="municipal_registration" className="text-sm font-medium">
                  Inscrição Municipal
                </Label>
                <Input
                  id="municipal_registration"
                  tabIndex={15}
                  value={formData.municipal_registration}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      municipal_registration: e.target.value,
                    })
                  }
                  onBlur={(e) => {
                    // Usa setTimeout para evitar mudanças de foco durante o blur
                    setTimeout(() => {
                      handleStandardizeInput(e.target.value, (value) => {
                        if (value !== formData.municipal_registration) {
                          setFormData({
                            ...formData,
                            municipal_registration: value,
                          });
                        }
                      });
                    }, 0);
                  }}
                  placeholder="Número da inscrição municipal"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="venal_value" className="text-sm font-medium">Valor Venal</Label>
                <Input
                  id="venal_value"
                  tabIndex={16}
                  type="text"
                  value={formData.venal_value}
                  onChange={(e) => {
                    // Permite edição livre do valor formatado
                    // A formatação será corrigida no onBlur
                    setFormData({ ...formData, venal_value: e.target.value });
                  }}
                  onBlur={(e) => {
                    // Usa setTimeout para evitar mudanças de foco durante o blur
                    setTimeout(() => {
                      // Garante formatação correta ao sair do campo
                      const parsed = parseCurrency(e.target.value);
                      if (parsed !== null) {
                        const formatted = formatCurrencyInput(parsed);
                        if (formatted !== formData.venal_value) {
                          setFormData({ ...formData, venal_value: formatted });
                        }
                      } else if (e.target.value === "") {
                        setFormData({ ...formData, venal_value: "" });
                      }
                    }, 0);
                  }}
                  placeholder="0,00"
                />
              </div>
              </div>
            </div>

            {/* Seção: Gerar Despesa (condicional) */}
            {formData.documentation_status === "PENDENTE" && (
              <div className="space-y-4 p-4 bg-gradient-to-br from-destructive/5 to-destructive/10 rounded-xl border border-destructive/20">
                <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
                  <DollarSign className="w-5 h-5 text-destructive" />
                  Gerar Despesa de Pagamento
                </h3>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="create_expense"
                    checked={formData.create_expense}
                    onCheckedChange={(checked) =>
                      setFormData({
                        ...formData,
                        create_expense: checked === true,
                      })
                    }
                  />
                  <Label
                    htmlFor="create_expense"
                    className="font-semibold cursor-pointer"
                  >
                    Cadastrar Despesa de Pagamento
                  </Label>
                </div>

                {formData.create_expense && (
                  <>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-4">
                      <div className="space-y-3">
                        <Label htmlFor="expense_amount">
                          Valor da Despesa *
                        </Label>
                        <Input
                          id="expense_amount"
                          type="number"
                          step="0.01"
                          value={formData.expense_amount}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              expense_amount: e.target.value,
                            })
                          }
                          placeholder="0,00"
                          required
                        />
                      </div>
                      <div className="space-y-3">
                        <Label htmlFor="expense_due_date">
                          Data de Vencimento *
                        </Label>
                        <Input
                          id="expense_due_date"
                          type="date"
                          value={formData.expense_due_date}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              expense_due_date: e.target.value,
                            })
                          }
                          required
                        />
                      </div>
                    </div>

                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="parcel_expense"
                        checked={formData.parcel_expense}
                        onCheckedChange={(checked) =>
                          setFormData({
                            ...formData,
                            parcel_expense: checked === true,
                            expense_installments:
                              checked === true
                                ? formData.expense_installments
                                : "",
                          })
                        }
                      />
                      <Label
                        htmlFor="parcel_expense"
                        className="cursor-pointer"
                      >
                        Parcelar Pagamento
                      </Label>
                    </div>

                    {formData.parcel_expense && (
                      <div className="space-y-3">
                        <Label htmlFor="expense_installments">
                          Quantidade de Parcelas *
                        </Label>
                        <Input
                          id="expense_installments"
                          type="number"
                          min="1"
                          value={formData.expense_installments}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              expense_installments: e.target.value,
                            })
                          }
                          placeholder="Ex: 3"
                          required
                        />
                        <p className="text-xs text-muted-foreground">
                          As despesas serão geradas automaticamente com
                          vencimentos mensais a partir da data informada.
                        </p>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}

            <div className="flex justify-end gap-4 mt-8 pt-6 border-t border-border/50">
              <Button
                type="button"
                variant="outline"
                onClick={handleCloseDialog}
                size="lg"
                tabIndex={18}
              >
                Cancelar
              </Button>
              <Button type="submit" size="lg" tabIndex={17}>
                {editingId ? "Atualizar" : "Cadastrar"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Dialog de Confirmação de Exclusão */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar Exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir este imóvel? Esta ação não pode ser desfeita e pode afetar registros relacionados.
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

      {/* Dialog de Detalhes das Estatísticas */}
      <Dialog open={detailsDialogOpen} onOpenChange={setDetailsDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {selectedStat === "total" && "Detalhes - Total de Imóveis"}
              {selectedStat === "paid" && "Detalhes - Documentação Paga"}
              {selectedStat === "pending" && "Detalhes - Documentação Pendente"}
              {selectedStat === "value" && "Detalhes - Valor Total Venal"}
              {selectedStat === "occupancy" && "Detalhes - Taxa de Ocupação"}
              {selectedStat === "rented" && "Detalhes - Imóveis Locados"}
              {selectedStat === "forRental" && "Detalhes - Imóveis para Locação"}
              {selectedStat === "available" && "Detalhes - Imóveis Disponíveis"}
              {selectedStat === "revenue" && "Detalhes - Renda Mensal"}
            </DialogTitle>
            <DialogDescription>
              {selectedStat === "total" && `Lista completa de todos os ${stats.total} imóveis cadastrados no sistema.`}
              {selectedStat === "paid" && `Lista dos ${stats.paid} imóveis com documentação paga.`}
              {selectedStat === "pending" && `Lista dos ${stats.pending} imóveis com documentação pendente.`}
              {selectedStat === "value" && `Detalhamento do valor total venal de R$ ${formatCurrency(stats.totalValue)}.`}
              {selectedStat === "occupancy" && `Lista dos imóveis locados (${tipoFilter === "locacao" ? rentalStats.rented : generalStats.rented} de ${tipoFilter === "locacao" ? rentalStats.total : generalStats.total} imóveis).`}
              {selectedStat === "rented" && `Lista dos ${tipoFilter === "locacao" ? rentalStats.rented : generalStats.rented} imóveis locados.`}
              {selectedStat === "forRental" && `Lista dos ${generalStats.forRental} imóveis para locação.`}
              {selectedStat === "available" && `Lista dos ${tipoFilter === "locacao" ? rentalStats.available : generalStats.available} imóveis disponíveis.`}
              {selectedStat === "revenue" && `Detalhamento da renda mensal total de ${formatCurrency(tipoFilter === "locacao" ? rentalStats.monthlyRevenue : generalStats.monthlyRevenue)}.`}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {selectedStat === "total" && (
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground mb-4">
                  Total de imóveis cadastrados: <strong className="text-foreground">{stats.total}</strong>
                </p>
                <div className="max-h-[400px] overflow-y-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Endereço</TableHead>
                        <TableHead>Cidade</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Valor Venal</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {properties?.map((property: any) => (
                        <TableRow key={property.id}>
                          <TableCell className="font-medium">{property.address || "-"}</TableCell>
                          <TableCell>{property.city || "-"}</TableCell>
                          <TableCell>
                            {property.documentation_status === "PAGO" ? (
                              <Badge className="bg-success/20 text-success">PAGO</Badge>
                            ) : (
                              <Badge className="bg-destructive/20 text-destructive">PENDENTE</Badge>
                            )}
                          </TableCell>
                          <TableCell>{property.venal_value ? formatCurrency(property.venal_value) : "-"}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            )}
            {selectedStat === "paid" && (
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground mb-4">
                  Imóveis com documentação paga: <strong className="text-foreground">{stats.paid}</strong>
                </p>
                <div className="max-h-[400px] overflow-y-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Endereço</TableHead>
                        <TableHead>Cidade</TableHead>
                        <TableHead>Valor Venal</TableHead>
                        <TableHead>Inscrição Municipal</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {properties?.filter((p: any) => p.documentation_status === "PAGO").map((property: any) => (
                        <TableRow key={property.id}>
                          <TableCell className="font-medium">{property.address || "-"}</TableCell>
                          <TableCell>{property.city || "-"}</TableCell>
                          <TableCell>{property.venal_value ? formatCurrency(property.venal_value) : "-"}</TableCell>
                          <TableCell>{property.municipal_registration || "-"}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            )}
            {selectedStat === "pending" && (
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground mb-4">
                  Imóveis com documentação pendente: <strong className="text-foreground">{stats.pending}</strong>
                </p>
                <div className="max-h-[400px] overflow-y-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Endereço</TableHead>
                        <TableHead>Cidade</TableHead>
                        <TableHead>Valor Venal</TableHead>
                        <TableHead>Inscrição Municipal</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {properties?.filter((p: any) => p.documentation_status === "PENDENTE").map((property: any) => (
                        <TableRow key={property.id}>
                          <TableCell className="font-medium">{property.address || "-"}</TableCell>
                          <TableCell>{property.city || "-"}</TableCell>
                          <TableCell>{property.venal_value ? formatCurrency(property.venal_value) : "-"}</TableCell>
                          <TableCell>{property.municipal_registration || "-"}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            )}
            {selectedStat === "value" && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-4">
                  <Card>
                    <CardContent className="p-4">
                      <p className="text-sm text-muted-foreground mb-2">Valor Total</p>
                      <p className="text-2xl font-bold text-success">{formatCurrency(stats.totalValue)}</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-4">
                      <p className="text-sm text-muted-foreground mb-2">Imóveis com Valor</p>
                      <p className="text-2xl font-bold">{properties?.filter((p: any) => p.venal_value).length || 0}</p>
                    </CardContent>
                  </Card>
                </div>
                <div className="max-h-[400px] overflow-y-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Endereço</TableHead>
                        <TableHead>Cidade</TableHead>
                        <TableHead>Valor Venal</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {properties?.filter((p: any) => p.venal_value).sort((a: any, b: any) => (b.venal_value || 0) - (a.venal_value || 0)).map((property: any) => (
                        <TableRow key={property.id}>
                          <TableCell className="font-medium">{property.address || "-"}</TableCell>
                          <TableCell>{property.city || "-"}</TableCell>
                          <TableCell className="font-bold text-success">{formatCurrency(property.venal_value)}</TableCell>
                          <TableCell>
                            {property.documentation_status === "PAGO" ? (
                              <Badge className="bg-success/20 text-success">PAGO</Badge>
                            ) : (
                              <Badge className="bg-destructive/20 text-destructive">PENDENTE</Badge>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            )}
            {selectedStat === "occupancy" && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <Card>
                    <CardContent className="p-4">
                      <p className="text-sm text-muted-foreground mb-2">Total de Imóveis</p>
                      <p className="text-2xl font-bold">{tipoFilter === "locacao" ? rentalStats.total : generalStats.total}</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-4">
                      <p className="text-sm text-muted-foreground mb-2">Imóveis Locados</p>
                      <p className="text-2xl font-bold text-success">{tipoFilter === "locacao" ? rentalStats.rented : generalStats.rented}</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-4">
                      <p className="text-sm text-muted-foreground mb-2">Taxa de Ocupação</p>
                      <p className="text-2xl font-bold text-primary">{(tipoFilter === "locacao" ? rentalStats.occupancyRate : generalStats.occupancyRate).toFixed(1)}%</p>
                    </CardContent>
                  </Card>
                </div>
                <div className="max-h-[400px] overflow-y-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Endereço</TableHead>
                        <TableHead>Cidade</TableHead>
                        <TableHead>Valor Locação</TableHead>
                        <TableHead>Início Contrato</TableHead>
                        <TableHead>Fim Contrato</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(tipoFilter === "locacao" 
                        ? filteredProperties.filter((p: any) => {
                            const hasContract = p.contract_start || p.contract_end;
                            const hasTenant = propertiesWithTenants.has(p.id);
                            const hasInquilino = p.water_ownership === "TERCEIROS" || p.energy_ownership === "TERCEIROS";
                            return p.is_rental === true || hasContract || hasTenant || hasInquilino;
                          })
                        : properties?.filter((p: any) => {
                            const hasContract = p.contract_start || p.contract_end;
                            const hasTenant = propertiesWithTenants.has(p.id);
                            const hasInquilino = p.water_ownership === "TERCEIROS" || p.energy_ownership === "TERCEIROS";
                            return p.is_rental === true || hasContract || hasTenant || hasInquilino;
                          })
                      ).map((property: any) => (
                        <TableRow key={property.id}>
                          <TableCell className="font-medium">{property.address || "-"}</TableCell>
                          <TableCell>{property.city || "-"}</TableCell>
                          <TableCell>{property.monthly_rent ? formatCurrency(property.monthly_rent) : "-"}</TableCell>
                          <TableCell>{property.contract_start ? format(new Date(property.contract_start), "dd/MM/yyyy", { locale: ptBR }) : "-"}</TableCell>
                          <TableCell>{property.contract_end ? format(new Date(property.contract_end), "dd/MM/yyyy", { locale: ptBR }) : "-"}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            )}
            {selectedStat === "rented" && (
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground mb-4">
                  Imóveis locados: <strong className="text-foreground">{tipoFilter === "locacao" ? rentalStats.rented : generalStats.rented}</strong>
                </p>
                <div className="max-h-[400px] overflow-y-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Endereço</TableHead>
                        <TableHead>Cidade</TableHead>
                        <TableHead>Valor Locação</TableHead>
                        <TableHead>Início Contrato</TableHead>
                        <TableHead>Fim Contrato</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(tipoFilter === "locacao" 
                        ? filteredProperties.filter((p: any) => {
                            const today = new Date();
                            const hasActiveContract = p.contract_end && new Date(p.contract_end) >= today;
                            const hasTenant = propertiesWithTenants.has(p.id);
                            return hasActiveContract || hasTenant;
                          })
                        : properties?.filter((p: any) => {
                            const today = new Date();
                            const hasActiveContract = p.contract_end && new Date(p.contract_end) >= today;
                            const hasTenant = propertiesWithTenants.has(p.id);
                            return hasActiveContract || hasTenant;
                          })
                      ).map((property: any) => (
                        <TableRow key={property.id}>
                          <TableCell className="font-medium">{property.address || "-"}</TableCell>
                          <TableCell>{property.city || "-"}</TableCell>
                          <TableCell>{property.monthly_rent ? formatCurrency(property.monthly_rent) : "-"}</TableCell>
                          <TableCell>{property.contract_start ? format(new Date(property.contract_start), "dd/MM/yyyy", { locale: ptBR }) : "-"}</TableCell>
                          <TableCell>{property.contract_end ? format(new Date(property.contract_end), "dd/MM/yyyy", { locale: ptBR }) : "-"}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

