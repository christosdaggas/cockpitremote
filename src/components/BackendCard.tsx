import {
    Button,
    DescriptionList,
    DescriptionListDescription,
    DescriptionListGroup,
    DescriptionListTerm,
    Label,
} from "@patternfly/react-core";

import { backendDef } from "../constants";
import { _ } from "../i18n";
import type { BackendInfo } from "../types";
import { ActiveLabel, EnabledLabel } from "./common/StatusLabel";
import { ServiceActions } from "./ServiceActions";

export interface BackendCardProps {
    backend: BackendInfo;
    isSelected: boolean;
    /** Unit the plugin is configured to manage when this backend is selected. */
    activeUnit: string | null;
    onSelect: (backend: BackendInfo) => Promise<void>;
    onRefresh: () => Promise<void>;
}

export function BackendCard({ backend, isSelected, activeUnit, onSelect, onRefresh }: BackendCardProps) {
    const def = backendDef(backend.id);
    const installed = backend.binaryPath !== null;
    const unit = (isSelected && activeUnit) || backend.detectedUnit;
    const port = backend.detectedPort ?? backend.defaultPort;

    return (
        <section className={`ctr-backend-card${isSelected ? " ctr-backend-card-selected" : ""}`}>
            <div className="ctr-backend-card-body">
                <div className="ctr-backend-card-heading">
                    <div>
                        <h3 className="ctr-backend-card-title">{backend.label}</h3>
                        <p className="ctr-backend-card-summary">{_(def.description)}</p>
                    </div>
                    {isSelected && <Label color="purple">{_("Selected")}</Label>}
                </div>

                <div className="ctr-backend-labels">
                    <Label color={backend.protocol === "rdp" ? "orange" : "cyan"}>{backend.protocol.toUpperCase()}</Label>
                    {installed
                        ? <Label color="blue">{_("installed")}{backend.version ? ` ${backend.version}` : ""}</Label>
                        : <Label color="grey">{_("not installed")}</Label>}
                    {installed && <ActiveLabel status={backend.status} />}
                    {installed && <EnabledLabel status={backend.status} />}
                    {!backend.supported && <Label color="gold">{_("not supported")}</Label>}
                </div>

                <DescriptionList isCompact isHorizontal className="ctr-backend-details">
                    <DescriptionListGroup>
                        <DescriptionListTerm>{_("Binary")}</DescriptionListTerm>
                        <DescriptionListDescription id={`${backend.id}-binary`}>
                            {backend.binaryPath ?? _("Not found")}
                        </DescriptionListDescription>
                    </DescriptionListGroup>
                    {unit && (
                        <DescriptionListGroup>
                            <DescriptionListTerm>{_("Unit")}</DescriptionListTerm>
                            <DescriptionListDescription id={`${backend.id}-unit`}>
                                {unit}{backend.unitScope === "user" ? ` ${_("(user service)")}` : ""}
                            </DescriptionListDescription>
                        </DescriptionListGroup>
                    )}
                    {installed && (
                        <DescriptionListGroup>
                            <DescriptionListTerm>{_("Port")}</DescriptionListTerm>
                            <DescriptionListDescription id={`${backend.id}-port`}>
                                {port}
                            </DescriptionListDescription>
                        </DescriptionListGroup>
                    )}
                    {backend.vncScreenShareMode && (
                        <DescriptionListGroup>
                            <DescriptionListTerm>{_("Screen")}</DescriptionListTerm>
                            <DescriptionListDescription id={`${backend.id}-screen`}>
                                {backend.vncScreenShareMode === "extend"
                                    ? _("Virtual monitor (headless)")
                                    : _("Mirrors the logged-in desktop")}
                            </DescriptionListDescription>
                        </DescriptionListGroup>
                    )}
                </DescriptionList>

                {backend.notes.length > 0 && (
                    <div className="ctr-backend-notes">
                        {backend.notes.map((note, i) => <p key={i}>{note}</p>)}
                    </div>
                )}
            </div>

            <div className="ctr-backend-card-footer">
                {installed && unit && backend.supported && isSelected && (
                    <ServiceActions unit={unit} scope={backend.unitScope}
                                    status={backend.status} onRefresh={onRefresh} />
                )}
                {installed && backend.supported && !isSelected && (
                    <Button variant="secondary" size="sm" onClick={() => onSelect(backend)}>
                        {_("Use this backend")}
                    </Button>
                )}
                {!installed && <span className="ctr-backend-card-hint">{_("Install this backend on the host.")}</span>}
            </div>
        </section>
    );
}
