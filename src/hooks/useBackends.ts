import { useCallback, useEffect, useState } from "react";

import cockpit from "../lib/cockpit";
import { detectBackends } from "../services/backends";
import { getListeningSockets } from "../services/network";
import { getSessionInfo } from "../services/session";
import type { BackendInfo, ListeningSocket, SessionInfo } from "../types";
import { toUserMessage } from "../utils/errors";

export interface BackendsData {
    backends: BackendInfo[] | null;
    session: SessionInfo | null;
    sockets: ListeningSocket[];
    /** The user this Cockpit session runs as (null until resolved). */
    loginUser: string | null;
    loading: boolean;
    error: string | null;
    refresh: () => Promise<void>;
}

export function useBackends(): BackendsData {
    const [backends, setBackends] = useState<BackendInfo[] | null>(null);
    const [session, setSession] = useState<SessionInfo | null>(null);
    const [sockets, setSockets] = useState<ListeningSocket[]>([]);
    const [loginUser, setLoginUser] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        cockpit.user().then(user => setLoginUser(user.name)).catch(() => setLoginUser(null));
    }, []);

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

    return { backends, session, sockets, loginUser, loading, error, refresh };
}
