export type CallTrace = {
    error?: string;
    input: unknown;
    result?: unknown;
};

export type FailureDetails = {
    calls: CallTrace[];
    input: unknown;
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
