import { RouterProvider } from "@tanstack/react-router";
import { useEffect } from "react";
import { Toaster } from "sonner";
import { useConfig } from "@/contexts/ConfigContext";
import { router } from "@/router";

function App() {
  const { config } = useConfig();

  // Re-run route guards once the async config resolves (null -> loaded).
  // biome-ignore lint/correctness/useExhaustiveDependencies: config is the intentional trigger
  useEffect(() => {
    router.invalidate();
  }, [config]);

  return (
    <>
      <Toaster />
      <RouterProvider router={router} context={{ config }} />
    </>
  );
}

export default App;
