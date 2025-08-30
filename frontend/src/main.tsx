import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import { AppIntegrated } from "./AppIntegrated.tsx";
import { ErrorBoundary } from "./components";

import { library } from "@fortawesome/fontawesome-svg-core";
import { fas } from "@fortawesome/free-solid-svg-icons";
library.add(fas);

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ErrorBoundary>
      <AppIntegrated />
    </ErrorBoundary>
  </StrictMode>,
);
