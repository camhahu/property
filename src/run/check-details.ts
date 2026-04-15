import type { FailureDetails } from "./types.ts";

type CheckDetails = {
    counterexample?: unknown[] | null;
    errorInstance?: unknown;
    failed: boolean;
    numRuns: number;
} & Record<string, unknown>;

export function asCheckDetails(value: unknown): CheckDetails {
    return value as CheckDetails;
}

export function getCounterexampleInputs(details: CheckDetails): unknown[] {
    if (!details.failed || !details.counterexample) {
        return [];
    }

    const [inputs] = details.counterexample;
    return Array.isArray(inputs) ? inputs : [];
}

function getFailureReason(details: CheckDetails): string {
    const error = "error" in details ? details.error : undefined;

    return error instanceof Error ? error.message : String(error ?? "Law failed.");
}

export function getFailure(details: CheckDetails, inputs: unknown[]): FailureDetails {
    return details.errorInstance instanceof Error && "details" in details.errorInstance
        ? (details.errorInstance.details as FailureDetails)
        : { calls: [], inputs, reason: getFailureReason(details) };
}
