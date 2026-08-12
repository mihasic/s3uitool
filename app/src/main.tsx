import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import { Providers } from "./providers";
import "./index.css";

// biome-ignore lint/style/noNonNullAssertion: root element is guaranteed to exist
createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Providers>
      <App />
    </Providers>
  </StrictMode>,
);
