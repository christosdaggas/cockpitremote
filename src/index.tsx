import { createRoot } from "react-dom/client";

import "./lib/dark-theme";
import "@patternfly/react-core/dist/styles/base.css";
import "./app.css";

import { App } from "./app";

document.addEventListener("DOMContentLoaded", () => {
    const container = document.getElementById("app");
    if (container)
        createRoot(container).render(<App />);
});
