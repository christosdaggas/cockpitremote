import { useState } from "react";
import {
    Button,
    FormSelect,
    FormSelectOption,
    Switch,
    Toolbar,
    ToolbarContent,
    ToolbarGroup,
    ToolbarItem,
} from "@patternfly/react-core";
import { ExpandIcon } from "@patternfly/react-icons";

import { _, format } from "../i18n";
import type { ConsoleState } from "../hooks/consoleState";
import type { UiPrefs } from "../types";
import { ClipboardPanel } from "./ClipboardPanel";
import { ConfirmDialog } from "./common/ConfirmDialog";

export interface ConsoleToolbarProps {
    state: ConsoleState;
    prefs: UiPrefs;
    updatePrefs: (patch: Partial<UiPrefs>) => void;
    onConnect: () => void;
    onDisconnect: () => void;
    onCtrlAltDel: () => void;
    onFullscreen: () => void;
    showEncodingPrefs?: boolean;
    /** Last selection copied on the remote desktop, for the clipboard panel. */
    remoteClipboard: string;
    onSendClipboard: (text: string) => void;
}

const LEVELS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];

export function ConsoleToolbar({
    state,
    prefs,
    updatePrefs,
    onConnect,
    onDisconnect,
    onCtrlAltDel,
    onFullscreen,
    showEncodingPrefs = true,
    remoteClipboard,
    onSendClipboard,
}: ConsoleToolbarProps) {
    const connected = state.kind === "connected";
    const busy = state.kind === "connecting" || state.kind === "credentials";
    const [confirmCad, setConfirmCad] = useState(false);

    return (
        <>
            <Toolbar inset={{ default: "insetNone" }} className="ctr-console-toolbar">
                <ToolbarContent>
                    <ToolbarGroup>
                        <ToolbarItem>
                            {connected || busy
                                ? <Button variant="secondary" isDanger onClick={onDisconnect}>{_("Disconnect")}</Button>
                                : <Button variant="primary" onClick={onConnect}>{_("Connect")}</Button>}
                        </ToolbarItem>
                        <ToolbarItem>
                            <Button variant="secondary" isDisabled={!connected || prefs.viewOnly}
                                    onClick={() => setConfirmCad(true)}>
                                {_("Send Ctrl+Alt+Del")}
                            </Button>
                        </ToolbarItem>
                        <ToolbarItem>
                            <ClipboardPanel remoteClipboard={remoteClipboard} isConnected={connected}
                                            onSend={onSendClipboard} />
                        </ToolbarItem>
                        <ToolbarItem>
                            <Button variant="plain" aria-label={_("Fullscreen")} isDisabled={!connected}
                                    onClick={onFullscreen} icon={<ExpandIcon />} />
                        </ToolbarItem>
                    </ToolbarGroup>
                    <ToolbarGroup align={{ default: "alignRight" }}>
                        <ToolbarItem alignSelf="center">
                            <Switch
                                id="ctr-view-only"
                                label={_("View only")}
                                isChecked={prefs.viewOnly}
                                onChange={(_event, checked) => updatePrefs({ viewOnly: checked })}
                            />
                        </ToolbarItem>
                        <ToolbarItem alignSelf="center">
                            <Switch
                                id="ctr-scale"
                                label={_("Scale to fit")}
                                isChecked={prefs.scaleViewport}
                                onChange={(_event, checked) => updatePrefs({ scaleViewport: checked })}
                            />
                        </ToolbarItem>
                        {showEncodingPrefs && (
                            <ToolbarItem>
                                <FormSelect
                                    value={String(prefs.qualityLevel)}
                                    onChange={(_event, value) => updatePrefs({ qualityLevel: Number(value) })}
                                    aria-label={_("Image quality, applied on the next connection")}
                                    style={{ minWidth: "9rem" }}
                                >
                                    {LEVELS.map(level => (
                                        <FormSelectOption key={level} value={String(level)}
                                                          label={format(_("Quality $0"), level)} />
                                    ))}
                                </FormSelect>
                            </ToolbarItem>
                        )}
                        {showEncodingPrefs && (
                            <ToolbarItem>
                                <FormSelect
                                    value={String(prefs.compressionLevel)}
                                    onChange={(_event, value) => updatePrefs({ compressionLevel: Number(value) })}
                                    aria-label={_("Compression level, applied on the next connection")}
                                    style={{ minWidth: "10rem" }}
                                >
                                    {LEVELS.map(level => (
                                        <FormSelectOption key={level} value={String(level)}
                                                          label={format(_("Compression $0"), level)} />
                                    ))}
                                </FormSelect>
                            </ToolbarItem>
                        )}
                    </ToolbarGroup>
                </ToolbarContent>
            </Toolbar>
            <ConfirmDialog
                title={_("Send Ctrl+Alt+Del?")}
                isOpen={confirmCad}
                confirmLabel={_("Send")}
                variant="danger"
                onClose={() => setConfirmCad(false)}
                onConfirm={onCtrlAltDel}
            >
                {_("This key combination is sent to the remote desktop and may log out the session or open the system monitor, depending on the desktop environment.")}
            </ConfirmDialog>
        </>
    );
}
