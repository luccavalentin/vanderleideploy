import { lazy, Suspense } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ThemeProvider } from "next-themes";
import { AppSidebar } from "@/components/layout/AppSidebar";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { PageLoader } from "@/components/ui/PageLoader";

// Lazy loading para melhor performance - carrega apenas quando necessário
const Dashboard = lazy(() => import("./pages/Dashboard"));
const Receitas = lazy(() => import("./pages/Receitas"));
const Despesas = lazy(() => import("./pages/Despesas"));
const Emprestimos = lazy(() => import("./pages/Emprestimos"));
const Clientes = lazy(() => import("./pages/Clientes"));
const Imoveis = lazy(() => import("./pages/Imoveis"));
const Gado = lazy(() => import("./pages/Gado"));
const Processos = lazy(() => import("./pages/Processos"));
const Leads = lazy(() => import("./pages/Leads"));
const Anotacoes = lazy(() => import("./pages/Anotacoes"));
const Tarefas = lazy(() => import("./pages/Tarefas"));
const Relatorios = lazy(() => import("./pages/Relatorios"));
const Aplicacoes = lazy(() => import("./pages/Aplicacoes"));
const Faturamento = lazy(() => import("./pages/Faturamento"));
const ImportData = lazy(() => import("./pages/ImportData"));
const BusinessGrowth = lazy(() => import("./pages/BusinessGrowth"));
const CostReduction = lazy(() => import("./pages/CostReduction"));
const RevenueOptimization = lazy(() => import("./pages/RevenueOptimization"));
const Login = lazy(() => import("./pages/Login"));
const Register = lazy(() => import("./pages/Register"));
const ResetPassword = lazy(() => import("./pages/ResetPassword"));
const NotFound = lazy(() => import("./pages/NotFound"));

// Preload de rotas críticas após carregamento inicial
if (typeof window !== 'undefined') {
  // Preload das páginas mais acessadas após idle
  const preloadCriticalRoutes = () => {
    if ('requestIdleCallback' in window) {
      requestIdleCallback(() => {
        // Preload Dashboard, Receitas e Despesas (páginas mais usadas)
        import("./pages/Dashboard").catch(() => {});
        import("./pages/Receitas").catch(() => {});
        import("./pages/Despesas").catch(() => {});
      }, { timeout: 2000 });
    } else {
      // Fallback para navegadores sem requestIdleCallback
      setTimeout(() => {
        import("./pages/Dashboard").catch(() => {});
        import("./pages/Receitas").catch(() => {});
        import("./pages/Despesas").catch(() => {});
      }, 2000);
    }
  };
  
  // Preload após carregamento inicial
  if (document.readyState === 'complete') {
    preloadCriticalRoutes();
  } else {
    window.addEventListener('load', preloadCriticalRoutes);
  }
}

