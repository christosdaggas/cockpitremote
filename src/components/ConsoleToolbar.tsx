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

import type { ConsoleState } from "../hooks/useRfb";
import type { UiPrefs } from "../types";
import { ConfirmDialog } from "./common/ConfirmDialog";

export interface ConsoleToolbarProps {
    state: ConsoleState;
    prefs: UiPrefs;
    updatePrefs: (patch: Partial<UiPrefs>) => void;
    onConnect: () => void;
    onDisconnect: () => void;
    onCtrlAltDel: () => void;
    onFullscreen: () => void;
}

const LEVELS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];

export function ConsoleToolbar({ state, prefs, updatePrefs, onConnect, onDisconnect, onCtrlAltDel, onFullscreen }: ConsoleToolbarProps) {
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
                                ? <Button variant="secondary" isDanger onClick={onDisconnect}>Disconnect</Button>
                                : <Button variant="primary" onClick={onConnect}>Connect</Button>}
                        </ToolbarItem>
                        <ToolbarItem>
                            <Button variant="secondary" isDisabled={!connected || prefs.viewOnly}
                                    onClick={() => setConfirmCad(true)}>
                                Send Ctrl+Alt+Del
                            </Button>
                        </ToolbarItem>
                        <ToolbarItem>
                            <Button variant="plain" aria-label="Fullscreen" isDisabled={!connected}
                                    onClick={onFullscreen} icon={<ExpandIcon />} />
                        </ToolbarItem>
                    </ToolbarGroup>
                    <ToolbarGroup align={{ default: "alignRight" }}>
                        <ToolbarItem alignSelf="center">
                            <Switch
                                id="ctr-view-only"
                                label="View only"
                                isChecked={prefs.viewOnly}
                                onChange={(_event, checked) => updatePrefs({ viewOnly: checked })}
                            />
                        </ToolbarItem>
                        <ToolbarItem alignSelf="center">
                            <Switch
                                id="ctr-scale"
                                label="Scale to fit"
                                isChecked={prefs.scaleViewport}
                                onChange={(_event, checked) => updatePrefs({ scaleViewport: checked })}
                            />
                        </ToolbarItem>
                        <ToolbarItem>
                            <FormSelect
                                value={String(prefs.qualityLevel)}
                                onChange={(_event, value) => updatePrefs({ qualityLevel: Number(value) })}
                                aria-label="Image quality"
                                style={{ minWidth: "9rem" }}
                            >
                                {LEVELS.map(level => (
                                    <FormSelectOption key={level} value={String(level)} label={`Quality ${level}`} />
                                ))}
                            </FormSelect>
                        </ToolbarItem>
                        <ToolbarItem>
                            <FormSelect
                                value={String(prefs.compressionLevel)}
                                onChange={(_event, value) => updatePrefs({ compressionLevel: Number(value) })}
                                aria-label="Compression level"
                                style={{ minWidth: "10rem" }}
                            >
                                {LEVELS.map(level => (
                                    <FormSelectOption key={level} value={String(level)} label={`Compression ${level}`} />
                                ))}
                            </FormSelect>
                        </ToolbarItem>
                    </ToolbarGroup>
                </ToolbarContent>
            </Toolbar>
            <ConfirmDialog
                title="Send Ctrl+Alt+Del?"
                isOpen={confirmCad}
                confirmLabel="Send"
                variant="danger"
                onClose={() => setConfirmCad(false)}
                onConfirm={onCtrlAltDel}
            >
                This key combination is sent to the remote desktop and may log out the session or
                open the system monitor, depending on the desktop environment.
            </ConfirmDialog>
        </>
    );
}
