import { getCounterexampleInput } from "./get-counterexample-input.ts";
import type { FailureDetails } from "./types.ts";

export { getCounterexampleInput } from "./get-counterexample-input.ts";

type CheckDetails = {
    counterexample?: unknown[] | null;
    errorInstance?: unknown;
    failed: boolean;
    numRuns: number;
} & Record<string, unknown>;

export function asCheckDetails(value: unknown): CheckDetails {
    return value as CheckDetails;
}

function getFailureReason(details: CheckDetails): string {
    let error: unknown;

    if ("error" in details) {
        error = details.error;
    }

    if (error instanceof Error) {
        return error.message;
    }

    return String(error ?? "Law failed.");
}

export function getFailure(details: CheckDetails, input: unknown): FailureDetails {
    if (details.errorInstance instanceof Error && "details" in details.errorInstance) {
        return details.errorInstance.details as FailureDetails;
    }

    return { calls: [], input, reason: getFailureReason(details) };
}
