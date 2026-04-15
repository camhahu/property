export type CallTrace = {
    error?: string;
    inputs: unknown[];
    kind: "generated" | "run";
    result?: unknown;
};

export type FailureDetails = {
    calls: CallTrace[];
    inputs: unknown[];
    reason: string;
    result?: unknown;
};

export type LawResult = {
    failure?: FailureDetails;
    lawName: string;
    passed: boolean;
    runs: number;
};

export type PropertySuiteResult = {
    firstFailure?: LawResult;
    lawResults: LawResult[];
    passed: boolean;
};
