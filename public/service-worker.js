// Service Worker para PWA - Sistema de Gestão VANDE
// Cache básico para modo offline simples

const CACHE_NAME = 'vande-gestao-v4';
const urlsToCache = [
  '/',
  '/index.html'
];

// Instalação do Service Worker
self.addEventListener('install', (event) => {
  console.log('Service Worker: Instalando versão v4...');
  
  // Força a ativação imediata do novo service worker
  self.skipWaiting();
  
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('Service Worker: Cache aberto');
        // Adiciona recursos um por um para evitar falha se algum não existir
        return Promise.allSettled(
          urlsToCache.map((url) => {
            return fetch(url, { cache: 'no-cache' })
              .then((response) => {
                if (response && response.ok) {
                  return cache.put(url, response);
                } else {
                  console.warn(`Service Worker: Recurso não encontrado: ${url}`);
                  return Promise.resolve();
                }
              })
              .catch((error) => {
                // Silencia erros de recursos não encontrados
                console.warn(`Service Worker: Erro ao fazer cache de ${url}:`, error.message);
                return Promise.resolve(); // Continua mesmo se falhar
              });
          })
        );
      })
      .then(() => {
        console.log('Service Worker: Instalação concluída com sucesso');
      })
      .catch((error) => {
        // Não loga erro completo para evitar poluição do console
        console.warn('Service Worker: Alguns recursos não puderam ser cacheados');
      })
  );
});

// Ativação do Service Worker
self.addEventListener('activate', (event) => {
  console.log('Service Worker: Ativando versão v4...');
  
  event.waitUntil(
    Promise.all([
      // Remove todos os caches antigos
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
              console.log('Service Worker: Removendo cache antigo:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
      }),
      // Assume controle imediato de todas as páginas
      self.clients.claim()
    ])
  );
  
  console.log('Service Worker: Ativação concluída');
});

// Estratégia: Network First, depois Cache
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  
  // Ignora requisições que não são GET (POST, PUT, DELETE, etc)
  if (event.request.method !== 'GET') {
    return; // Deixa passar direto para a rede
  }

  // Ignora requisições para APIs externas (Supabase)
  if (url.hostname.includes('supabase.co') || 
      url.hostname.includes('supabase.io')) {
    return; // Deixa passar direto para a rede
  }

  // Ignora requisições de desenvolvimento (hot reload, etc)
  if (url.hostname.includes('localhost') || 
      url.hostname.includes('127.0.0.1') ||
      url.hostname.includes('0.0.0.0')) {
    return; // Deixa passar direto para a rede
  }

  // Ignora requisições para rotas SPA (não são arquivos estáticos)
  // Rotas do React Router não devem ser cacheadas como arquivos
  // Verifica se a URL tem extensão de arquivo (arquivos estáticos) ou é uma rota SPA
  const pathnameWithoutQuery = url.pathname.split('?')[0];
  const hasFileExtension = /\.[a-zA-Z0-9]+$/.test(pathnameWithoutQuery);
  
  // Lista de rotas SPA conhecidas
  const spaRoutes = [
    '/faturamento', '/receitas', '/despesas', '/clientes', '/imoveis', 
    '/gado', '/processos', '/leads', '/anotacoes', '/tarefas', 
    '/aplicacoes', '/relatorios', '/emprestimos', '/importar-dados',
    '/dashboards-financeiros', '/login', '/register', '/reset-password'
  ];
  
  // Se não tem extensão de arquivo E não é index.html ou raiz, provavelmente é rota SPA
  const isSpaRoute = !hasFileExtension && 
                     pathnameWithoutQuery !== '/' && 
                     pathnameWithoutQuery !== '/index.html' &&
                     (spaRoutes.some(route => pathnameWithoutQuery.startsWith(route)) ||
                      !pathnameWithoutQuery.includes('.'));
  
  // Ignora completamente rotas SPA - deixa o navegador lidar normalmente
  if (isSpaRoute) {
    return; // Não intercepta - deixa passar direto para o navegador/React Router
  }

  // Ignora requisições para ícones que não existem
  if (url.pathname.includes('/icons/icon-') && url.pathname.endsWith('.png')) {
    return; // Deixa passar direto para a rede
  }

  // Ignora requisições para WebSocket, EventSource, etc
  if (event.request.cache === 'only-if-cached' && event.request.mode !== 'same-origin') {
    return;
  }
  
  // Ignora requisições que não são do mesmo origin (evita erros CORS)
  if (url.origin !== self.location.origin) {
    return;
  }

  event.respondWith(
    fetch(event.request, { cache: 'no-cache' })
      .then((response) => {
        // Só faz cache de respostas válidas (200), do mesmo origin e que sejam arquivos estáticos
        const isStaticFile = hasFileExtension && 
                            (url.pathname.startsWith('/src/') || 
                             url.pathname.startsWith('/assets/') ||
                             url.pathname.startsWith('/icons/') ||
                             url.pathname.startsWith('/favicon') ||
                             url.pathname === '/index.html' ||
                             url.pathname === '/');
        
        if (response && 
            response.status === 200 && 
            response.type === 'basic' &&
            url.origin === self.location.origin &&
            isStaticFile) {
          // Clona a resposta antes de armazenar no cache
          const responseToCache = response.clone();
          
          // Faz cache de forma assíncrona sem bloquear
          caches.open(CACHE_NAME)
            .then((cache) => {
              cache.put(event.request, responseToCache).catch(() => {
                // Silencia erros de cache
              });
            })
            .catch(() => {
              // Silencia erros de cache
            });
        }
        
        return response;
      })
      .catch((error) => {
        // Se a rede falhar, tenta buscar do cache apenas para arquivos estáticos
        if (hasFileExtension) {
          return caches.match(event.request)
            .then((cachedResponse) => {
              if (cachedResponse) {
                return cachedResponse;
              }
              // Se não encontrar no cache e for documento HTML, retorna index.html
              if (event.request.destination === 'document' || 
                  event.request.headers.get('accept')?.includes('text/html')) {
                return caches.match('/index.html');
              }
              // Para outros recursos estáticos não encontrados, retorna null (navegador trata)
              return null;
            });
        }
        
        // Para rotas SPA, sempre retorna null para deixar o navegador lidar
        // Isso evita erros 404 no console
        return null;
      })
  );
});

// Notificações push (opcional - para implementação futura)
self.addEventListener('push', (event) => {
  const options = {
    body: event.data ? event.data.text() : 'Nova notificação do sistema',
    icon: '/favicon.svg',
    badge: '/favicon.svg',
    vibrate: [200, 100, 200],
    tag: 'vande-notification'
  };

  event.waitUntil(
    self.registration.showNotification('Sistema VANDE', options)
  );
});


