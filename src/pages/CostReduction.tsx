import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { useTableSort } from "@/hooks/useTableSort";
import { useSmartSearch } from "@/hooks/useSmartSearch";
import { SmartSearchInput } from "@/components/SmartSearchInput";
import { Pencil, Trash2, Plus, TrendingDown, Target, Lightbulb, ArrowLeft } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { standardizeText, handleStandardizeInput } from "@/lib/validations";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

export default function CostReduction() {
  const navigate = useNavigate();
  const [isIdeaDialogOpen, setIsIdeaDialogOpen] = useState(false);
  const [isPlanDialogOpen, setIsPlanDialogOpen] = useState(false);
  const [editingIdeaId, setEditingIdeaId] = useState<string | null>(null);
  const [editingPlanId, setEditingPlanId] = useState<string | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<{ type: "idea" | "plan"; id: string } | null>(null);
  const [selectedIdeaForPlan, setSelectedIdeaForPlan] = useState<string | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [ideaFormData, setIdeaFormData] = useState({
    title: "",
    description: "",
    category: "",
    estimated_savings: "",
    implementation_effort: "media",
    priority: "media",
    status: "pendente",
    implementation_date: "",
    actual_savings: "",
    notes: "",
  });

  const [planFormData, setPlanFormData] = useState({
    title: "",
    description: "",
    related_idea_id: "",
    target_value: "",
    start_date: "",
    end_date: "",
    status: "planejamento",
    progress_percentage: 0,
    responsible_person: "",
    milestones: "",
    resources_needed: "",
    risks: "",
    success_metrics: "",
    actual_value: "",
    notes: "",
  });

  const { data: ideas = [] } = useQuery({
    queryKey: ["cost_reduction_ideas"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cost_reduction_ideas")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
    staleTime: 30000, // Cache por 30 segundos
  });

  const { data: plans = [] } = useQuery({
    queryKey: ["business_growth_plans"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("business_growth_plans")
        .select("*")
        .eq("type", "cost_reduction")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
    staleTime: 30000, // Cache por 30 segundos
  });

  const { searchTerm, setSearchTerm, filteredData: filteredIdeas } = useSmartSearch(
    ideas,
    ["title", "category", "description"]
  );
  const { sortedData: sortedIdeas } = useTableSort(filteredIdeas || []);
  const { sortedData: sortedPlans } = useTableSort(plans || []);

  const stats = useMemo(() => {
    const totalEstimated = ideas.reduce((sum: number, idea: any) => {
      return sum + (parseFloat(idea.estimated_savings || 0));
    }, 0);
    const totalActual = ideas.reduce((sum: number, idea: any) => {
      return sum + (parseFloat(idea.actual_savings || 0));
    }, 0);
    return { totalEstimated, totalActual, totalIdeas: ideas.length };
  }, [ideas]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  const createIdeaMutation = useMutation({
    mutationFn: async (data: any) => {
      const { error } = await supabase.from("cost_reduction_ideas").insert([data]);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cost_reduction_ideas"] });
      toast({ title: "Ideia cadastrada com sucesso!" });
      handleCloseIdeaDialog();
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao cadastrar ideia",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const updateIdeaMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      const { error } = await supabase.from("cost_reduction_ideas").update(data).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cost_reduction_ideas"] });
      toast({ title: "Ideia atualizada com sucesso!" });
      handleCloseIdeaDialog();
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao atualizar ideia",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const deleteIdeaMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("cost_reduction_ideas").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cost_reduction_ideas"] });
      toast({ title: "Ideia excluída com sucesso!" });
      setDeleteDialogOpen(false);
      setItemToDelete(null);
    },
  });

  const createPlanMutation = useMutation({
    mutationFn: async (data: any) => {
      const { error } = await supabase.from("business_growth_plans").insert([data]);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["business_growth_plans"] });
      toast({ title: "Planejamento criado com sucesso!" });
      handleClosePlanDialog();
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao criar planejamento",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const updatePlanMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      const { error } = await supabase.from("business_growth_plans").update(data).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["business_growth_plans"] });
      toast({ title: "Planejamento atualizado com sucesso!" });
      handleClosePlanDialog();
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao atualizar planejamento",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const deletePlanMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("business_growth_plans").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["business_growth_plans"] });
      toast({ title: "Planejamento excluído com sucesso!" });
      setDeleteDialogOpen(false);
      setItemToDelete(null);
    },
  });

  const handleSubmitIdea = (e: React.FormEvent) => {
    e.preventDefault();
    const data = {
      title: standardizeText(ideaFormData.title),
      description: ideaFormData.description ? standardizeText(ideaFormData.description) : null,
      category: ideaFormData.category ? standardizeText(ideaFormData.category) : null,
      estimated_savings: ideaFormData.estimated_savings ? parseFloat(ideaFormData.estimated_savings) : null,
      implementation_effort: ideaFormData.implementation_effort,
      priority: ideaFormData.priority,
      status: ideaFormData.status,
      implementation_date: ideaFormData.implementation_date || null,
      actual_savings: ideaFormData.actual_savings ? parseFloat(ideaFormData.actual_savings) : null,
      notes: ideaFormData.notes ? standardizeText(ideaFormData.notes) : null,
    };

    if (editingIdeaId) {
      updateIdeaMutation.mutate({ id: editingIdeaId, data });
    } else {
      createIdeaMutation.mutate(data);
    }
  };

  const handleSubmitPlan = (e: React.FormEvent) => {
    e.preventDefault();
    const data = {
      title: standardizeText(planFormData.title),
      description: planFormData.description ? standardizeText(planFormData.description) : null,
      type: "cost_reduction",
      related_idea_id: planFormData.related_idea_id || null,
      target_value: planFormData.target_value ? parseFloat(planFormData.target_value) : null,
      start_date: planFormData.start_date || null,
      end_date: planFormData.end_date || null,
      status: planFormData.status,
      progress_percentage: planFormData.progress_percentage,
      responsible_person: planFormData.responsible_person ? standardizeText(planFormData.responsible_person) : null,
      milestones: planFormData.milestones ? JSON.parse(planFormData.milestones) : null,
      resources_needed: planFormData.resources_needed ? standardizeText(planFormData.resources_needed) : null,
      risks: planFormData.risks ? standardizeText(planFormData.risks) : null,
      success_metrics: planFormData.success_metrics ? standardizeText(planFormData.success_metrics) : null,
      actual_value: planFormData.actual_value ? parseFloat(planFormData.actual_value) : null,
      notes: planFormData.notes ? standardizeText(planFormData.notes) : null,
    };

    if (editingPlanId) {
      updatePlanMutation.mutate({ id: editingPlanId, data });
    } else {
      createPlanMutation.mutate(data);
    }
  };

  const handleEditIdea = (idea: any) => {
    setEditingIdeaId(idea.id);
    setIdeaFormData({
      title: idea.title || "",
      description: idea.description || "",
      category: idea.category || "",
      estimated_savings: idea.estimated_savings?.toString() || "",
      implementation_effort: idea.implementation_effort || "media",
      priority: idea.priority || "media",
      status: idea.status || "pendente",
      implementation_date: idea.implementation_date || "",
      actual_savings: idea.actual_savings?.toString() || "",
      notes: idea.notes || "",
    });
    setIsIdeaDialogOpen(true);
  };

  const handleEditPlan = (plan: any) => {
    setEditingPlanId(plan.id);
    setPlanFormData({
      title: plan.title || "",
      description: plan.description || "",
      related_idea_id: plan.related_idea_id || "",
      target_value: plan.target_value?.toString() || "",
      start_date: plan.start_date || "",
      end_date: plan.end_date || "",
      status: plan.status || "planejamento",
      progress_percentage: plan.progress_percentage || 0,
      responsible_person: plan.responsible_person || "",
      milestones: plan.milestones ? JSON.stringify(plan.milestones, null, 2) : "",
      resources_needed: plan.resources_needed || "",
      risks: plan.risks || "",
      success_metrics: plan.success_metrics || "",
      actual_value: plan.actual_value?.toString() || "",
      notes: plan.notes || "",
    });
    setIsPlanDialogOpen(true);
  };

  const handleNewIdea = () => {
    setEditingIdeaId(null);
    setIdeaFormData({
      title: "",
      description: "",
      category: "",
      estimated_savings: "",
      implementation_effort: "media",
      priority: "media",
      status: "pendente",
      implementation_date: "",
      actual_savings: "",
      notes: "",
    });
    setIsIdeaDialogOpen(true);
  };

  const handleNewPlan = (ideaId?: string) => {
    setEditingPlanId(null);
    setSelectedIdeaForPlan(ideaId || null);
    setPlanFormData({
      title: "",
      description: "",
      related_idea_id: ideaId || "",
      target_value: "",
      start_date: "",
      end_date: "",
      status: "planejamento",
      progress_percentage: 0,
      responsible_person: "",
      milestones: "",
      resources_needed: "",
      risks: "",
      success_metrics: "",
      actual_value: "",
      notes: "",
    });
    setIsPlanDialogOpen(true);
  };

  const handleCloseIdeaDialog = () => {
    setIsIdeaDialogOpen(false);
    setEditingIdeaId(null);
    setIdeaFormData({
      title: "",
      description: "",
      category: "",
      estimated_savings: "",
      implementation_effort: "media",
      priority: "media",
      status: "pendente",
      implementation_date: "",
      actual_savings: "",
      notes: "",
    });
  };

  const handleClosePlanDialog = () => {
    setIsPlanDialogOpen(false);
    setEditingPlanId(null);
    setSelectedIdeaForPlan(null);
    setPlanFormData({
      title: "",
      description: "",
      related_idea_id: "",
      target_value: "",
      start_date: "",
      end_date: "",
      status: "planejamento",
      progress_percentage: 0,
      responsible_person: "",
      milestones: "",
      resources_needed: "",
      risks: "",
      success_metrics: "",
      actual_value: "",
      notes: "",
    });
  };

  const handleDelete = (type: "idea" | "plan", id: string) => {
    setItemToDelete({ type, id });
    setDeleteDialogOpen(true);
  };

  const confirmDelete = () => {
    if (!itemToDelete) return;
    if (itemToDelete.type === "idea") {
      deleteIdeaMutation.mutate(itemToDelete.id);
    } else {
      deletePlanMutation.mutate(itemToDelete.id);
    }
  };

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      pendente: "bg-warning/20 text-warning",
      em_analise: "bg-primary/20 text-primary",
      aprovada: "bg-success/20 text-success",
      em_implementacao: "bg-primary/20 text-primary",
      implementada: "bg-success/20 text-success",
      descartada: "bg-destructive/20 text-destructive",
      planejamento: "bg-muted text-muted-foreground",
      em_andamento: "bg-primary/20 text-primary",
      concluido: "bg-success/20 text-success",
      pausado: "bg-warning/20 text-warning",
      cancelado: "bg-destructive/20 text-destructive",
    };
    return colors[status] || "bg-muted text-muted-foreground";
  };

  const getPriorityColor = (priority: string) => {
    const colors: Record<string, string> = {
      baixa: "bg-muted text-muted-foreground",
      media: "bg-warning/20 text-warning",
      alta: "bg-destructive/20 text-destructive",
    };
    return colors[priority] || "bg-muted text-muted-foreground";
  };

  return (
    <div className="w-full max-w-full overflow-x-hidden">
      <PageHeader
        title="Redução de Custo"
        description="Cadastre ideias e planejamentos para reduzir custos do negócio"
        action={{
          label: "Nova Ideia",
          onClick: handleNewIdea,
        }}
      />

      <div className="mb-4">
        <Button variant="outline" onClick={() => navigate("/crescimento-negocios")} className="gap-2">
          <ArrowLeft className="w-4 h-4" />
          Voltar
        </Button>
      </div>

      {/* Cards de Estatísticas */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <Card className="border-2 border-success/30 rounded-2xl shadow-elegant-lg">
          <CardContent className="p-4 sm:p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase mb-1">Economia Estimada</p>
                <p className="text-2xl font-bold text-success">{formatCurrency(stats.totalEstimated)}</p>
              </div>
              <TrendingDown className="w-8 h-8 text-success" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-2 border-primary/30 rounded-2xl shadow-elegant-lg">
          <CardContent className="p-4 sm:p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase mb-1">Economia Realizada</p>
                <p className="text-2xl font-bold text-primary">{formatCurrency(stats.totalActual)}</p>
              </div>
              <Target className="w-8 h-8 text-primary" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-2 border-warning/30 rounded-2xl shadow-elegant-lg">
          <CardContent className="p-4 sm:p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase mb-1">Total de Ideias</p>
                <p className="text-2xl font-bold text-warning">{stats.totalIdeas}</p>
              </div>
              <Lightbulb className="w-8 h-8 text-warning" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs para Ideias e Planejamentos */}
      <div className="space-y-6">
        {/* Seção de Ideias */}
        <Card className="border-2 border-border/50 rounded-2xl shadow-elegant-lg">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Lightbulb className="w-5 h-5" />
              Ideias de Redução de Custo
            </CardTitle>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={handleNewIdea} className="gap-2">
                <Plus className="w-4 h-4" />
                Nova Ideia
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="mb-4">
              <SmartSearchInput
                value={searchTerm}
                onChange={setSearchTerm}
                placeholder="Buscar ideias por título, categoria, descrição..."
              />
            </div>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Título</TableHead>
                    <TableHead>Categoria</TableHead>
                    <TableHead>Economia Estimada</TableHead>
                    <TableHead>Esforço</TableHead>
                    <TableHead>Prioridade</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortedIdeas?.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                        Nenhuma ideia cadastrada
                      </TableCell>
                    </TableRow>
                  ) : (
                    sortedIdeas?.map((idea: any) => (
                      <TableRow key={idea.id}>
                        <TableCell className="font-medium">{idea.title}</TableCell>
                        <TableCell>{idea.category || "-"}</TableCell>
                        <TableCell className="font-semibold text-success">
                          {idea.estimated_savings ? formatCurrency(idea.estimated_savings) : "-"}
                        </TableCell>
                        <TableCell className="capitalize">{idea.implementation_effort || "-"}</TableCell>
                        <TableCell>
                          <Badge className={getPriorityColor(idea.priority)}>
                            {idea.priority || "média"}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge className={getStatusColor(idea.status)}>
                            {idea.status || "pendente"}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleEditIdea(idea)}
                            >
                              <Pencil className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleDelete("idea", idea.id)}
                            >
                              <Trash2 className="w-4 h-4 text-destructive" />
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleNewPlan(idea.id)}
                              className="gap-1"
                            >
                              <Target className="w-3 h-3" />
                              Plano
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        {/* Seção de Planejamentos */}
        <Card className="border-2 border-border/50 rounded-2xl shadow-elegant-lg">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Target className="w-5 h-5" />
              Planejamentos de Redução de Custo
            </CardTitle>
            <Button variant="outline" size="sm" onClick={() => handleNewPlan()} className="gap-2">
              <Plus className="w-4 h-4" />
              Novo Planejamento
            </Button>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Título</TableHead>
                    <TableHead>Meta</TableHead>
                    <TableHead>Progresso</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Responsável</TableHead>
                    <TableHead>Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortedPlans?.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                        Nenhum planejamento cadastrado
                      </TableCell>
                    </TableRow>
                  ) : (
                    sortedPlans?.map((plan: any) => (
                      <TableRow key={plan.id}>
                        <TableCell className="font-medium">{plan.title}</TableCell>
                        <TableCell className="font-semibold text-success">
                          {plan.target_value ? formatCurrency(plan.target_value) : "-"}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <div className="flex-1 bg-muted rounded-full h-2">
                              <div
                                className="bg-primary h-2 rounded-full"
                                style={{ width: `${plan.progress_percentage || 0}%` }}
                              />
                            </div>
                            <span className="text-sm font-medium">{plan.progress_percentage || 0}%</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge className={getStatusColor(plan.status)}>
                            {plan.status || "planejamento"}
                          </Badge>
                        </TableCell>
                        <TableCell>{plan.responsible_person || "-"}</TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleEditPlan(plan)}
                            >
                              <Pencil className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleDelete("plan", plan.id)}
                            >
                              <Trash2 className="w-4 h-4 text-destructive" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Dialog para Ideias */}
      <Dialog open={isIdeaDialogOpen} onOpenChange={(open) => !open && handleCloseIdeaDialog()}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingIdeaId ? "Editar Ideia" : "Nova Ideia de Redução de Custo"}</DialogTitle>
            <DialogDescription>
              Cadastre uma ideia para reduzir custos do negócio
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmitIdea} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="title">Título *</Label>
                <Input
                  id="title"
                  value={ideaFormData.title}
                  onChange={(e) => setIdeaFormData({ ...ideaFormData, title: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="category">Categoria</Label>
                <Input
                  id="category"
                  value={ideaFormData.category}
                  onChange={(e) => setIdeaFormData({ ...ideaFormData, category: e.target.value })}
                  placeholder="Ex: Fornecedores, Processos, Tecnologia..."
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Descrição</Label>
              <Textarea
                id="description"
                value={ideaFormData.description}
                onChange={(e) => setIdeaFormData({ ...ideaFormData, description: e.target.value })}
                rows={4}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="estimated_savings">Economia Estimada (R$)</Label>
                <Input
                  id="estimated_savings"
                  type="number"
                  step="0.01"
                  value={ideaFormData.estimated_savings}
                  onChange={(e) => setIdeaFormData({ ...ideaFormData, estimated_savings: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="implementation_effort">Esforço de Implementação</Label>
                <Select
                  value={ideaFormData.implementation_effort}
                  onValueChange={(value) => setIdeaFormData({ ...ideaFormData, implementation_effort: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="baixa">Baixa</SelectItem>
                    <SelectItem value="media">Média</SelectItem>
                    <SelectItem value="alta">Alta</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="priority">Prioridade</Label>
                <Select
                  value={ideaFormData.priority}
                  onValueChange={(value) => setIdeaFormData({ ...ideaFormData, priority: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="baixa">Baixa</SelectItem>
                    <SelectItem value="media">Média</SelectItem>
                    <SelectItem value="alta">Alta</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="status">Status</Label>
                <Select
                  value={ideaFormData.status}
                  onValueChange={(value) => setIdeaFormData({ ...ideaFormData, status: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pendente">Pendente</SelectItem>
                    <SelectItem value="em_analise">Em Análise</SelectItem>
                    <SelectItem value="aprovada">Aprovada</SelectItem>
                    <SelectItem value="em_implementacao">Em Implementação</SelectItem>
                    <SelectItem value="implementada">Implementada</SelectItem>
                    <SelectItem value="descartada">Descartada</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="implementation_date">Data de Implementação</Label>
                <Input
                  id="implementation_date"
                  type="date"
                  value={ideaFormData.implementation_date}
                  onChange={(e) => setIdeaFormData({ ...ideaFormData, implementation_date: e.target.value })}
                />
              </div>
            </div>

            {ideaFormData.status === "implementada" && (
              <div className="space-y-2">
                <Label htmlFor="actual_savings">Economia Realizada (R$)</Label>
                <Input
                  id="actual_savings"
                  type="number"
                  step="0.01"
                  value={ideaFormData.actual_savings}
                  onChange={(e) => setIdeaFormData({ ...ideaFormData, actual_savings: e.target.value })}
                />
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="notes">Observações</Label>
              <Textarea
                id="notes"
                value={ideaFormData.notes}
                onChange={(e) => setIdeaFormData({ ...ideaFormData, notes: e.target.value })}
                rows={3}
              />
            </div>

            <div className="flex justify-end gap-2 pt-4 border-t">
              <Button type="button" variant="outline" onClick={handleCloseIdeaDialog}>
                Cancelar
              </Button>
              <Button type="submit">
                {editingIdeaId ? "Atualizar" : "Cadastrar"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Dialog para Planejamentos */}
      <Dialog open={isPlanDialogOpen} onOpenChange={(open) => !open && handleClosePlanDialog()}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingPlanId ? "Editar Planejamento" : "Novo Planejamento"}</DialogTitle>
            <DialogDescription>
              Crie um planejamento detalhado para implementar a redução de custos
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmitPlan} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="plan_title">Título *</Label>
                <Input
                  id="plan_title"
                  value={planFormData.title}
                  onChange={(e) => setPlanFormData({ ...planFormData, title: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="related_idea_id">Ideia Relacionada (Opcional)</Label>
                <Select
                  value={planFormData.related_idea_id}
                  onValueChange={(value) => setPlanFormData({ ...planFormData, related_idea_id: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione uma ideia" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Nenhuma</SelectItem>
                    {ideas.map((idea: any) => (
                      <SelectItem key={idea.id} value={idea.id}>
                        {idea.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="plan_description">Descrição</Label>
              <Textarea
                id="plan_description"
                value={planFormData.description}
                onChange={(e) => setPlanFormData({ ...planFormData, description: e.target.value })}
                rows={3}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="target_value">Meta de Economia (R$)</Label>
                <Input
                  id="target_value"
                  type="number"
                  step="0.01"
                  value={planFormData.target_value}
                  onChange={(e) => setPlanFormData({ ...planFormData, target_value: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="start_date">Data Início</Label>
                <Input
                  id="start_date"
                  type="date"
                  value={planFormData.start_date}
                  onChange={(e) => setPlanFormData({ ...planFormData, start_date: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="end_date">Data Fim</Label>
                <Input
                  id="end_date"
                  type="date"
                  value={planFormData.end_date}
                  onChange={(e) => setPlanFormData({ ...planFormData, end_date: e.target.value })}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="plan_status">Status</Label>
                <Select
                  value={planFormData.status}
                  onValueChange={(value) => setPlanFormData({ ...planFormData, status: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="planejamento">Planejamento</SelectItem>
                    <SelectItem value="em_andamento">Em Andamento</SelectItem>
                    <SelectItem value="concluido">Concluído</SelectItem>
                    <SelectItem value="pausado">Pausado</SelectItem>
                    <SelectItem value="cancelado">Cancelado</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="progress_percentage">Progresso (%)</Label>
                <Input
                  id="progress_percentage"
                  type="number"
                  min="0"
                  max="100"
                  value={planFormData.progress_percentage}
                  onChange={(e) => setPlanFormData({ ...planFormData, progress_percentage: parseInt(e.target.value) || 0 })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="responsible_person">Responsável</Label>
                <Input
                  id="responsible_person"
                  value={planFormData.responsible_person}
                  onChange={(e) => setPlanFormData({ ...planFormData, responsible_person: e.target.value })}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="milestones">Marcos/Metas (JSON)</Label>
              <Textarea
                id="milestones"
                value={planFormData.milestones}
                onChange={(e) => setPlanFormData({ ...planFormData, milestones: e.target.value })}
                placeholder='[{"nome": "Marco 1", "data": "2025-02-01", "concluido": false}]'
                rows={3}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="resources_needed">Recursos Necessários</Label>
              <Textarea
                id="resources_needed"
                value={planFormData.resources_needed}
                onChange={(e) => setPlanFormData({ ...planFormData, resources_needed: e.target.value })}
                rows={2}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="risks">Riscos Identificados</Label>
              <Textarea
                id="risks"
                value={planFormData.risks}
                onChange={(e) => setPlanFormData({ ...planFormData, risks: e.target.value })}
                rows={2}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="success_metrics">Métricas de Sucesso</Label>
              <Textarea
                id="success_metrics"
                value={planFormData.success_metrics}
                onChange={(e) => setPlanFormData({ ...planFormData, success_metrics: e.target.value })}
                rows={2}
              />
            </div>

            {planFormData.status === "concluido" && (
              <div className="space-y-2">
                <Label htmlFor="plan_actual_value">Economia Realizada (R$)</Label>
                <Input
                  id="plan_actual_value"
                  type="number"
                  step="0.01"
                  value={planFormData.actual_value}
                  onChange={(e) => setPlanFormData({ ...planFormData, actual_value: e.target.value })}
                />
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="plan_notes">Observações</Label>
              <Textarea
                id="plan_notes"
                value={planFormData.notes}
                onChange={(e) => setPlanFormData({ ...planFormData, notes: e.target.value })}
                rows={3}
              />
            </div>

            <div className="flex justify-end gap-2 pt-4 border-t">
              <Button type="button" variant="outline" onClick={handleClosePlanDialog}>
                Cancelar
              </Button>
              <Button type="submit">
                {editingPlanId ? "Atualizar" : "Criar"}
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
              Tem certeza que deseja excluir este {itemToDelete?.type === "idea" ? "ideia" : "planejamento"}? Esta ação não pode ser desfeita.
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

