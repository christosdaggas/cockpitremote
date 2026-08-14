// SPDX-FileCopyrightText: 2026 Christos A. Daggas
// SPDX-License-Identifier: LGPL-2.1-or-later

import { useEffect, useState } from "react";
import {
    ActionGroup,
    Alert,
    Button,
    Card,
    CardBody,
    CardTitle,
    Form,
    FormGroup,
    FormHelperText,
    FormSelect,
    FormSelectOption,
    HelperText,
    HelperTextItem,
    TextInput,
} from "@patternfly/react-core";

import { BACKENDS, DEFAULT_RDP_PORT, backendDef } from "../constants";
import { _, format } from "../i18n";
import { useNotify } from "../notifications";
import { setVncScreenShareMode } from "../services/screenshare";
import type { BackendId, BackendInfo, GrdRdpMode, GrdVncScreenShareMode, RemoteConfig } from "../types";
import { toUserMessage } from "../utils/errors";
import {
    ValidationError,
    isLoopback,
    portWarning,
    validateAddress,
    validateGeometry,
    validatePort,
    validateUnitName,
    validateUsername,
} from "../utils/validation";
import { PasswordModal } from "./PasswordModal";

export interface SettingsTabProps {
    config: RemoteConfig;
    save: (next: RemoteConfig) => Promise<void>;
    onRefresh: () => Promise<void>;
    /** Detection results, used to gate and pre-fill backend choices. */
    backends: BackendInfo[] | null;
}

interface FormState {
    backend: string;
    unit: string;
    address: string;
    port: string;
    rdpMode: GrdRdpMode;
    geometry: string;
    vncUser: string;
}

type Errors = Partial<Record<keyof FormState, string>>;

function fromConfig(config: RemoteConfig): FormState {
    return {
        backend: config.backend ?? "",
        unit: config.unit,
        address: config.address,
        port: String(config.port),
        rdpMode: config.rdpMode,
        geometry: config.geometry,
        vncUser: config.vncUser,
    };
}

/** The port a given RDP mode actually listens on, when detection found it. */
function portForMode(info: BackendInfo | undefined, mode: GrdRdpMode): number | null {
    return (mode === "remote-login" ? info?.remoteLoginPort : info?.detectedPort) ?? null;
}

function validateForm(form: FormState): { errors: Errors; config?: RemoteConfig } {
    const errors: Errors = {};
    const port = Number(form.port);

    const check = (field: keyof FormState, fn: () => void) => {
        try {
            fn();
        } catch (err) {
            errors[field] = err instanceof ValidationError ? err.message : String(err);
        }
    };

    if (form.unit)
        check("unit", () => validateUnitName(form.unit));
    else if (form.backend)
        errors.unit = _("A systemd unit is required for the selected backend.");
    check("address", () => validateAddress(form.address));
    check("port", () => validatePort(port));
    if (form.geometry)
        check("geometry", () => validateGeometry(form.geometry));
    if (form.vncUser)
        check("vncUser", () => validateUsername(form.vncUser));
    if (Object.keys(errors).length > 0)
        return { errors };
    return {
        errors,
        config: {
            backend: (form.backend || null) as BackendId | null,
            unit: form.unit,
            address: form.address,
            port,
            rdpMode: form.rdpMode,
            geometry: form.geometry,
            vncUser: form.vncUser,
        },
    };
}

