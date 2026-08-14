import { useState } from "react";
import {
    Button,
    Popover,
    Stack,
    StackItem,
    TextArea,
} from "@patternfly/react-core";
import { CopyIcon } from "@patternfly/react-icons";

import { _ } from "../i18n";

export interface ClipboardPanelProps {
    /** The last selection copied on the remote desktop, if any. */
    remoteClipboard: string;
    /** Whether a session is running; the controls are inert without one. */
    isConnected: boolean;
    onSend: (text: string) => void;
}

/*
 * Clipboard sync happens on its own — the paste shortcut carries text into the
 * session, and a selection copied on the remote is written to the local
 * clipboard. Both halves depend on browser permissions that quietly refuse:
 * Firefox only allows a clipboard write while handling a user gesture, and a
 * browser that suppresses the paste event leaves nothing to forward. These
 * controls are the manual path for exactly those cases, which is why the
 * copy happens in a click handler.
 */
export function ClipboardPanel({ remoteClipboard, isConnected, onSend }: ClipboardPanelProps) {
    const [outgoing, setOutgoing] = useState("");
    const [copied, setCopied] = useState(false);
    const [sent, setSent] = useState(false);

    const copyFromRemote = () => {
        // The click is the user gesture Firefox insists on, so this write
        // succeeds where the automatic one after the selection arrived did not.
        navigator.clipboard?.writeText(remoteClipboard)
            .then(() => {
                setCopied(true);
                window.setTimeout(() => setCopied(false), 2000);
            })
            .catch(() => {
                // Still refused: the text stays selectable in the box above.
            });
    };

    const sendToRemote = () => {
        onSend(outgoing);
        setOutgoing("");
        setSent(true);
        window.setTimeout(() => setSent(false), 2000);
    };

    return (
        <Popover
            headerContent={_("Clipboard")}
            hasAutoWidth
            position="bottom"
            bodyContent={
                <Stack hasGutter className="ctr-clipboard-panel">
                    <StackItem>
                        <label className="ctr-clipboard-label" htmlFor="ctr-clipboard-in">
                            {_("Copied on the remote desktop")}
                        </label>
                        <TextArea
                            id="ctr-clipboard-in"
                            value={remoteClipboard}
                            readOnlyVariant="default"
                            rows={4}
                            aria-label={_("Copied on the remote desktop")}
                            placeholder={_("Copy something in the session and it appears here.")}
                        />
                        <Button variant="secondary" icon={<CopyIcon />} className="ctr-clipboard-action"
                                isDisabled={!remoteClipboard} onClick={copyFromRemote}>
                            {copied ? _("Copied") : _("Copy to my clipboard")}
                        </Button>
                    </StackItem>
                    <StackItem>
                        <label className="ctr-clipboard-label" htmlFor="ctr-clipboard-out">
                            {_("Send to the remote desktop")}
                        </label>
                        <TextArea
                            id="ctr-clipboard-out"
                            value={outgoing}
                            onChange={(_event, value) => setOutgoing(value)}
                            rows={4}
                            aria-label={_("Send to the remote desktop")}
                            placeholder={_("Text typed here goes to the remote clipboard, ready to paste.")}
                        />
                        <Button variant="secondary" className="ctr-clipboard-action"
                                isDisabled={!isConnected || !outgoing} onClick={sendToRemote}>
                            {sent ? _("Sent") : _("Send")}
                        </Button>
                    </StackItem>
                </Stack>
            }
        >
            <Button variant="secondary" isDisabled={!isConnected}>
                {_("Clipboard")}
            </Button>
        </Popover>
    );
}
