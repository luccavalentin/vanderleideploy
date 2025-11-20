import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/layout/PageHeader";
import { QuickActions } from "@/components/QuickActions";
import { StatsCard } from "@/components/layout/StatsCard";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { useTableSort } from "@/hooks/useTableSort";
import { useSmartSearch } from "@/hooks/useSmartSearch";
import { SmartSearchInput } from "@/components/SmartSearchInput";
import { Pencil, Trash2, Target, Download, TrendingUp, DollarSign, CheckCircle2, XCircle, Clock, FileText, Plus, Upload } from "lucide-react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { standardizeText, handleStandardizeInput, formatCurrencyInput, parseCurrency, formatCurrency, capitalizeFirstLetter, handleCapitalizeLeadInput, normalizeConstraintValue } from "@/lib/validations";
import * as XLSX from "xlsx";

export default function Leads() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [detailsDialogOpen, setDetailsDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [leadToDelete, setLeadToDelete] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [selectedStat, setSelectedStat] = useState<string | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [formData, setFormData] = useState({
    name: "",
    start_date: "",
    end_date: "",
    contract_value: "",
    status: "Inicial",
    notes: "",
  });

  // Estado para tarefas vinculadas ao lead
  const [leadTasks, setLeadTasks] = useState<any[]>([]);
  const [taskDialogOpen, setTaskDialogOpen] = useState(false);
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [taskToDelete, setTaskToDelete] = useState<string | null>(null);
  const [taskFormData, setTaskFormData] = useState({
    title: "",
    description: "",
    due_date: "",
    status: "pendente" as "pendente" | "em_andamento" | "concluida",
    priority: "media" as "baixa" | "media" | "alta",
    category: "",
  });
  const [isImporting, setIsImporting] = useState(false);

  const { data: leads, isLoading: leadsLoading } = useQuery({
    queryKey: ["leads"],
    queryFn: async (): Promise<any[]> => {
      try {
        // Buscar leads
        const { data: leadsData, error: leadsError } = await supabase
          .from("leads")
          .select("*")
          .order("created_at", { ascending: false });
        
        if (leadsError) throw leadsError;
        if (!leadsData) return [];

        // Buscar todas as tarefas de uma vez
        const { data: allReminders } = await supabase
          .from("reminders")
          .select("id, title, status, due_date, lead_id")
          .not("lead_id", "is", null);

        // Agrupar tarefas por lead_id
        const remindersByLeadId: Record<string, any[]> = {};
        if (allReminders) {
          allReminders.forEach((reminder: any) => {
            if (reminder.lead_id) {
              if (!remindersByLeadId[reminder.lead_id]) {
                remindersByLeadId[reminder.lead_id] = [];
              }
              remindersByLeadId[reminder.lead_id].push({
                id: reminder.id,
                title: reminder.title,
                status: reminder.status,
                due_date: reminder.due_date,
              });
            }
          });
        }

        // Combinar leads com suas tarefas
        return leadsData.map((lead: any) => ({
          ...lead,
          reminders: remindersByLeadId[lead.id] || [],
        }));
      } catch (error: any) {
        console.error("Erro ao buscar leads:", error);
        // Em caso de erro, retornar array vazio
        return [];
      }
    },
    staleTime: 300000, // Cache por 5 minutos
    refetchOnMount: true, // Buscar na montagem inicial
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    gcTime: 600000, // 10 minutos
  });


  const { searchTerm, setSearchTerm, filteredData: filteredLeads, resultCount, totalCount } = useSmartSearch(
    leads,
    ["name", "status", "notes"]
  );

  // Aplicar filtro por status
  const filteredByStatus = useMemo(() => {
    if (!filteredLeads) return [];
    if (statusFilter === "all") return filteredLeads;
    return filteredLeads.filter((lead: any) => lead.status === statusFilter);
  }, [filteredLeads, statusFilter]);

  const { sortedData: sortedLeads, SortButton } = useTableSort(filteredByStatus);

  // Estatísticas
  const stats = useMemo(() => {
    if (!leads) return { total: "0", inicial: "0", negociacao: "0", fechado: "0", perdido: "0", totalValue: 0 };
    
    const total = leads.length;
    const inicial = leads.filter((l: any) => l.status === "Inicial").length;
    const negociacao = leads.filter((l: any) => l.status === "Negociação").length;
    const fechado = leads.filter((l: any) => l.status === "Fechado").length;
    const perdido = leads.filter((l: any) => l.status === "Perdido").length;
    const totalValue = leads.reduce((sum: number, l: any) => sum + (l.contract_value || 0), 0);
    
    return { total: total.toString(), inicial: inicial.toString(), negociacao: negociacao.toString(), fechado: fechado.toString(), perdido: perdido.toString(), totalValue };
  }, [leads]);

  const [keepDialogOpen, setKeepDialogOpen] = useState(false);

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      const { data: result, error } = await supabase.from("leads").insert([data]).select();
      if (error) throw error;
      return result;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["leads"] });
      // toast({ title: "Lead cadastrado com sucesso!" });
      if (keepDialogOpen) {
        setFormData({
          name: "",
          start_date: "",
          end_date: "",
          contract_value: "",
          status: "Inicial",
          notes: "",
        });
        setLeadTasks([]);
        setKeepDialogOpen(false);
      } else {
      handleCloseDialog();
      }
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao cadastrar lead",
        description: error.message || "Ocorreu um erro ao cadastrar o lead. Tente novamente.",
        variant: "destructive",
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      const { error } = await supabase.from("leads").update(data).eq("id", id);
      if (error) throw error;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["leads"] });
      toast({ title: "Lead atualizado com sucesso!" });
      handleCloseDialog();
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao atualizar lead",
        description: error.message || "Ocorreu um erro ao atualizar o lead. Tente novamente.",
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("leads").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["leads"] });
      toast({ title: "Lead excluído com sucesso!" });
      setDeleteDialogOpen(false);
      setLeadToDelete(null);
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao excluir lead",
        description: error.message || "Ocorreu um erro ao excluir o lead. Tente novamente.",
        variant: "destructive",
      });
    },
  });

  const handleDelete = (id: string) => {
    setLeadToDelete(id);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = () => {
    if (leadToDelete) {
      deleteMutation.mutate(leadToDelete);
    }
  };

  const handleExportPDF = () => {
    if (!leads || leads.length === 0) {
      toast({
        title: "Nenhum dado para exportar",
        description: "Não há leads cadastrados para exportar.",
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
      doc.text("Relatório de Leads", pageWidth / 2, yPosition, { align: "center" });
      yPosition += 8;

      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      doc.text(`Gerado em: ${format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}`, pageWidth / 2, yPosition, { align: "center" });
      yPosition += 15;

      const tableData = leads.map((lead: any) => [
        lead.name || "",
        lead.status || "",
        lead.start_date ? format(new Date(lead.start_date), "dd/MM/yyyy", { locale: ptBR }) : "",
        lead.end_date ? format(new Date(lead.end_date), "dd/MM/yyyy", { locale: ptBR }) : "",
        lead.contract_value ? formatCurrency(lead.contract_value) : "",
      ]);

      autoTable(doc, {
        startY: yPosition,
        head: [["Nome", "Status", "Data Início", "Data Fim", "Valor Contrato"]],
        body: tableData,
        theme: "striped",
        headStyles: { fillColor: [33, 150, 243], textColor: 255, fontStyle: "bold" },
        styles: { fontSize: 8 },
        margin: { left: margin, right: margin },
      });

      const fileName = `Leads_${format(new Date(), "dd-MM-yyyy")}.pdf`;
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
    if (!leads || leads.length === 0) {
      toast({
        title: "Nenhum dado para exportar",
        description: "Não há leads cadastrados para exportar.",
        variant: "destructive",
      });
      return;
    }

    const data = leads.map((lead: any) => ({
      Nome: lead.name || "",
      Status: lead.status || "",
      "Data Início": lead.start_date ? format(new Date(lead.start_date), "dd/MM/yyyy", { locale: ptBR }) : "",
      "Data Fim": lead.end_date ? format(new Date(lead.end_date), "dd/MM/yyyy", { locale: ptBR }) : "",
      "Valor Contrato": lead.contract_value ? formatCurrency(lead.contract_value) : "",
      Observações: lead.notes || "",
    }));

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Leads");
    XLSX.writeFile(wb, `leads_${format(new Date(), "yyyy-MM-dd")}.xlsx`);

    toast({
      title: "Exportação concluída",
      description: `${leads.length} lead(s) exportado(s) com sucesso.`,
    });
  };

  const handleSubmitAndNew = async (e: React.FormEvent) => {
    e.preventDefault();
    setKeepDialogOpen(true);
    await handleSubmitLogic();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setKeepDialogOpen(false);
    await handleSubmitLogic();
  };
    
  const handleSubmitLogic = async () => {
    try {
      // Validação: nome é obrigatório
      if (!formData.name || !formData.name.trim()) {
        toast({
          title: "Erro de validação",
          description: "O nome do lead é obrigatório.",
          variant: "destructive",
        });
        return;
      }

      // Limpar campos vazios e converter para null
      // Aplicar capitalização: primeira letra maiúscula, demais minúsculas
      const mappedData: any = {
        name: capitalizeFirstLetter(formData.name.trim()), // Sempre preenchido após validação
        start_date: formData.start_date && formData.start_date.trim() ? formData.start_date : null,
        end_date: formData.end_date && formData.end_date.trim() ? formData.end_date : null,
        contract_value: formData.contract_value && formData.contract_value.trim() ? parseFloat(formData.contract_value) : null,
        status: normalizeConstraintValue("lead_status", formData.status) || "Inicial",
        notes: formData.notes && formData.notes.trim() ? formData.notes.trim() : null,
      };

      // Remove campos undefined ou string vazia (exceto name que já foi validado)
      Object.keys(mappedData).forEach(key => {
        if (key !== "name" && (mappedData[key] === "" || mappedData[key] === undefined)) {
          mappedData[key] = null;
        }
      });

      let leadId: string;
      if (editingId) {
        await updateMutation.mutateAsync({ id: editingId, data: mappedData });
        leadId = editingId;
      } else {
        const result = await createMutation.mutateAsync(mappedData);
        // Se a mutation retornar o ID, usar
        if (result && result.length > 0 && result[0]?.id) {
          leadId = result[0].id;
        } else {
          // Se não retornou, buscar o último lead criado pelo nome
          const { data: newLead } = await supabase
            .from("leads")
            .select("id")
            .eq("name", mappedData.name)
            .order("created_at", { ascending: false })
            .limit(1)
            .single();
          if (newLead?.id) {
            leadId = newLead.id;
          } else {
            throw new Error("Não foi possível obter o ID do lead criado");
          }
        }
      }

      // Salvar tarefas vinculadas ao lead
      if (leadId) {
        // Buscar tarefas existentes vinculadas a este lead
        const { data: existingTasks } = await (supabase as any)
          .from("reminders")
          .select("id")
          .eq("lead_id", leadId);

        const existingTaskIds = existingTasks?.map((t: any) => t.id) || [];
        const currentTaskIds = leadTasks.map((t: any) => t.id).filter((id: string) => id && !id.startsWith("temp-"));

        // Remover tarefas que foram deletadas
        const tasksToDelete = existingTaskIds.filter((id: string) => !currentTaskIds.includes(id));
        if (tasksToDelete.length > 0) {
          await (supabase as any)
            .from("reminders")
            .delete()
            .in("id", tasksToDelete);
        }

        // Salvar/atualizar tarefas (aplicar capitalização no título)
        for (const task of leadTasks) {
          // Validar título da tarefa
          if (!task.title || !task.title.trim()) {
            toast({
              title: "Erro de validação",
              description: "Todas as tarefas devem ter um título.",
              variant: "destructive",
            });
            continue; // Pula esta tarefa e continua com as próximas
          }

          // Se não tiver data de vencimento, usar 30 dias a partir de hoje como padrão
          const defaultDueDate = new Date();
          defaultDueDate.setDate(defaultDueDate.getDate() + 30);

          const taskData: any = {
            title: capitalizeFirstLetter(task.title.trim()),
            description: task.description ? task.description.trim() : null,
            due_date: task.due_date && task.due_date.trim() ? task.due_date : format(defaultDueDate, "yyyy-MM-dd"),
            status: task.status || "pendente",
            priority: task.priority || "media",
            category: task.category && task.category.trim() ? capitalizeFirstLetter(task.category.trim()) : null,
            lead_id: leadId,
            completed: task.status === "concluida",
          };

          if (task.id && !task.id.startsWith("temp-")) {
            // Atualizar tarefa existente
            await (supabase as any)
              .from("reminders")
              .update(taskData)
              .eq("id", task.id);
          } else {
            // Criar nova tarefa
            await (supabase as any)
              .from("reminders")
              .insert([taskData]);
          }
        }
      }

      // Invalidar queries para atualizar a lista
      queryClient.invalidateQueries({ queryKey: ["leads"] });
      queryClient.invalidateQueries({ queryKey: ["reminders"] });
    } catch (error: any) {
      console.error("Erro ao salvar lead:", error);
      // Erro já é tratado no onError da mutation
    }
  };

  const handleEdit = (lead: any) => {
    setEditingId(lead.id);
    // Carregar tarefas vinculadas completas
    const tasks = (lead as any).reminders ? (lead as any).reminders.map((t: any) => ({
      id: t.id,
      title: t.title || "",
      description: t.description || "",
      due_date: t.due_date || "",
      status: t.status || "pendente",
      priority: t.priority || "media",
      category: t.category || "",
    })) : [];
    setLeadTasks(tasks);
    setFormData({
      name: lead.name || "",
      start_date: lead.start_date || "",
      end_date: lead.end_date || "",
      contract_value: lead.contract_value?.toString() || "",
      status: lead.status || "Inicial",
      notes: lead.notes || "",
    });
    setIsDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setIsDialogOpen(false);
    setEditingId(null);
    setLeadTasks([]);
    setFormData({
      name: "",
      start_date: "",
      end_date: "",
      contract_value: "",
      status: "Inicial",
      notes: "",
    });
  };

  const handleNewItem = () => {
    setEditingId(null);
    setLeadTasks([]);
    setFormData({
      name: "",
      start_date: "",
      end_date: "",
      contract_value: "",
      status: "Inicial",
      notes: "",
    });
    setIsDialogOpen(true);
  };

  // Funções para gerenciar tarefas
  const handleNewTask = () => {
    setEditingTaskId(null);
    setTaskFormData({
      title: "",
      description: "",
      due_date: "",
      status: "pendente",
      priority: "media",
      category: "",
    });
    setTaskDialogOpen(true);
  };

  const handleEditTask = (task: any) => {
    setEditingTaskId(task.id);
    setTaskFormData({
      title: task.title || "",
      description: task.description || "",
      due_date: task.due_date || "",
      status: task.status || "pendente",
      priority: task.priority || "media",
      category: task.category || "",
    });
    setTaskDialogOpen(true);
  };

  const handleSaveTask = () => {
    if (!taskFormData.title.trim()) {
      toast({
        title: "Erro",
        description: "O título da tarefa é obrigatório.",
        variant: "destructive",
      });
      return;
    }

    // Aplicar capitalização no título e categoria
    const capitalizedTaskData = {
      ...taskFormData,
      title: capitalizeFirstLetter(taskFormData.title.trim()),
      category: taskFormData.category ? capitalizeFirstLetter(taskFormData.category.trim()) : "",
    };

    if (editingTaskId) {
      // Atualizar tarefa existente
      setLeadTasks(leadTasks.map(task => 
        task.id === editingTaskId 
          ? { ...task, ...capitalizedTaskData }
          : task
      ));
    } else {
      // Adicionar nova tarefa
      setLeadTasks([...leadTasks, { ...capitalizedTaskData, id: `temp-${Date.now()}` }]);
    }

    setTaskDialogOpen(false);
    setEditingTaskId(null);
    setTaskFormData({
      title: "",
      description: "",
      due_date: "",
      status: "pendente",
      priority: "media",
      category: "",
    });
  };

  const handleDeleteTask = (taskId: string) => {
    setLeadTasks(leadTasks.filter(task => task.id !== taskId));
    setTaskToDelete(null);
  };

  // Função para importar dados em massa
  const handleImportLeads = async () => {
    setIsImporting(true);
    try {
      const leadsData = [
        { name: 'VIA CAMPOS', status: 'Inicial', notes: null },
        { name: 'INTERCAMBIO', status: 'Inicial', notes: null },
        { name: 'SILVIO FELIX', status: 'Inicial', notes: null },
        { name: 'IND. DU FRASSON', status: 'Inicial', notes: null },
        { name: 'EDUARDO - ALFA', status: 'Inicial', notes: null },
        { name: 'ACORDO CORONEL', status: 'Inicial', notes: null },
        { name: 'EMPRESA SUL', status: 'Inicial', notes: null },
        { name: 'DANIEL BERTANHA', status: 'Inicial', notes: null },
        { name: 'MOVEIS CASSIMIRO', status: 'Inicial', notes: null },
        { name: 'CONTRATOS BANCOS', status: 'Inicial', notes: null },
        { name: 'BIDS, LEILÕES ESC.', status: 'Inicial', notes: null },
        { name: 'LICITAÇÕES', status: 'Inicial', notes: null },
        { name: 'MAQTIVA', status: 'Inicial', notes: null },
        { name: 'VENDA TERRENO PITA', status: 'Inicial', notes: null },
        { name: 'EMPRESA DE AMERICANA', status: 'Inicial', notes: null },
        { name: 'INGRED', status: 'Inicial', notes: null },
        { name: 'Intercambio', status: 'Inicial', notes: null },
        { name: 'contratos pj intercambio', status: 'Inicial', notes: null },
      ];

      // Verificar leads existentes e inserir apenas os novos
      const { data: existingLeads } = await supabase
        .from("leads")
        .select("name");

      // Normalizar nomes para comparação (primeira letra maiúscula, resto minúsculo)
      const existingNames = new Set(
        (existingLeads || []).map((l: any) => capitalizeFirstLetter(l.name?.trim() || '').toLowerCase())
      );

      const newLeadsData = leadsData.filter(
        (lead) => !existingNames.has(lead.name.toLowerCase().trim())
      );

      let insertedLeads: any[] = [];

      if (newLeadsData.length > 0) {
        // Inserir apenas leads novos
        const { data: inserted, error: leadsError } = await supabase
          .from("leads")
          .insert(newLeadsData)
          .select();

        if (leadsError) {
          throw leadsError;
        }

        insertedLeads = inserted || [];
      }

      // Buscar todos os leads (novos e existentes) para vincular tarefas
      const { data: allLeads, error: allLeadsError } = await supabase
        .from("leads")
        .select("id, name")
        .in("name", leadsData.map(l => l.name));

      if (allLeadsError) {
        throw allLeadsError;
      }

      // Verificar tarefas existentes antes de criar novas
      const { data: existingTasks } = await (supabase as any)
        .from("reminders")
        .select("lead_id, title")
        .not("lead_id", "is", null);

      const existingTasksSet = new Set(
        (existingTasks || []).map((t: any) => 
          `${t.lead_id}-${t.title?.toLowerCase().trim()}`
        )
      );

      // Criar tarefas vinculadas para leads específicos (apenas se não existirem)
      const tasksToCreate: any[] = [];

      // Buscar lead INGRED
      const ingredLead = allLeads?.find(l => l.name?.toLowerCase().trim() === 'ingred');
      if (ingredLead) {
        const taskKey = `${ingredLead.id}-tarefas ingred`;
        if (!existingTasksSet.has(taskKey)) {
          // Calcular data de vencimento: 30 dias a partir de hoje
          const dueDate = new Date();
          dueDate.setDate(dueDate.getDate() + 30);
          tasksToCreate.push({
            title: 'Tarefas INGRED',
            description: 'manaca, bancos, processos antigos, poupança',
            status: 'pendente',
            priority: 'media',
            lead_id: ingredLead.id,
            completed: false,
            due_date: dueDate.toISOString().split('T')[0], // Formato YYYY-MM-DD
          });
        }
      }

      // Buscar lead Intercambio
      const intercambioLead = allLeads?.find(l => l.name?.toLowerCase().trim() === 'intercambio');
      if (intercambioLead) {
        const taskKey = `${intercambioLead.id}-ações de cobrança`;
        if (!existingTasksSet.has(taskKey)) {
          // Calcular data de vencimento: 30 dias a partir de hoje
          const dueDate = new Date();
          dueDate.setDate(dueDate.getDate() + 30);
          tasksToCreate.push({
            title: capitalizeFirstLetter('Ações de Cobrança'),
            description: '2 ações de cobrança',
            status: 'pendente',
            priority: 'media',
            lead_id: intercambioLead.id,
            completed: false,
            due_date: dueDate.toISOString().split('T')[0], // Formato YYYY-MM-DD
          });
        }
      }

      // Inserir tarefas se houver novas
      if (tasksToCreate.length > 0) {
        const { error: tasksError } = await (supabase as any)
          .from("reminders")
          .insert(tasksToCreate);

        if (tasksError) {
          console.error("Erro ao criar tarefas:", tasksError);
          // Não lançar erro aqui, pois os leads já foram criados
        }
      }

      // Invalidar queries para atualizar a lista
      queryClient.invalidateQueries({ queryKey: ["leads"] });
      queryClient.invalidateQueries({ queryKey: ["reminders"] });

      const totalLeads = allLeads?.length || 0;
      const newLeadsCount = insertedLeads.length;
      const newTasksCount = tasksToCreate.length;

      toast({
        title: "Importação concluída!",
        description: newLeadsCount > 0 
          ? `${newLeadsCount} novo(s) lead(s) cadastrado(s). ${newTasksCount > 0 ? `${newTasksCount} nova(s) tarefa(s) criada(s).` : ''} Total: ${totalLeads} lead(s).`
          : `Nenhum lead novo para cadastrar. ${newTasksCount > 0 ? `${newTasksCount} nova(s) tarefa(s) criada(s).` : 'Nenhuma tarefa nova para criar.'} Total: ${totalLeads} lead(s).`,
      });
    } catch (error: any) {
      console.error("Erro ao importar leads:", error);
      toast({
        title: "Erro ao importar",
        description: error.message || "Ocorreu um erro ao importar os leads.",
        variant: "destructive",
      });
    } finally {
      setIsImporting(false);
    }
  };

  const handleCloseTaskDialog = () => {
    setTaskDialogOpen(false);
    setEditingTaskId(null);
    setTaskFormData({
      title: "",
      description: "",
      due_date: "",
      status: "pendente",
      priority: "media",
      category: "",
    });
  };


  const getStatusColor = (status: string) => {
    switch (status) {
      case "Inicial":
        return "bg-muted/10 text-muted-foreground";
      case "Negociação":
        return "bg-warning/10 text-warning";
      case "Fechado":
        return "bg-success/10 text-success";
      case "Perdido":
        return "bg-destructive/10 text-destructive";
      default:
        return "bg-muted/10 text-muted-foreground";
    }
  };

  return (
    <div className="w-full max-w-full overflow-x-hidden">
      <PageHeader
        title="Leads"
        description="Gerencie oportunidades de negócio"
        action={{
          label: "Novo Lead",
          onClick: handleNewItem,
        }}
      />

      <QuickActions />

      {/* Cards de Estatísticas */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
        <StatsCard
          title="Total de Leads"
          value={stats.total}
          icon={Target}
          className="bg-gradient-to-br from-primary/10 to-primary/5"
          onClick={() => {
            setSelectedStat("total");
            setDetailsDialogOpen(true);
          }}
        />
        <StatsCard
          title="Inicial"
          value={stats.inicial}
          icon={Clock}
          className="bg-gradient-to-br from-muted/10 to-muted/5"
          onClick={() => {
            setSelectedStat("inicial");
            setDetailsDialogOpen(true);
          }}
        />
        <StatsCard
          title="Negociação"
          value={stats.negociacao}
          icon={TrendingUp}
          className="bg-gradient-to-br from-warning/10 to-warning/5"
          onClick={() => {
            setSelectedStat("negociacao");
            setDetailsDialogOpen(true);
          }}
        />
        <StatsCard
          title="Fechado"
          value={stats.fechado}
          icon={CheckCircle2}
          className="bg-gradient-to-br from-success/10 to-success/5"
          onClick={() => {
            setSelectedStat("fechado");
            setDetailsDialogOpen(true);
          }}
        />
        <StatsCard
          title="Valor Total"
          value={formatCurrency(stats.totalValue)}
          icon={DollarSign}
          className="bg-gradient-to-br from-primary/10 to-primary/5"
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
                placeholder="Buscar por nome, status, observações..."
        />
            </div>
            <div className="flex gap-2 flex-wrap">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos Status</SelectItem>
                  <SelectItem value="Inicial">Inicial</SelectItem>
                  <SelectItem value="Negociação">Negociação</SelectItem>
                  <SelectItem value="Fechado">Fechado</SelectItem>
                  <SelectItem value="Perdido">Perdido</SelectItem>
                </SelectContent>
              </Select>
              <Button 
                onClick={handleImportLeads} 
                disabled={isImporting}
                variant="outline"
                className="gap-2 shadow-sm hover:shadow-elegant"
              >
                <Upload className="w-4 h-4" />
                <span className="hidden sm:inline">{isImporting ? "Importando..." : "Importar Dados"}</span>
                <span className="sm:hidden">{isImporting ? "..." : "Importar"}</span>
              </Button>
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
            Mostrando {resultCount} de {totalCount} {resultCount === 1 ? "lead" : "leads"}
          </div>
        )}
        </CardContent>
      </Card>

      <div className="bg-card rounded-2xl shadow-elegant-lg border border-border/50 overflow-x-auto">
        <Table className="w-full border-separate border-spacing-0 min-w-[1200px]">
          <TableHeader>
            <TableRow className="border-b-2 border-primary/30 hover:bg-transparent">
              <TableHead className="bg-gradient-to-r from-primary/10 to-primary/5 backdrop-blur-sm font-bold border-r border-border/50 rounded-tl-xl px-1.5 sm:px-2 text-xs text-center"><SortButton column="name">Nome</SortButton></TableHead>
              <TableHead className="bg-gradient-to-r from-primary/10 to-primary/5 backdrop-blur-sm font-bold border-r border-border/50 px-1.5 sm:px-2 text-xs text-center"><SortButton column="start_date">Data Início</SortButton></TableHead>
              <TableHead className="bg-gradient-to-r from-primary/10 to-primary/5 backdrop-blur-sm font-bold border-r border-border/50 px-1.5 sm:px-2 text-xs text-center"><SortButton column="end_date">Data Fim</SortButton></TableHead>
              <TableHead className="bg-gradient-to-r from-primary/10 to-primary/5 backdrop-blur-sm font-bold border-r border-border/50 px-1.5 sm:px-2 text-xs text-center"><SortButton column="status">Status</SortButton></TableHead>
              <TableHead className="bg-gradient-to-r from-primary/10 to-primary/5 backdrop-blur-sm font-bold border-r border-border/50 px-1.5 sm:px-2 text-xs text-center"><SortButton column="contract_value">Valor Contrato</SortButton></TableHead>
              <TableHead className="bg-gradient-to-r from-primary/10 to-primary/5 backdrop-blur-sm font-bold border-r border-border/50 px-1.5 sm:px-2 text-xs w-16 text-center">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedLeads?.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-12 text-muted-foreground/70 border-0">
                  <div className="flex flex-col items-center gap-2">
                    <div className="w-16 h-16 rounded-full bg-muted/30 border-2 border-border/50 flex items-center justify-center">
                      <span className="text-2xl">🎯</span>
                    </div>
                    <span className="font-medium">Nenhum lead cadastrado</span>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              sortedLeads?.map((lead, index) => (
                <TableRow 
                  key={lead.id} 
                  className={`border-b border-border/30 hover:bg-muted/20 transition-colors ${index % 2 === 0 ? "bg-card" : "bg-muted/5"}`}
                  onDoubleClick={() => handleEdit(lead)}
                >
                  <TableCell className="font-semibold text-foreground border-r border-border/30 px-1.5 sm:px-2 text-xs max-w-[150px] truncate text-center">{lead.name}</TableCell>
                  <TableCell className="font-medium text-foreground border-r border-border/30 px-1.5 sm:px-2 text-xs whitespace-nowrap text-center">{lead.start_date ? format(new Date(lead.start_date), "dd/MM/yyyy") : "-"}</TableCell>
                  <TableCell className="font-medium text-foreground border-r border-border/30 px-1.5 sm:px-2 text-xs whitespace-nowrap text-center">{lead.end_date ? format(new Date(lead.end_date), "dd/MM/yyyy") : "-"}</TableCell>
                  <TableCell className="border-r border-border/30 px-1.5 sm:px-2 text-xs text-center">
                    <Badge 
                      variant="outline"
                      className={`${
                        lead.status === "Inicial" ? "bg-muted/20 text-muted-foreground border-muted" :
                        lead.status === "Negociação" ? "bg-warning/20 text-warning border-warning/30" :
                        lead.status === "Fechado" ? "bg-success/20 text-success border-success/30" :
                        lead.status === "Perdido" ? "bg-destructive/20 text-destructive border-destructive/30" :
                        "bg-muted/20 text-muted-foreground border-muted"
                      }`}
                    >
                      {lead.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-center font-bold text-success border-r border-border/30 px-1.5 sm:px-2 text-xs whitespace-nowrap">
                    {lead.contract_value ? formatCurrency(lead.contract_value) : "-"}
                  </TableCell>
                  <TableCell className="text-center border-r border-border/30 px-1.5 sm:px-2 text-xs">
                    {(lead as any).reminders && Array.isArray((lead as any).reminders) && (lead as any).reminders.length > 0 ? (
                      <Badge variant="outline" className="bg-primary/10 text-primary border-primary/30">
                        {(lead as any).reminders.length} {(lead as any).reminders.length === 1 ? "tarefa" : "tarefas"}
                      </Badge>
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </TableCell>
                  <TableCell className="text-center border-r border-border/30 px-1.5 sm:px-2 text-xs w-16">
                    <div className="flex gap-1 justify-center">
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleEdit(lead)}
                              className="h-8 w-8"
                      >
                        <Pencil className="w-4 h-4" />
                      </Button>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>Editar lead</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                              onClick={() => handleDelete(lead.id)}
                              className="h-8 w-8 text-destructive hover:text-destructive"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>Excluir lead</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
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
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editingId ? "Editar Lead" : "Novo Lead"}</DialogTitle>
            <DialogDescription>
              {editingId ? "Edite os dados do lead abaixo." : "Preencha os dados para cadastrar um novo lead."}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={(e) => { e.preventDefault(); handleSubmit(e); }} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Nome *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                onBlur={(e) => handleCapitalizeLeadInput(e.target.value, (value) => setFormData({ ...formData, name: value }))}
                required
                placeholder="Nome do lead"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 sm:gap-4">
              <div className="space-y-2">
                <Label htmlFor="start_date">Data Início</Label>
                <Input
                  id="start_date"
                  type="date"
                  value={formData.start_date}
                  onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="end_date">Data Fim</Label>
                <Input
                  id="end_date"
                  type="date"
                  value={formData.end_date}
                  onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="contract_value">Valor Contrato</Label>
                <Input
                  id="contract_value"
                  type="text"
                  value={formData.contract_value}
                  onChange={(e) => {
                    const value = e.target.value.replace(/[^\d,.-]/g, "");
                    setFormData({ ...formData, contract_value: value });
                  }}
                  onBlur={(e) => {
                    const parsed = parseCurrency(e.target.value);
                    if (parsed !== null) {
                      setFormData({ ...formData, contract_value: formatCurrencyInput(parsed) });
                    }
                  }}
                  placeholder="R$ 0,00"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="status">Status</Label>
              <Select value={formData.status} onValueChange={(value) => setFormData({ ...formData, status: value })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-popover z-50">
                  <SelectItem value="Inicial">Inicial</SelectItem>
                  <SelectItem value="Negociação">Negociação</SelectItem>
                  <SelectItem value="Fechado">Fechado</SelectItem>
                  <SelectItem value="Perdido">Perdido</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">Observações</Label>
              <Textarea
                id="notes"
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                rows={3}
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Tarefas Vinculadas</Label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleNewTask}
                  className="gap-2"
                >
                  <Plus className="w-4 h-4" />
                  Nova Tarefa
                </Button>
              </div>
              <div className="space-y-2 max-h-64 overflow-y-auto border rounded-md p-3">
                {leadTasks.length > 0 ? (
                  leadTasks.map((task: any) => (
                    <div key={task.id} className="flex items-center justify-between p-2 border rounded-md hover:bg-muted/50">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-sm">{task.title}</span>
                          <Badge variant="outline" className="text-xs">
                            {task.status === "pendente" ? "Pendente" : task.status === "em_andamento" ? "Em Andamento" : "Concluída"}
                          </Badge>
                        </div>
                        {task.due_date && (
                          <span className="text-xs text-muted-foreground">
                            Vencimento: {format(new Date(task.due_date), "dd/MM/yyyy")}
                          </span>
                        )}
                      </div>
                      <div className="flex gap-1">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => handleEditTask(task)}
                          className="h-8 w-8"
                        >
                          <Pencil className="w-4 h-4" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => setTaskToDelete(task.id)}
                          className="h-8 w-8 text-destructive"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    Nenhuma tarefa vinculada. Clique em "Nova Tarefa" para adicionar.
                  </p>
                )}
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-4 border-t">
              <Button type="button" variant="outline" onClick={handleCloseDialog}>
                Cancelar
              </Button>
              {!editingId && (
                <Button type="button" variant="outline" onClick={handleSubmitAndNew}>
                  Cadastrar Novo
                </Button>
              )}
              <Button type="submit">
                {editingId ? "Atualizar" : "Cadastrar"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Dialog para Criar/Editar Tarefa */}
      <Dialog open={taskDialogOpen} onOpenChange={handleCloseTaskDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingTaskId ? "Editar Tarefa" : "Nova Tarefa"}</DialogTitle>
            <DialogDescription>
              {editingTaskId ? "Edite os dados da tarefa abaixo." : "Preencha os dados para criar uma nova tarefa vinculada ao lead."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="task_title">Título *</Label>
              <Input
                id="task_title"
                value={taskFormData.title}
                onChange={(e) => setTaskFormData({ ...taskFormData, title: e.target.value })}
                placeholder="Digite o título da tarefa"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="task_description">Descrição</Label>
              <Textarea
                id="task_description"
                value={taskFormData.description}
                onChange={(e) => setTaskFormData({ ...taskFormData, description: e.target.value })}
                rows={3}
                placeholder="Digite a descrição da tarefa"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="task_due_date">Data de Vencimento</Label>
                <Input
                  id="task_due_date"
                  type="date"
                  value={taskFormData.due_date}
                  onChange={(e) => setTaskFormData({ ...taskFormData, due_date: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="task_status">Status</Label>
                <Select
                  value={taskFormData.status}
                  onValueChange={(value: "pendente" | "em_andamento" | "concluida") =>
                    setTaskFormData({ ...taskFormData, status: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pendente">Pendente</SelectItem>
                    <SelectItem value="em_andamento">Em Andamento</SelectItem>
                    <SelectItem value="concluida">Concluída</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="task_priority">Prioridade</Label>
                <Select
                  value={taskFormData.priority}
                  onValueChange={(value: "baixa" | "media" | "alta") =>
                    setTaskFormData({ ...taskFormData, priority: value })
                  }
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
                <Label htmlFor="task_category">Categoria</Label>
                <Input
                  id="task_category"
                  value={taskFormData.category}
                  onChange={(e) => setTaskFormData({ ...taskFormData, category: e.target.value })}
                  placeholder="Ex: Reunião, Ligação, etc."
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-4 border-t">
              <Button type="button" variant="outline" onClick={handleCloseTaskDialog}>
                Cancelar
              </Button>
              <Button type="button" onClick={handleSaveTask}>
                {editingTaskId ? "Atualizar" : "Salvar"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* AlertDialog para Confirmar Exclusão de Tarefa */}
      <AlertDialog open={taskToDelete !== null} onOpenChange={(open) => !open && setTaskToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar Exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir esta tarefa? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setTaskToDelete(null)}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => taskToDelete && handleDeleteTask(taskToDelete)}
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
              {selectedStat === "total" && "Detalhes - Total de Leads"}
              {selectedStat === "inicial" && "Detalhes - Leads Iniciais"}
              {selectedStat === "negociacao" && "Detalhes - Leads em Negociação"}
              {selectedStat === "fechado" && "Detalhes - Leads Fechados"}
              {selectedStat === "value" && "Detalhes - Valor Total"}
            </DialogTitle>
            <DialogDescription>
              {selectedStat === "total" && `Lista completa de todos os ${stats.total} leads cadastrados.`}
              {selectedStat === "inicial" && `Lista dos ${stats.inicial} leads com status inicial.`}
              {selectedStat === "negociacao" && `Lista dos ${stats.negociacao} leads em negociação.`}
              {selectedStat === "fechado" && `Lista dos ${stats.fechado} leads fechados.`}
              {selectedStat === "value" && `Detalhamento do valor total de R$ ${formatCurrency(stats.totalValue)}.`}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {selectedStat === "total" && (
              <div className="max-h-[400px] overflow-y-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nome</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Data Início</TableHead>
                      <TableHead>Data Fim</TableHead>
                      <TableHead>Valor Contrato</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {leads?.map((lead: any) => (
                      <TableRow key={lead.id}>
                        <TableCell className="font-medium">{lead.name || "-"}</TableCell>
                        <TableCell>
                          <Badge className={getStatusColor(lead.status)}>
                            {lead.status || "-"}
                          </Badge>
                        </TableCell>
                        <TableCell>{lead.start_date ? format(new Date(lead.start_date), "dd/MM/yyyy", { locale: ptBR }) : "-"}</TableCell>
                        <TableCell>{lead.end_date ? format(new Date(lead.end_date), "dd/MM/yyyy", { locale: ptBR }) : "-"}</TableCell>
                        <TableCell>{lead.contract_value ? formatCurrency(lead.contract_value) : "-"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
            {selectedStat === "inicial" && (
              <div className="max-h-[400px] overflow-y-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nome</TableHead>
                      <TableHead>Data Início</TableHead>
                      <TableHead>Data Fim</TableHead>
                      <TableHead>Valor Contrato</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {leads?.filter((l: any) => l.status === "Inicial").map((lead: any) => (
                      <TableRow key={lead.id}>
                        <TableCell className="font-medium">{lead.name || "-"}</TableCell>
                        <TableCell>{lead.start_date ? format(new Date(lead.start_date), "dd/MM/yyyy", { locale: ptBR }) : "-"}</TableCell>
                        <TableCell>{lead.end_date ? format(new Date(lead.end_date), "dd/MM/yyyy", { locale: ptBR }) : "-"}</TableCell>
                        <TableCell>{lead.contract_value ? formatCurrency(lead.contract_value) : "-"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
            {selectedStat === "negociacao" && (
              <div className="max-h-[400px] overflow-y-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nome</TableHead>
                      <TableHead>Data Início</TableHead>
                      <TableHead>Data Fim</TableHead>
                      <TableHead>Valor Contrato</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {leads?.filter((l: any) => l.status === "Negociação").map((lead: any) => (
                      <TableRow key={lead.id}>
                        <TableCell className="font-medium">{lead.name || "-"}</TableCell>
                        <TableCell>{lead.start_date ? format(new Date(lead.start_date), "dd/MM/yyyy", { locale: ptBR }) : "-"}</TableCell>
                        <TableCell>{lead.end_date ? format(new Date(lead.end_date), "dd/MM/yyyy", { locale: ptBR }) : "-"}</TableCell>
                        <TableCell className="font-bold text-warning">{lead.contract_value ? formatCurrency(lead.contract_value) : "-"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
            {selectedStat === "fechado" && (
              <div className="max-h-[400px] overflow-y-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nome</TableHead>
                      <TableHead>Data Início</TableHead>
                      <TableHead>Data Fim</TableHead>
                      <TableHead>Valor Contrato</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {leads?.filter((l: any) => l.status === "Fechado").map((lead: any) => (
                      <TableRow key={lead.id}>
                        <TableCell className="font-medium">{lead.name || "-"}</TableCell>
                        <TableCell>{lead.start_date ? format(new Date(lead.start_date), "dd/MM/yyyy", { locale: ptBR }) : "-"}</TableCell>
                        <TableCell>{lead.end_date ? format(new Date(lead.end_date), "dd/MM/yyyy", { locale: ptBR }) : "-"}</TableCell>
                        <TableCell className="font-bold text-success">{lead.contract_value ? formatCurrency(lead.contract_value) : "-"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
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
                      <p className="text-sm text-muted-foreground mb-2">Leads com Valor</p>
                      <p className="text-2xl font-bold">{leads?.filter((l: any) => l.contract_value).length || 0}</p>
                    </CardContent>
                  </Card>
                </div>
                <div className="max-h-[400px] overflow-y-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Nome</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Valor Contrato</TableHead>
                        <TableHead>Data Fim</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {leads?.filter((l: any) => l.contract_value).sort((a: any, b: any) => (b.contract_value || 0) - (a.contract_value || 0)).map((lead: any) => (
                        <TableRow key={lead.id}>
                          <TableCell className="font-medium">{lead.name || "-"}</TableCell>
                          <TableCell>
                            <Badge className={getStatusColor(lead.status)}>
                              {lead.status || "-"}
                            </Badge>
                          </TableCell>
                          <TableCell className="font-bold text-success">{formatCurrency(lead.contract_value)}</TableCell>
                          <TableCell>{lead.end_date ? format(new Date(lead.end_date), "dd/MM/yyyy", { locale: ptBR }) : "-"}</TableCell>
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

      {/* Dialog de Confirmação de Exclusão */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar Exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir este lead? Esta ação não pode ser desfeita e pode afetar registros relacionados.
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


