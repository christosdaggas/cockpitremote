import { useCallback, useEffect, useState } from "react";
import {
    Alert,
    Button,
    EmptyState,
    EmptyStateBody,
    EmptyStateHeader,
    EmptyStateIcon,
    FormSelect,
    FormSelectOption,
    Toolbar,
    ToolbarContent,
    ToolbarItem,
} from "@patternfly/react-core";
import { ListIcon, SyncAltIcon } from "@patternfly/react-icons";

import { LOG_LINE_CHOICES, LOG_PRIORITIES } from "../constants";
import { fetchLogs } from "../services/journal";
import type { UiPrefs, UnitScope } from "../types";
import { toUserMessage } from "../utils/errors";
import { Loading } from "./common/Loading";

export interface LogsTabProps {
    unit: string;
    scope: UnitScope;
    prefs: UiPrefs;
    updatePrefs: (patch: Partial<UiPrefs>) => void;
    isActive: boolean;
}

export function LogsTab({ unit, scope, prefs, updatePrefs, isActive }: LogsTabProps) {
    const [logs, setLogs] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const refresh = useCallback(async () => {
        if (!unit)
            return;
        setLoading(true);
        setError(null);
        try {
            setLogs(await fetchLogs(unit, prefs.logLines, prefs.logPriority, scope));
        } catch (err) {
            setError(toUserMessage(err, `Could not read the journal for ${unit}`));
        } finally {
            setLoading(false);
        }
    }, [unit, scope, prefs.logLines, prefs.logPriority]);

    // Load lazily: only fetch once the tab is actually shown.
    useEffect(() => {
        if (isActive)
            refresh();
    }, [isActive, refresh]);

    if (!unit) {
        return (
            <EmptyState>
                <EmptyStateHeader titleText="No unit configured" headingLevel="h2"
                                  icon={<EmptyStateIcon icon={ListIcon} />} />
                <EmptyStateBody>
                    Select a VNC backend on the Dashboard or in Settings to see its service logs here.
                </EmptyStateBody>
            </EmptyState>
        );
    }

    return (
        <div className="ctr-logs-panel">
            <Toolbar inset={{ default: "insetNone" }} className="ctr-logs-toolbar">
                <ToolbarContent>
                    <ToolbarItem>
                        <Button variant="secondary" icon={<SyncAltIcon />} onClick={refresh}
                                isLoading={loading} isDisabled={loading}>
                            Refresh
                        </Button>
                    </ToolbarItem>
                    <ToolbarItem>
                        <FormSelect value={String(prefs.logLines)} aria-label="Number of log lines"
                                    onChange={(_event, value) => updatePrefs({ logLines: Number(value) })}>
                            {LOG_LINE_CHOICES.map(n => (
                                <FormSelectOption key={n} value={String(n)} label={`Last ${n} lines`} />
                            ))}
                        </FormSelect>
                    </ToolbarItem>
                    <ToolbarItem>
                        <FormSelect value={prefs.logPriority === null ? "all" : String(prefs.logPriority)}
                                    aria-label="Log severity filter"
                                    onChange={(_event, value) =>
                                        updatePrefs({ logPriority: value === "all" ? null : Number(value) })}>
                            {LOG_PRIORITIES.map(p => (
                                <FormSelectOption key={p.label}
                                                  value={p.value === null ? "all" : String(p.value)}
                                                  label={p.label} />
                            ))}
                        </FormSelect>
                    </ToolbarItem>
                    <ToolbarItem alignSelf="center">
                        <span className="pf-v5-u-color-200">{unit}</span>
                    </ToolbarItem>
                </ToolbarContent>
            </Toolbar>
            {error && <Alert variant="danger" isInline title={error} className="pf-v5-u-mb-md" />}
            {loading && logs === null
                ? <Loading text="Reading the journal…" />
                : logs !== null && (
                    logs.trim() === ""
                        ? (
                            <EmptyState>
                                <EmptyStateHeader titleText="No log entries" headingLevel="h2"
                                                  icon={<EmptyStateIcon icon={ListIcon} />} />
                                <EmptyStateBody>
                                    The journal has no entries for {unit} matching the current filter.
                                </EmptyStateBody>
                            </EmptyState>
                        )
                        : <pre className="ctr-logs">{logs}</pre>
                )}
        </div>
    );
}
