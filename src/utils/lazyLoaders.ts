// Utilitários para lazy loading de bibliotecas pesadas
// Isso melhora significativamente o carregamento inicial das páginas

// Lazy load recharts - apenas quando gráficos são necessários
export const loadRecharts = () => import("recharts");

// Lazy load jspdf - apenas quando exportação PDF é necessária
export const loadJSPDF = async () => {
  const [jsPDF, autoTable] = await Promise.all([
    import("jspdf"),
    import("jspdf-autotable")
  ]);
  return { jsPDF: jsPDF.default, autoTable: autoTable.default };
};

// Lazy load xlsx - apenas quando exportação Excel é necessária
export const loadXLSX = () => import("xlsx");

// Preload de bibliotecas críticas (opcional - para melhorar UX)
export const preloadLibraries = () => {
  // Preload apenas em idle time para não bloquear renderização inicial
  if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
    requestIdleCallback(() => {
      loadRecharts().catch(() => {});
    });
  }
};


