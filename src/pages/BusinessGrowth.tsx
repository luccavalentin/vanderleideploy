import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { TrendingUp, TrendingDown, Target, Lightbulb, Calendar, DollarSign, ArrowRight, BarChart3 } from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend
} from "recharts";

const COLORS = ['hsl(var(--success))', 'hsl(var(--destructive))', 'hsl(var(--primary))', 'hsl(var(--warning))'];

export default function BusinessGrowth() {
  const navigate = useNavigate();

  const { data: costIdeas = [] } = useQuery({
    queryKey: ["cost_reduction_ideas"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cost_reduction_ideas")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  const { data: revenueIdeas = [] } = useQuery({
    queryKey: ["revenue_optimization_ideas"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("revenue_optimization_ideas")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  const { data: plans = [] } = useQuery({
    queryKey: ["business_growth_plans"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("business_growth_plans")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  const stats = useMemo(() => {
    const totalEstimatedSavings = costIdeas.reduce((sum: number, idea: any) => {
      return sum + (parseFloat(idea.estimated_savings || 0));
    }, 0);

    const totalActualSavings = costIdeas.reduce((sum: number, idea: any) => {
      return sum + (parseFloat(idea.actual_savings || 0));
    }, 0);

    const totalEstimatedRevenue = revenueIdeas.reduce((sum: number, idea: any) => {
      return sum + (parseFloat(idea.estimated_revenue || 0));
    }, 0);

    const totalActualRevenue = revenueIdeas.reduce((sum: number, idea: any) => {
      return sum + (parseFloat(idea.actual_revenue || 0));
    }, 0);

    const implementedCostIdeas = costIdeas.filter((idea: any) => idea.status === "implementada").length;
    const implementedRevenueIdeas = revenueIdeas.filter((idea: any) => idea.status === "implementada").length;

    const activePlans = plans.filter((plan: any) => 
      plan.status === "planejamento" || plan.status === "em_andamento"
    ).length;

    return {
      totalEstimatedSavings,
      totalActualSavings,
      totalEstimatedRevenue,
      totalActualRevenue,
      implementedCostIdeas,
      implementedRevenueIdeas,
      activePlans,
      totalIdeas: costIdeas.length + revenueIdeas.length,
    };
  }, [costIdeas, revenueIdeas, plans]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  const statusData = [
    { name: "Pendente", value: costIdeas.filter((i: any) => i.status === "pendente").length + revenueIdeas.filter((i: any) => i.status === "pendente").length },
    { name: "Em Análise", value: costIdeas.filter((i: any) => i.status === "em_analise").length + revenueIdeas.filter((i: any) => i.status === "em_analise").length },
    { name: "Aprovada", value: costIdeas.filter((i: any) => i.status === "aprovada").length + revenueIdeas.filter((i: any) => i.status === "aprovada").length },
    { name: "Implementada", value: stats.implementedCostIdeas + stats.implementedRevenueIdeas },
  ];

  const categoryData = useMemo(() => {
    const categories: Record<string, number> = {};
    [...costIdeas, ...revenueIdeas].forEach((idea: any) => {
      const cat = idea.category || "Sem Categoria";
      categories[cat] = (categories[cat] || 0) + 1;
    });
    return Object.entries(categories).map(([name, value]) => ({ name, value }));
  }, [costIdeas, revenueIdeas]);

  return (
    <div className="w-full max-w-full overflow-x-hidden">
      <PageHeader
        title="Crescimento dos Negócios"
        description="Gerencie ideias e planejamentos para reduzir custos e aumentar receitas"
      />

      {/* Cards de Estatísticas Principais */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <Card className="border-2 border-success/30 rounded-2xl shadow-elegant-lg bg-gradient-card hover:scale-[1.01] transition-all duration-300">
          <CardContent className="p-4 sm:p-6">
            <div className="flex items-center justify-between">
              <div className="space-y-1 flex-1">
                <p className="text-[10px] sm:text-xs font-semibold uppercase tracking-wider text-success">
                  Economia Estimada
                </p>
                <p className="text-xl sm:text-2xl md:text-3xl font-bold tracking-tight leading-none text-success break-words">
                  {formatCurrency(stats.totalEstimatedSavings)}
                </p>
                {stats.totalActualSavings > 0 && (
                  <p className="text-[8px] sm:text-[9px] text-muted-foreground/70 font-medium">
                    Realizada: {formatCurrency(stats.totalActualSavings)}
                  </p>
                )}
              </div>
              <div className="relative p-3 sm:p-4 md:p-5 rounded-lg sm:rounded-xl shadow-sm bg-success/10 text-success flex-shrink-0 ml-2 sm:ml-4">
                <TrendingDown className="w-5 h-5 sm:w-6 sm:h-6 md:w-7 md:h-7" strokeWidth={2.5} />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-2 border-primary/30 rounded-2xl shadow-elegant-lg bg-gradient-card hover:scale-[1.01] transition-all duration-300">
          <CardContent className="p-4 sm:p-6">
            <div className="flex items-center justify-between">
              <div className="space-y-1 flex-1">
                <p className="text-[10px] sm:text-xs font-semibold uppercase tracking-wider text-primary">
                  Receita Estimada
                </p>
                <p className="text-xl sm:text-2xl md:text-3xl font-bold tracking-tight leading-none text-primary break-words">
                  {formatCurrency(stats.totalEstimatedRevenue)}
                </p>
                {stats.totalActualRevenue > 0 && (
                  <p className="text-[8px] sm:text-[9px] text-muted-foreground/70 font-medium">
                    Realizada: {formatCurrency(stats.totalActualRevenue)}
                  </p>
                )}
              </div>
              <div className="relative p-3 sm:p-4 md:p-5 rounded-lg sm:rounded-xl shadow-sm bg-primary/10 text-primary flex-shrink-0 ml-2 sm:ml-4">
                <TrendingUp className="w-5 h-5 sm:w-6 sm:h-6 md:w-7 md:h-7" strokeWidth={2.5} />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-2 border-warning/30 rounded-2xl shadow-elegant-lg bg-gradient-card hover:scale-[1.01] transition-all duration-300">
          <CardContent className="p-4 sm:p-6">
            <div className="flex items-center justify-between">
              <div className="space-y-1 flex-1">
                <p className="text-[10px] sm:text-xs font-semibold uppercase tracking-wider text-warning">
                  Total de Ideias
                </p>
                <p className="text-xl sm:text-2xl md:text-3xl font-bold tracking-tight leading-none text-warning break-words">
                  {stats.totalIdeas}
                </p>
                <p className="text-[8px] sm:text-[9px] text-muted-foreground/70 font-medium">
                  {stats.implementedCostIdeas + stats.implementedRevenueIdeas} implementadas
                </p>
              </div>
              <div className="relative p-3 sm:p-4 md:p-5 rounded-lg sm:rounded-xl shadow-sm bg-warning/10 text-warning flex-shrink-0 ml-2 sm:ml-4">
                <Lightbulb className="w-5 h-5 sm:w-6 sm:h-6 md:w-7 md:h-7" strokeWidth={2.5} />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-2 border-primary/30 rounded-2xl shadow-elegant-lg bg-gradient-card hover:scale-[1.01] transition-all duration-300">
          <CardContent className="p-4 sm:p-6">
            <div className="flex items-center justify-between">
              <div className="space-y-1 flex-1">
                <p className="text-[10px] sm:text-xs font-semibold uppercase tracking-wider text-primary">
                  Planos Ativos
                </p>
                <p className="text-xl sm:text-2xl md:text-3xl font-bold tracking-tight leading-none text-primary break-words">
                  {stats.activePlans}
                </p>
                <p className="text-[8px] sm:text-[9px] text-muted-foreground/70 font-medium">
                  Em planejamento ou execução
                </p>
              </div>
              <div className="relative p-3 sm:p-4 md:p-5 rounded-lg sm:rounded-xl shadow-sm bg-primary/10 text-primary flex-shrink-0 ml-2 sm:ml-4">
                <Target className="w-5 h-5 sm:w-6 sm:h-6 md:w-7 md:h-7" strokeWidth={2.5} />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Cards de Navegação */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        <Card 
          className="border-2 border-destructive/30 rounded-2xl shadow-elegant-lg bg-gradient-to-br from-destructive/5 to-card hover:scale-[1.02] transition-all duration-300 cursor-pointer"
          onClick={() => navigate("/crescimento-negocios/reducao-custo")}
        >
          <CardContent className="p-6">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-3">
                  <div className="p-3 rounded-lg bg-destructive/10">
                    <TrendingDown className="h-8 w-8 text-destructive" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-foreground">Redução de Custo</h3>
                    <p className="text-sm text-muted-foreground">Ideias e planejamentos para reduzir custos</p>
                  </div>
                </div>
                <div className="space-y-2 mb-4">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Ideias cadastradas:</span>
                    <span className="font-semibold">{costIdeas.length}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Economia estimada:</span>
                    <span className="font-semibold text-success">{formatCurrency(stats.totalEstimatedSavings)}</span>
                  </div>
                </div>
                <Button className="w-full gap-2" variant="outline">
                  Acessar <ArrowRight className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card 
          className="border-2 border-success/30 rounded-2xl shadow-elegant-lg bg-gradient-to-br from-success/5 to-card hover:scale-[1.02] transition-all duration-300 cursor-pointer"
          onClick={() => navigate("/crescimento-negocios/otimizacao-receita")}
        >
          <CardContent className="p-6">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-3">
                  <div className="p-3 rounded-lg bg-success/10">
                    <TrendingUp className="h-8 w-8 text-success" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-foreground">Otimização de Receita</h3>
                    <p className="text-sm text-muted-foreground">Ideias e planejamentos para aumentar receitas</p>
                  </div>
                </div>
                <div className="space-y-2 mb-4">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Ideias cadastradas:</span>
                    <span className="font-semibold">{revenueIdeas.length}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Receita estimada:</span>
                    <span className="font-semibold text-success">{formatCurrency(stats.totalEstimatedRevenue)}</span>
                  </div>
                </div>
                <Button className="w-full gap-2" variant="outline">
                  Acessar <ArrowRight className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Gráficos */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <Card className="border-2 border-border/50 rounded-2xl shadow-elegant-lg">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="w-5 h-5" />
              Status das Ideias
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={statusData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {statusData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="border-2 border-border/50 rounded-2xl shadow-elegant-lg">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="w-5 h-5" />
              Ideias por Categoria
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={categoryData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" angle={-45} textAnchor="end" height={100} />
                <YAxis />
                <Tooltip />
                <Bar dataKey="value" fill="hsl(var(--primary))" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

