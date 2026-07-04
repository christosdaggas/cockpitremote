import { Bullseye, Spinner } from "@patternfly/react-core";

export function Loading({ text }: { text?: string }) {
    return (
        <Bullseye className="ctr-loading">
            <Spinner size="xl" aria-label={text ?? "Loading"} />
            {text && <span className="ctr-loading-text">{text}</span>}
        </Bullseye>
    );
}
