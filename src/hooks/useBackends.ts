import { useCallback, useEffect, useState } from "react";

import { detectBackends } from "../services/backends";
import { getListeningSockets } from "../services/network";
import { getSessionInfo } from "../services/session";
import type { BackendInfo, ListeningSocket, SessionInfo } from "../types";
import { toUserMessage } from "../utils/errors";

export interface BackendsData {
    backends: BackendInfo[] | null;
    session: SessionInfo | null;
    sockets: ListeningSocket[];
    loading: boolean;
    error: string | null;
    refresh: () => Promise<void>;
}

export function useBackends(): BackendsData {
    const [backends, setBackends] = useState<BackendInfo[] | null>(null);
    const [session, setSession] = useState<SessionInfo | null>(null);
    const [sockets, setSockets] = useState<ListeningSocket[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const refresh = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const sessionInfo = await getSessionInfo();
            const [detected, listening] = await Promise.all([
                detectBackends(sessionInfo),
                getListeningSockets().catch(() => [] as ListeningSocket[]),
            ]);
            setSession(sessionInfo);
            setBackends(detected);
            setSockets(listening);
        } catch (err) {
            setError(toUserMessage(err, "Could not inspect the system"));
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        refresh();
    }, [refresh]);

    return { backends, session, sockets, loading, error, refresh };
}
