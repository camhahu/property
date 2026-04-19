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

export type PropertyResult = {
    failure?: FailureDetails;
    propertyName: string;
    passed: boolean;
    runs: number;
};

export type PropertySuiteResult = {
    firstFailure?: PropertyResult;
    propertyResults: PropertyResult[];
    passed: boolean;
};
