import { asyncProperty, check } from "fast-check";

import { arbitraryForShape } from "../generate/arbitrary.ts";
import type { AnalyzedSpec } from "../load/analyze-spec-file.ts";
import type { Awaitable, CollectedLaw, SpecDefinition } from "../public/spec.ts";
import { asCheckDetails, getCounterexampleInput, getFailure } from "./check-details.ts";
import { executeLaw, getGiven } from "./law-execution.ts";
import type { LawResult, PropertySuiteResult } from "./types.ts";

export type { CallTrace, FailureDetails, LawResult, PropertySuiteResult } from "./types.ts";

type PropertySuiteRequest = {
    analyzedSpec: AnalyzedSpec;
    definition: SpecDefinition<unknown, unknown>;
    numRuns?: number;
    target?: (...inputs: unknown[]) => Awaitable<unknown>;
};

async function runLaw({
    analyzedSpec,
    law,
    numRuns,
    target,
}: {
    analyzedSpec: AnalyzedSpec;
    law: CollectedLaw<unknown, unknown>;
    numRuns: number;
    target: (...inputs: unknown[]) => Awaitable<unknown>;
}): Promise<LawResult> {
    const property = asyncProperty(arbitraryForShape(analyzedSpec.inputShape), async (input) => {
        await executeLaw({
            dependencyArgumentNames: analyzedSpec.dependencyArgumentNames,
            dependencyParameterName: analyzedSpec.dependencyParameterName,
            given: getGiven(law),
            input,
            law,
            target,
        });
    });
    const details = asCheckDetails(await check(property, { numRuns }));

    if (details.failed) {
        return {
            failure: getFailure(details, getCounterexampleInput(details)),
            lawName: law.name,
            passed: false,
            runs: details.numRuns,
        };
    }

    return { lawName: law.name, passed: true, runs: details.numRuns };
}

async function collectLawResults({
    analyzedSpec,
    definition,
    numRuns = 250,
    target,
}: PropertySuiteRequest): Promise<LawResult[]> {
    const resolvedTarget = target ?? definition.target;
    const lawResults: LawResult[] = [];

    for (const law of definition.laws) {
        lawResults.push(await runLaw({ analyzedSpec, law, numRuns, target: resolvedTarget }));
    }

    return lawResults;
}

function toPropertySuiteResult(lawResults: LawResult[]): PropertySuiteResult {
    const firstFailure = lawResults.find((lawResult) => !lawResult.passed);

    if (firstFailure) {
        return { firstFailure, lawResults, passed: false };
    }

    return { lawResults, passed: true };
}

export async function runPropertySuite(
    request: PropertySuiteRequest,
): Promise<PropertySuiteResult> {
    return toPropertySuiteResult(await collectLawResults(request));
}
