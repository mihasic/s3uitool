import { createContext, useContext, useEffect, useState } from "react";
import { API_BASE_URL } from "../lib/config";
import type { AppConfig } from "../types/config";

interface ConfigContextType {
  config: AppConfig | null;
  isLoading: boolean;
}

const ConfigContext = createContext<ConfigContextType>({
  config: null,
  isLoading: true,
});

export function ConfigProvider({ children }: { children: React.ReactNode }) {
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetch(`${API_BASE_URL}/config`)
      .then((res) => res.json())
      .then((data) => {
        setConfig(data);
        setIsLoading(false);
      })
      .catch((err) => {
        console.error("Failed to fetch config:", err);
        // Fallback to all enabled if fetch fails (e.g. dev mode without backend)
        setConfig({ s3: true, sqs: true });
        setIsLoading(false);
      });
  }, []);

  return <ConfigContext.Provider value={{ config, isLoading }}>{children}</ConfigContext.Provider>;
}

export function useConfig() {
  return useContext(ConfigContext);
}
