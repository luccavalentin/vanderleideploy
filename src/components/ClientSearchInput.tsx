import { useMemo, useState, useRef, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Loader2, Search, X, Check } from "lucide-react";
import { cn } from "@/lib/utils";

interface Client {
  id: string;
  name: string;
  cpf_cnpj?: string;
  email?: string;
}

interface ClientSearchInputProps {
  value: string;
  onChange: (value: string) => void;
  clients?: Client[];
  placeholder?: string;
  isLoading?: boolean;
  emptyStateAction?: React.ReactNode;
}

export function ClientSearchInput({
  value,
  onChange,
  clients,
  placeholder = "Buscar cliente cadastrado...",
  isLoading = false,
  emptyStateAction,
}: ClientSearchInputProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const selectedClient = useMemo(
    () => clients?.find((client) => client.id === value),
    [clients, value]
  );

  // Inicializar searchTerm com o nome do cliente selecionado
  useEffect(() => {
    if (selectedClient && !searchTerm) {
      setSearchTerm(selectedClient.name);
    }
  }, [selectedClient]);

  // Filtrar clientes conforme o termo de busca
  const filteredClients = useMemo(() => {
    if (!clients || !searchTerm.trim()) {
      return clients?.slice(0, 10) || []; // Limitar a 10 resultados quando não há busca
    }

    const normalizedSearch = searchTerm
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .trim();

    return clients
      .filter((client) => {
        const nameMatch = client.name
          ?.toLowerCase()
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "")
          .includes(normalizedSearch);
        
        const cpfCnpjMatch = client.cpf_cnpj
          ?.toLowerCase()
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "")
          .includes(normalizedSearch);

        const emailMatch = client.email
          ?.toLowerCase()
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "")
          .includes(normalizedSearch);

        return nameMatch || cpfCnpjMatch || emailMatch;
      })
      .slice(0, 10); // Limitar a 10 resultados
  }, [clients, searchTerm]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setSearchTerm(newValue);
    setIsOpen(true);
    setHighlightedIndex(-1);
    
    // Se limpar o campo, limpar também a seleção
    if (!newValue.trim()) {
      onChange("");
    }
  };

  const handleSelectClient = (client: Client) => {
    setSearchTerm(client.name);
    onChange(client.id);
    setIsOpen(false);
    setHighlightedIndex(-1);
    inputRef.current?.blur();
  };

  const handleClear = () => {
    setSearchTerm("");
    onChange("");
    setIsOpen(false);
    inputRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!isOpen || filteredClients.length === 0) return;

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setHighlightedIndex((prev) =>
          prev < filteredClients.length - 1 ? prev + 1 : prev
        );
        break;
      case "ArrowUp":
        e.preventDefault();
        setHighlightedIndex((prev) => (prev > 0 ? prev - 1 : -1));
        break;
      case "Enter":
        e.preventDefault();
        if (highlightedIndex >= 0 && filteredClients[highlightedIndex]) {
          handleSelectClient(filteredClients[highlightedIndex]);
        }
        break;
      case "Escape":
        setIsOpen(false);
        setHighlightedIndex(-1);
        inputRef.current?.blur();
        break;
    }
  };

  // Fechar dropdown ao clicar fora
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
        setHighlightedIndex(-1);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className="relative w-full" ref={dropdownRef}>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
        <Input
          ref={inputRef}
          type="text"
          value={searchTerm}
          onChange={handleInputChange}
          onFocus={() => setIsOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className={cn(
            "pl-10 pr-10 w-full",
            selectedClient && "border-primary"
          )}
          disabled={isLoading}
        />
        {isLoading && (
          <Loader2 className="absolute right-10 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
        )}
        {searchTerm && !isLoading && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7"
            onClick={handleClear}
          >
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>

      {/* Dropdown de resultados */}
      {isOpen && (
        <div className="absolute z-50 w-full mt-1 bg-popover border border-border rounded-md shadow-lg max-h-60 overflow-auto">
          {filteredClients.length > 0 ? (
            <div className="p-1">
              {filteredClients.map((client, index) => (
                <div
                  key={client.id}
                  onClick={() => handleSelectClient(client)}
                  className={cn(
                    "flex items-center gap-2 px-3 py-2 rounded-sm cursor-pointer transition-colors",
                    index === highlightedIndex
                      ? "bg-accent text-accent-foreground"
                      : "hover:bg-accent hover:text-accent-foreground",
                    value === client.id && "bg-primary/10"
                  )}
                >
                  <Check
                    className={cn(
                      "h-4 w-4 shrink-0",
                      value === client.id ? "opacity-100 text-primary" : "opacity-0"
                    )}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate">{client.name}</div>
                    {client.cpf_cnpj && (
                      <div className="text-xs text-muted-foreground truncate">
                        {client.cpf_cnpj}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : searchTerm.trim() ? (
            <div className="p-6 text-center text-sm text-muted-foreground">
              <div className="space-y-3">
                <p>Nenhum cliente encontrado</p>
                {emptyStateAction}
              </div>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}



