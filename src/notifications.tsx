import { createContext, useContext } from "react";

export type NotifyVariant = "success" | "danger" | "warning" | "info";

export type NotifyFn = (variant: NotifyVariant, title: string, detail?: string) => void;

/* Toast notifications; the provider lives in app.tsx. */
export const NotifyContext = createContext<NotifyFn>(() => undefined);

export function useNotify(): NotifyFn {
    return useContext(NotifyContext);
}
