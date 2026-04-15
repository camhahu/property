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

export function getCounterexampleInput(details: CheckDetails): unknown {
    if (!details.failed || !details.counterexample) {
        return undefined;
    }

    const [input] = details.counterexample;
    return input;
}

function getFailureReason(details: CheckDetails): string {
    const error = "error" in details ? details.error : undefined;
    return error instanceof Error ? error.message : String(error ?? "Law failed.");
}

export function getFailure(details: CheckDetails, input: unknown): FailureDetails {
    return details.errorInstance instanceof Error && "details" in details.errorInstance
        ? (details.errorInstance.details as FailureDetails)
        : { calls: [], input, reason: getFailureReason(details) };
}
