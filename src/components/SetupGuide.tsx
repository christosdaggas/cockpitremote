import { useState } from "react";
import {
    Alert,
    Button,
    ClipboardCopy,
    CodeBlock,
    CodeBlockCode,
    ExpandableSection,
    Stack,
    StackItem,
} from "@patternfly/react-core";

import { BACKENDS, type BackendDef } from "../constants";
import { useNotify } from "../notifications";
import { installPackages } from "../services/packages";
import type { BackendInfo, OsInfo } from "../types";
import { isCancelled, toUserMessage } from "../utils/errors";
import { ConfirmDialog } from "./common/ConfirmDialog";

export interface SetupGuideProps {
    os: OsInfo | null;
    backends: BackendInfo[];
    onRefresh: () => Promise<void>;
    defaultExpanded: boolean;
}

const INSTALL_COMMANDS: Record<string, (pkg: string) => string> = {
    dnf: pkg => `sudo dnf install -y ${pkg}`,
    apt: pkg => `sudo apt install -y ${pkg}`,
    zypper: pkg => `sudo zypper install ${pkg}`,
};

const TIGERVNC_STEPS = `# 1. Map a VNC display to your user (display :1 = port 5901):
echo ":1=YOUR_USERNAME" | sudo tee -a /etc/tigervnc/vncserver.users

# 2. Set that user's VNC password (or use "Set VNC password" in Settings):
vncpasswd

# 3. Start the virtual desktop session now and on every boot:
sudo systemctl enable --now vncserver@:1.service`;

export function SetupGuide({ os, backends, onRefresh, defaultExpanded }: SetupGuideProps) {
    const notify = useNotify();
    const [installTarget, setInstallTarget] = useState<BackendDef | null>(null);
    const [installing, setInstalling] = useState(false);
    const [expanded, setExpanded] = useState(defaultExpanded);

    const pm = os?.packageManager ?? null;
    const missing = BACKENDS.filter(def =>
        def.offerInstall && !backends.find(b => b.id === def.id)?.binaryPath);
    // Keyed on what actually works, not on the installable list: GNOME
    // Remote Desktop is never offered for install but may already serve VNC.
    const anyInstalled = backends.some(b => b.binaryPath !== null && b.supported);

    const install = async (def: BackendDef) => {
        if (!pm)
            return;
        setInstalling(true);
        try {
            await installPackages(pm, [def.packages[pm]]);
            notify("success", `Installed ${def.packages[pm]}`);
        } catch (err) {
            if (!isCancelled(err))
                notify("danger", `Could not install ${def.packages[pm]}`, toUserMessage(err));
        } finally {
            setInstalling(false);
            await onRefresh();
        }
    };

    return (
        <ExpandableSection toggleText="Setup guide" isIndented displaySize="lg"
                           className="ctr-setup-guide-panel"
                           isExpanded={expanded} onToggle={(_e, value) => setExpanded(value)}>
            <Stack hasGutter>
                {anyInstalled && (
                    <StackItem>
                        <Alert variant="success" isInline isPlain
                               title="A usable VNC server is installed. Configure and start it above or in Settings." />
                    </StackItem>
                )}
                {!anyInstalled && missing.length > 0 && (
                    <StackItem>
                        <p>
                            A VNC server must be installed <strong>on this host</strong> (nothing is ever
                            installed on the computer you are browsing from). Detected system:{" "}
                            <strong>{os?.prettyName ?? "unknown"}</strong>.
                        </p>
                    </StackItem>
                )}
                {missing.map(def => (
                    <StackItem key={def.id}>
                        <strong>{def.label}</strong>
                        <p>{def.description}</p>
                        {pm
                            ? (
                                <Stack hasGutter>
                                    <StackItem>
                                        <ClipboardCopy isReadOnly hoverTip="Copy" clickTip="Copied">
                                            {INSTALL_COMMANDS[pm](def.packages[pm])}
                                        </ClipboardCopy>
                                    </StackItem>
                                    <StackItem>
                                        <Button variant="secondary" size="sm" isDisabled={installing}
                                                onClick={() => setInstallTarget(def)}>
                                            Install {def.packages[pm]}
                                        </Button>
                                    </StackItem>
                                </Stack>
                            )
                            : (
                                <Alert variant="info" isInline isPlain
                                       title="Unknown package manager — install the package with your distribution's tools." />
                            )}
                    </StackItem>
                ))}
                <StackItem>
                    <strong>TigerVNC post-install steps (recommended path)</strong>
                    <CodeBlock>
                        <CodeBlockCode>{TIGERVNC_STEPS}</CodeBlockCode>
                    </CodeBlock>
                    <p className="pf-v5-u-mt-sm">
                        Then select TigerVNC above, verify port 5901 in Settings, and connect from the
                        Remote desktop tab. The VNC server only needs to listen on 127.0.0.1 — traffic
                        is tunneled through Cockpit&apos;s encrypted session.
                    </p>
                </StackItem>
            </Stack>
            {installTarget && pm && (
                <ConfirmDialog
                    title={`Install ${installTarget.packages[pm]}?`}
                    isOpen
                    confirmLabel="Install"
                    onClose={() => setInstallTarget(null)}
                    onConfirm={() => install(installTarget)}
                >
                    This runs <code>{INSTALL_COMMANDS[pm](installTarget.packages[pm])}</code> with
                    administrative privileges on the host.
                </ConfirmDialog>
            )}
        </ExpandableSection>
    );
}
