import { createContext, useContext, useEffect, useState } from "react";
import { toast } from "sonner";
import { API_BASE_URL } from "../lib/config";
import type { AppConfig } from "../types/config";

interface ConfigContextType {
  config: AppConfig | null;
  isLoading: boolean;
  error: boolean;
}

const ConfigContext = createContext<ConfigContextType>({
  config: null,
  isLoading: true,
  error: false,
});

export function ConfigProvider({ children }: { children: React.ReactNode }) {
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    fetch(`${API_BASE_URL}/config`)
      .then((res) => {
        if (!res.ok) throw new Error(`Config request failed: ${res.status}`);
        return res.json();
      })
      .then((data) => {
        setConfig(data);
        setIsLoading(false);
      })
      .catch((err) => {
        console.error("Failed to fetch config:", err);
        // Surface the failure, then fall back to all-enabled so the app stays usable.
        toast.error("Couldn't load app config from the server — showing all features.");
        setError(true);
        setConfig({ s3: true, sqs: true });
        setIsLoading(false);
      });
  }, []);

  return <ConfigContext.Provider value={{ config, isLoading, error }}>{children}</ConfigContext.Provider>;
}

export function useConfig() {
  return useContext(ConfigContext);
}
