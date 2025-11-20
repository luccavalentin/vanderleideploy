import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ThemeProvider } from "next-themes";
import { AppSidebar } from "@/components/layout/AppSidebar";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import Dashboard from "./pages/Dashboard";
import Receitas from "./pages/Receitas";
import Despesas from "./pages/Despesas";
import Emprestimos from "./pages/Emprestimos";
import Clientes from "./pages/Clientes";
import Imoveis from "./pages/Imoveis";
import Gado from "./pages/Gado";
import Processos from "./pages/Processos";
import Leads from "./pages/Leads";
import Anotacoes from "./pages/Anotacoes";
import Tarefas from "./pages/Tarefas";
import Relatorios from "./pages/Relatorios";
import Aplicacoes from "./pages/Aplicacoes";
import Faturamento from "./pages/Faturamento";
import ImportData from "./pages/ImportData";
import BusinessGrowth from "./pages/BusinessGrowth";
import CostReduction from "./pages/CostReduction";
import RevenueOptimization from "./pages/RevenueOptimization";
import Login from "./pages/Login";
import Register from "./pages/Register";
import ResetPassword from "./pages/ResetPassword";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: (failureCount, error: any) => {
        // Não retry em erros 404 ou de tabela não encontrada
        const errorMessage = error?.message || "";
        const errorCode = error?.code || "";
        
        if (errorCode === "PGRST116" || 
            errorCode === "NOT_FOUND" ||
            errorMessage.includes("404") || 
            errorMessage.includes("Not Found") ||
            errorMessage.includes("NOT_FOUND") ||
            errorMessage.includes("Could not find the table") ||
            errorMessage.includes("schema cache") ||
            (errorMessage.includes("relation") && errorMessage.includes("does not exist"))) {
          return false;
        }
        // Retry até 2 vezes para outros erros
        return failureCount < 2;
      },
      retryDelay: 1000,
      staleTime: 30000, // Cache por 30 segundos
      refetchOnWindowFocus: false, // Não refetch ao focar na janela
      onError: (error: any) => {
        // Silencia erros 404 no console para não poluir
        const errorMessage = error?.message || "";
        const errorCode = error?.code || "";
        
        if (errorCode === "PGRST116" || 
            errorCode === "NOT_FOUND" ||
            errorMessage.includes("404") || 
            errorMessage.includes("Not Found") ||
            errorMessage.includes("NOT_FOUND") ||
            errorMessage.includes("Could not find the table") ||
            (errorMessage.includes("relation") && errorMessage.includes("does not exist"))) {
          // Erro silenciado - tabela não existe, será tratado individualmente
          return;
        }
        // Outros erros podem ser logados normalmente
        console.error("Query error:", error);
      },
    },
  },
});

const App = () => (
  <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false}>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter
          future={{
            v7_startTransition: true,
            v7_relativeSplatPath: true,
          }}
        >
          <Routes>
            {/* Rotas públicas */}
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            
            {/* Rotas protegidas */}
            <Route
              path="/*"
              element={
                <ProtectedRoute>
                  <div className="flex min-h-screen bg-background overflow-x-hidden w-full max-w-full">
                    <AppSidebar />
                    <main className="flex-1 md:ml-64 p-2 sm:p-3 md:p-4 lg:p-6 xl:p-8 w-full max-w-full overflow-x-hidden">
                      <div className="w-full max-w-full overflow-x-hidden">
                        <Routes>
                        <Route path="/" element={<Dashboard />} />
                        <Route path="/receitas" element={<Receitas />} />
                        <Route path="/despesas" element={<Despesas />} />
                        <Route path="/emprestimos" element={<Emprestimos />} />
                        <Route path="/clientes" element={<Clientes />} />
                        <Route path="/imoveis" element={<Imoveis />} />
                        <Route path="/gado" element={<Gado />} />
                        <Route path="/processos" element={<Processos />} />
                        <Route path="/leads" element={<Leads />} />
                        <Route path="/anotacoes" element={<Anotacoes />} />
                        <Route path="/tarefas" element={<Tarefas />} />
                        <Route path="/aplicacoes" element={<Aplicacoes />} />
                        <Route path="/faturamento" element={<Faturamento />} />
                        <Route path="/relatorios" element={<Relatorios />} />
                        <Route path="/dashboards-financeiros" element={<Relatorios />} />
                        <Route path="/importar-dados" element={<ImportData />} />
                        <Route path="/crescimento-negocios" element={<BusinessGrowth />} />
                        <Route path="/crescimento-negocios/reducao-custo" element={<CostReduction />} />
                        <Route path="/crescimento-negocios/otimizacao-receita" element={<RevenueOptimization />} />
                        <Route path="*" element={<NotFound />} />
                        </Routes>
                      </div>
                    </main>
                  </div>
                </ProtectedRoute>
              }
            />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  </ThemeProvider>
);

export default App;
