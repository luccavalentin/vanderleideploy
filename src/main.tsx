import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// Configurar locale para pt-BR
if (typeof document !== "undefined") {
  document.documentElement.lang = "pt-BR";
  document.documentElement.setAttribute("lang", "pt-BR");
}

// Registrar Service Worker para PWA (defer para não bloquear renderização)
if ("serviceWorker" in navigator) {
  // Usar requestIdleCallback para não bloquear renderização inicial
  const registerSW = () => {
    navigator.serviceWorker
      .register("/service-worker.js", { updateViaCache: "none" })
      .then((registration) => {
        // Log apenas em desenvolvimento
        if (import.meta.env.DEV) {
          console.log("✅ Service Worker registrado:", registration.scope);
        }
        
        // Verifica atualizações do service worker
        registration.addEventListener("updatefound", () => {
          const newWorker = registration.installing;
          if (newWorker) {
            newWorker.addEventListener("statechange", () => {
              if (newWorker.state === "installed" && navigator.serviceWorker.controller) {
                // Nova versão disponível - atualizar em background
                if (import.meta.env.DEV) {
                  console.log("🔄 Nova versão do Service Worker disponível");
                }
              }
            });
          }
        });
      })
      .catch((error) => {
        // Silenciar erros de SW em produção
        if (import.meta.env.DEV) {
          console.error("❌ Falha ao registrar Service Worker:", error);
        }
      });
  };

  // Registrar após carregamento completo ou em idle time
  if (document.readyState === 'complete') {
    if ('requestIdleCallback' in window) {
      requestIdleCallback(registerSW, { timeout: 2000 });
    } else {
      setTimeout(registerSW, 1000);
    }
  } else {
    window.addEventListener("load", () => {
      if ('requestIdleCallback' in window) {
        requestIdleCallback(registerSW, { timeout: 2000 });
      } else {
        setTimeout(registerSW, 1000);
      }
    });
  }
}

// Renderização otimizada
const rootElement = document.getElementById("root");
if (rootElement) {
  const root = createRoot(rootElement);
  root.render(<App />);
} else {
  console.error("Root element not found");
}
