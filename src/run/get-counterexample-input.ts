type CheckDetails = {
    counterexample?: unknown[] | null;
    failed: boolean;
};

export function getCounterexampleInput(details: CheckDetails): unknown {
    if (!details.failed || !details.counterexample) {
        return undefined;
    }

    const [input] = details.counterexample;
    return input;
}
