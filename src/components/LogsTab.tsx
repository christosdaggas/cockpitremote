import { useCallback, useEffect, useState } from "react";
import {
    Alert,
    Button,
    Card,
    CardBody,
    CardTitle,
    EmptyState,
    EmptyStateBody,
    FormSelect,
    FormSelectOption,
    Toolbar,
    ToolbarContent,
    ToolbarItem,
} from "@patternfly/react-core";
import { ListIcon, SyncAltIcon } from "@patternfly/react-icons";

import { LOG_LINE_CHOICES, LOG_PRIORITIES } from "../constants";
import { _, format } from "../i18n";
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
            setError(toUserMessage(err, format(_("Could not read the journal for $0"), unit)));
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
            <EmptyState titleText={_("No unit configured")} headingLevel="h2" icon={ListIcon}>
                <EmptyStateBody>
                    {_("Select a remote desktop backend on the Dashboard or in Settings to see its service logs here.")}
                </EmptyStateBody>
            </EmptyState>
        );
    }

    return (
        <Card className="ctr-logs-card">
            <CardTitle>{_("Service journal")}</CardTitle>
            <CardBody>
                <Toolbar inset={{ default: "insetNone" }} className="ctr-logs-toolbar">
                    <ToolbarContent>
                        <ToolbarItem>
                            <Button variant="secondary" icon={<SyncAltIcon />} onClick={refresh}
                                    isLoading={loading} isDisabled={loading}>
                                {_("Refresh")}
                            </Button>
                        </ToolbarItem>
                        <ToolbarItem>
                            <FormSelect value={String(prefs.logLines)} aria-label={_("Number of log lines")}
                                        onChange={(_event, value) => updatePrefs({ logLines: Number(value) })}>
                                {LOG_LINE_CHOICES.map(n => (
                                    <FormSelectOption key={n} value={String(n)} label={format(_("Last $0 lines"), n)} />
                                ))}
                            </FormSelect>
                        </ToolbarItem>
                        <ToolbarItem>
                            <FormSelect value={prefs.logPriority === null ? "all" : String(prefs.logPriority)}
                                        aria-label={_("Log severity filter")}
                                        onChange={(_event, value) =>
                                            updatePrefs({ logPriority: value === "all" ? null : Number(value) })}>
                                {LOG_PRIORITIES.map(p => (
                                    <FormSelectOption key={p.label}
                                                      value={p.value === null ? "all" : String(p.value)}
                                                      label={_(p.label)} />
                                ))}
                            </FormSelect>
                        </ToolbarItem>
                        <ToolbarItem alignSelf="center">
                            <span>{unit}</span>
                        </ToolbarItem>
                    </ToolbarContent>
                </Toolbar>
                {error && <Alert variant="danger" isInline title={error} className="pf-v6-u-mb-md" />}
                {loading && logs === null
                    ? <Loading text={_("Reading the journal…")} />
                    : logs !== null && (
                        logs.trim() === ""
                            ? (
                                <EmptyState titleText={_("No log entries")} headingLevel="h2" icon={ListIcon}>
                                    <EmptyStateBody>
                                        {format(_("The journal has no entries for $0 matching the current filter."), unit)}
                                    </EmptyStateBody>
                                </EmptyState>
                            )
                            : <pre className="ctr-logs">{logs}</pre>
                    )}
            </CardBody>
        </Card>
    );
}
