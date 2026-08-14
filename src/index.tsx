// SPDX-FileCopyrightText: 2026 Christos A. Daggas
// SPDX-License-Identifier: LGPL-2.1-or-later

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