// QueryClient otimizado para performance
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: (failureCount, error: any) => {
        const errorMessage = error?.message || "";
        const errorCode = error?.code || "";
        
        // Não retry em erros 404 ou de tabela não encontrada
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
        return failureCount < 2;
      },
      retryDelay: 1000,
      staleTime: 60000, // Cache por 60 segundos (aumentado para melhor performance)
      gcTime: 300000, // 5 minutos (antigo cacheTime)
      refetchOnWindowFocus: false,
      refetchOnMount: false, // Não refetch se dados estão frescos (melhor performance)
      refetchOnReconnect: true,
      // Prefetch de queries relacionadas
      structuralSharing: true, // Mantém referências de objetos quando possível
      // Network mode otimizado
      networkMode: 'online', // Só fazer queries quando online
      onError: (error: any) => {
        const errorMessage = error?.message || "";
        const errorCode = error?.code || "";
        
        if (errorCode === "PGRST116" || 
            errorCode === "NOT_FOUND" ||
            errorMessage.includes("404") || 
            errorMessage.includes("Not Found") ||
            errorMessage.includes("NOT_FOUND") ||
            errorMessage.includes("Could not find the table") ||
            (errorMessage.includes("relation") && errorMessage.includes("does not exist"))) {
          return;
        }
        console.error("Query error:", error);
      },
    },
    mutations: {
      retry: 1,
      retryDelay: 500,
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
            {/* Rotas públicas - Lazy loaded */}
            <Route 
              path="/login" 
              element={
                <Suspense fallback={<PageLoader />}>
                  <Login />
                </Suspense>
              } 
            />
            <Route 
              path="/register" 
              element={
                <Suspense fallback={<PageLoader />}>
                  <Register />
                </Suspense>
              } 
            />
            <Route 
              path="/reset-password" 
              element={
                <Suspense fallback={<PageLoader />}>
                  <ResetPassword />
                </Suspense>
              } 
            />
            
            {/* Rotas protegidas - Lazy loaded */}
            <Route
              path="/*"
              element={
                <ProtectedRoute>
                  <div className="flex min-h-screen bg-background overflow-x-hidden w-full max-w-full">
                    <AppSidebar />
                    <main className="flex-1 md:ml-64 p-2 sm:p-3 md:p-4 lg:p-6 xl:p-8 w-full max-w-full overflow-x-hidden">
                      <div className="w-full max-w-full overflow-x-hidden">
                        <Routes>
                        <Route 
                          path="/" 
                          element={
                            <Suspense fallback={<PageLoader />}>
                              <Dashboard />
                            </Suspense>
                          } 
                        />
                        <Route 
                          path="/receitas" 
                          element={
                            <Suspense fallback={<PageLoader />}>
                              <Receitas />
                            </Suspense>
                          } 
                        />
                        <Route 
                          path="/despesas" 
                          element={
                            <Suspense fallback={<PageLoader />}>
                              <Despesas />
                            </Suspense>
                          } 
                        />
                        <Route 
                          path="/emprestimos" 
                          element={
                            <Suspense fallback={<PageLoader />}>
                              <Emprestimos />
                            </Suspense>
                          } 
                        />
                        <Route 
                          path="/clientes" 
                          element={
                            <Suspense fallback={<PageLoader />}>
                              <Clientes />
                            </Suspense>
                          } 
                        />
                        <Route 
                          path="/imoveis" 
                          element={
                            <Suspense fallback={<PageLoader />}>
                              <Imoveis />
                            </Suspense>
                          } 
                        />
                        <Route 
                          path="/gado" 
                          element={
                            <Suspense fallback={<PageLoader />}>
                              <Gado />
                            </Suspense>
                          } 
                        />
                        <Route 
                          path="/processos" 
                          element={
                            <Suspense fallback={<PageLoader />}>
                              <Processos />
                            </Suspense>
                          } 
                        />
                        <Route 
                          path="/leads" 
                          element={
                            <Suspense fallback={<PageLoader />}>
                              <Leads />
                            </Suspense>
                          } 
                        />
                        <Route 
                          path="/anotacoes" 
                          element={
                            <Suspense fallback={<PageLoader />}>
                              <Anotacoes />
                            </Suspense>
                          } 
                        />
                        <Route 
                          path="/tarefas" 
                          element={
                            <Suspense fallback={<PageLoader />}>
                              <Tarefas />
                            </Suspense>
                          } 
                        />
                        <Route 
                          path="/aplicacoes" 
                          element={
                            <Suspense fallback={<PageLoader />}>
                              <Aplicacoes />
                            </Suspense>
                          } 
                        />
                        <Route 
                          path="/faturamento" 
                          element={
                            <Suspense fallback={<PageLoader />}>
                              <Faturamento />
                            </Suspense>
                          } 
                        />
                        <Route 
                          path="/relatorios" 
                          element={
                            <Suspense fallback={<PageLoader />}>
                              <Relatorios />
                            </Suspense>
                          } 
                        />
                        <Route 
                          path="/dashboards-financeiros" 
                          element={
                            <Suspense fallback={<PageLoader />}>
                              <Relatorios />
                            </Suspense>
                          } 
                        />
                        <Route 
                          path="/importar-dados" 
                          element={
                            <Suspense fallback={<PageLoader />}>
                              <ImportData />
                            </Suspense>
                          } 
                        />
                        <Route 
                          path="/crescimento-negocios" 
                          element={
                            <Suspense fallback={<PageLoader />}>
                              <BusinessGrowth />
                            </Suspense>
                          } 
                        />
                        <Route 
                          path="/crescimento-negocios/reducao-custo" 
                          element={
                            <Suspense fallback={<PageLoader />}>
                              <CostReduction />
                            </Suspense>
                          } 
                        />
                        <Route 
                          path="/crescimento-negocios/otimizacao-receita" 
                          element={
                            <Suspense fallback={<PageLoader />}>
                              <RevenueOptimization />
                            </Suspense>
                          } 
                        />
                        <Route 
                          path="*" 
                          element={
                            <Suspense fallback={<PageLoader />}>
                              <NotFound />
                            </Suspense>
                          } 
                        />
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