export function SettingsTab({ config, save, onRefresh, backends }: SettingsTabProps) {
    const notify = useNotify();
    const [form, setForm] = useState<FormState>(() => fromConfig(config));
    const [errors, setErrors] = useState<Errors>({});
    const [saving, setSaving] = useState(false);
    const [passwordOpen, setPasswordOpen] = useState(false);

    /*
     * The VNC screen-share mode is GNOME's own setting, not part of the
     * plugin's config file, so it is held apart from the form: its starting
     * value comes from detection and it is written back to the host on save.
     */
    const detectedVncMode = backends?.find(b => b.id === "grd")?.vncScreenShareMode ?? null;
    const [vncMode, setVncMode] = useState<GrdVncScreenShareMode | null>(detectedVncMode);

    // Re-sync the form when the config changes elsewhere (backend selected on
    // the Dashboard, config loaded after mount).
    useEffect(() => {
        setForm(fromConfig(config));
        setErrors({});
    }, [config]);

    useEffect(() => {
        setVncMode(detectedVncMode);
    }, [detectedVncMode]);

    const set = (field: keyof FormState, value: string) => {
        setForm(prev => ({ ...prev, [field]: value }));
        setErrors(prev => ({ ...prev, [field]: undefined }));
    };

    const onBackendChange = (value: string) => {
        setForm(prev => {
            if (!value)
                return { ...prev, backend: "" };
            const def = backendDef(value as BackendId);
            const info = backends?.find(b => b.id === value);
            // A unit is kept only when it belongs to the selected backend —
            // carrying another backend's unit across yields a broken mix
            // (wrong systemd scope, wrong service).
            const unit = prev.unit && prev.unit.startsWith(def.unitPrefix)
                ? prev.unit
                : (info?.detectedUnit ?? def.defaultUnit);
            const mode = def.protocol === "rdp" ? prev.rdpMode : "screen-share";
            return {
                ...prev,
                backend: value,
                unit,
                port: String(portForMode(info, mode) ?? def.defaultPort),
            };
        });
        setErrors({});
    };

    const onModeChange = (value: string) => {
        const mode: GrdRdpMode = value === "remote-login" ? "remote-login" : "screen-share";
        setForm(prev => {
            const detected = portForMode(backends?.find(b => b.id === prev.backend), mode);
            return { ...prev, rdpMode: mode, port: detected ? String(detected) : prev.port };
        });
        setErrors(prev => ({ ...prev, port: undefined }));
    };

    const submit = async () => {
        const { errors: found, config: next } = validateForm(form);
        setErrors(found);
        if (!next) {
            notify("danger", _("Settings not saved"), _("Fix the highlighted fields first."));
            return;
        }
        setSaving(true);
        try {
            await save(next);
            // Only written when it actually changed, so saving an unrelated
            // field never reconfigures the desktop behind the user's back.
            if (vncMode && vncMode !== detectedVncMode) {
                try {
                    await setVncScreenShareMode(vncMode);
                } catch (err) {
                    notify("warning", _("Settings saved, but the VNC screen was left unchanged"),
                           toUserMessage(err));
                    return;
                }
                await onRefresh();
            }
            notify("success", _("Settings saved"));
        } catch (err) {
            notify("danger", _("Could not save settings"), toUserMessage(err));
        } finally {
            setSaving(false);
        }
    };

    const selectedDef = form.backend ? backendDef(form.backend as BackendId) : null;
    const canManagePassword = selectedDef?.supportsPasswordTool === true;
    const remoteLoginPort = backends?.find(b => b.id === form.backend)?.remoteLoginPort ?? null;
    const portNum = Number(form.port);
    const portAdvice = !errors.port && Number.isInteger(portNum)
        ? (selectedDef?.protocol === "rdp" && portNum !== DEFAULT_RDP_PORT
            ? format(_("RDP conventionally listens on port $0. Double-check this value."), DEFAULT_RDP_PORT)
            : portWarning(portNum))
        : null;
    const unitAdvice = !errors.unit && selectedDef && form.unit && !form.unit.startsWith(selectedDef.unitPrefix)
        ? format(_("This does not look like a $0 unit — its default is \"$1\"."), selectedDef.label, selectedDef.defaultUnit)
        : null;

    const helper = (field: keyof FormState, advice?: string | null) => {
        const message = errors[field] ?? advice;
        if (!message)
            return null;
        return (
            <FormHelperText>
                <HelperText>
                    <HelperTextItem variant={errors[field] ? "error" : "warning"}>{message}</HelperTextItem>
                </HelperText>
            </FormHelperText>
        );
    };

    return (
        <Card>
            <CardTitle>{_("Connection settings")}</CardTitle>
            <CardBody>
                <Form isHorizontal maxWidth="720px">
                    <FormGroup label={_("Remote desktop backend")} fieldId="ctr-backend">
                        <FormSelect id="ctr-backend" value={form.backend}
                                    onChange={(_event, value) => onBackendChange(value)}
                                    aria-label={_("Remote desktop backend")}>
                            <FormSelectOption value="" label={_("— none selected —")} />
                            {BACKENDS.map(def => {
                                const info = backends?.find(b => b.id === def.id);
                                const unusable = !def.manageable || info?.supported === false;
                                return (
                                    <FormSelectOption key={def.id} value={def.id}
                                                      label={unusable ? format(_("$0 (not usable on this host)"), def.label) : def.label}
                                                      isDisabled={unusable} />
                                );
                            })}
                        </FormSelect>
                        {selectedDef && (
                            <FormHelperText>
                                <HelperText>
                                    <HelperTextItem>{_(selectedDef.description)}</HelperTextItem>
                                </HelperText>
                            </FormHelperText>
                        )}
                    </FormGroup>

                    {selectedDef?.protocol === "rdp" && (
                        <FormGroup label={_("RDP session")} fieldId="ctr-rdp-mode">
                            <FormSelect id="ctr-rdp-mode" value={form.rdpMode}
                                        onChange={(_event, value) => onModeChange(value)}
                                        aria-label={_("RDP session")}>
                                <FormSelectOption value="screen-share"
                                                  label={_("Screen sharing — mirror the logged-in desktop")} />
                                <FormSelectOption value="remote-login"
                                                  label={remoteLoginPort
                                                      ? format(_("Remote Login — headless session (port $0)"), remoteLoginPort)
                                                      : _("Remote Login — headless session (not enabled on this host)")}
                                                  isDisabled={!remoteLoginPort} />
                            </FormSelect>
                            <FormHelperText>
                                <HelperText>
                                    <HelperTextItem>
                                        {form.rdpMode === "remote-login"
                                            ? _("A headless session adopts the resolution the browser asks for, so fullscreen fills the window exactly. You will not see what is on the physical screen.")
                                            : _("Mirrors the physical monitor at its own fixed resolution, so fullscreen can letterbox when the aspect ratios differ.")}
                                    </HelperTextItem>
                                </HelperText>
                            </FormHelperText>
                        </FormGroup>
                    )}

                    {selectedDef?.protocol === "vnc" && vncMode !== null && (
                        <FormGroup label={_("VNC session")} fieldId="ctr-vnc-share-mode">
                            <FormSelect id="ctr-vnc-share-mode" value={vncMode}
                                        onChange={(_event, value) =>
                                            setVncMode(value === "extend" ? "extend" : "mirror-primary")}
                                        aria-label={_("VNC session")}>
                                <FormSelectOption value="mirror-primary"
                                                  label={_("Screen sharing — mirror the logged-in desktop")} />
                                <FormSelectOption value="extend"
                                                  label={_("Virtual monitor — headless session")} />
                            </FormSelect>
                            <FormHelperText>
                                <HelperText>
                                    <HelperTextItem>
                                        {vncMode === "extend"
                                            ? _("VNC creates its own screen for the connection and follows the resolution the browser asks for, so fullscreen fills the window and no physical monitor is needed. You will not see what is on the physical screen.")
                                            : _("Records the primary monitor of the logged-in GNOME session at its own fixed resolution. With nobody logged in at a monitor there is nothing to record, and the connection is dropped right after authentication.")}
                                    </HelperTextItem>
                                    <HelperTextItem>
                                        {_("This is GNOME's own setting for this user, not a plugin preference. Saving applies it to the next connection; sessions already running keep the screen they started with.")}
                                    </HelperTextItem>
                                </HelperText>
                            </FormHelperText>
                        </FormGroup>
                    )}

                    <FormGroup label={_("systemd unit")} fieldId="ctr-unit">
                        <TextInput id="ctr-unit" value={form.unit}
                                   onChange={(_event, value) => set("unit", value)}
                                   validated={errors.unit ? "error" : "default"}
                                    placeholder="gnome-remote-desktop.service"
                                    aria-label={_("systemd unit")} />
                        {helper("unit", unitAdvice)}
                    </FormGroup>

                    <FormGroup label={_("Target address")} fieldId="ctr-address">
                        <TextInput id="ctr-address" value={form.address}
                                   onChange={(_event, value) => set("address", value)}
                                   validated={errors.address ? "error" : "default"}
                                   aria-label={_("Target address")} />
                        {helper("address", !errors.address && !isLoopback(form.address)
                            ? _("Non-loopback address: the VNC server should normally listen on 127.0.0.1 only, since Cockpit tunnels the traffic.")
                            : null)}
                    </FormGroup>

                    <FormGroup label={_("Target port")} fieldId="ctr-port">
                        <TextInput id="ctr-port" value={form.port} type="number"
                                   onChange={(_event, value) => set("port", value)}
                                   validated={errors.port ? "error" : "default"}
                                   aria-label={_("Target port")} />
                        {helper("port", portAdvice)}
                    </FormGroup>

                    {selectedDef?.id === "grd" && (
                        <Alert variant="info" isInline isPlain
                               title={_("GNOME VNC runs per user. Use password authentication for unattended Cockpit connections; prompt mode requires approval on the host desktop.")} />
                    )}

                    {selectedDef?.id === "grd-rdp" && (
                        <Alert variant="info" isInline isPlain
                               title={_("GNOME RDP uses guacd for the browser console. Install and start guacd on this host if the Dashboard reports the gateway is missing.")} />
                    )}

                    <ActionGroup>
                        <Button variant="primary" onClick={submit} isLoading={saving} isDisabled={saving}>
                            {_("Save settings")}
                        </Button>
                        {canManagePassword && (
                            <Button variant="secondary"
                                     onClick={() => setPasswordOpen(true)}>
                                {_("Set VNC password…")}
                            </Button>
                        )}
                    </ActionGroup>
                </Form>
                {canManagePassword && (
                    <PasswordModal
                        backend={selectedDef.id}
                        isOpen={passwordOpen}
                        onClose={() => setPasswordOpen(false)}
                        onUpdated={onRefresh}
                    />
                )}
            </CardBody>
        </Card>
    );
}
