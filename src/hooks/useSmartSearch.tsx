import { useState, useMemo, useEffect, useRef } from "react";

/**
 * Hook inteligente de busca que filtra dados em múltiplas colunas com debounce
 * @param data - Array de dados para filtrar
 * @param searchableFields - Array de chaves dos campos que devem ser pesquisáveis
 * @param debounceMs - Tempo de debounce em milissegundos (padrão: 300ms)
 * @returns Objeto com searchTerm, setSearchTerm e filteredData
 */
export function useSmartSearch<T extends Record<string, any>>(
  data: T[] | undefined,
  searchableFields: (keyof T)[],
  debounceMs: number = 300
) {
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState("");
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Debounce do termo de busca
  useEffect(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    debounceTimerRef.current = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm);
    }, debounceMs);

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [searchTerm, debounceMs]);

  const filteredData = useMemo(() => {
    if (!data || !debouncedSearchTerm.trim()) return data;

    const normalizedSearch = debouncedSearchTerm
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .trim();

    return data.filter((item) => {
      return searchableFields.some((field) => {
        const value = item[field];
        
        if (value === null || value === undefined) return false;
        
        // Converte para string e normaliza
        const normalizedValue = String(value)
          .toLowerCase()
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "");

        // Busca parcial (contém)
        return normalizedValue.includes(normalizedSearch);
      });
    });
  }, [data, debouncedSearchTerm, searchableFields]);

  return {
    searchTerm,
    setSearchTerm,
    filteredData,
    resultCount: filteredData?.length || 0,
    totalCount: data?.length || 0,
  };
}

