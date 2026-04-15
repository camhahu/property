import { asyncProperty, check, tuple } from "fast-check";

import { arbitraryForShape } from "../generate/arbitrary.ts";
import type { AnalyzedSpec } from "../load/analyze-spec-file.ts";
import type { Awaitable, LawDefinition, SpecDefinition, StructuredLaw } from "../public/spec.ts";
import { asCheckDetails, getCounterexampleInputs, getFailure } from "./check-details.ts";
import { executeLaw, getGiven } from "./law-execution.ts";
import type { LawResult, PropertySuiteResult } from "./types.ts";

export type { CallTrace, FailureDetails, LawResult, PropertySuiteResult } from "./types.ts";

type PropertySuiteRequest = {
    analyzedSpec: AnalyzedSpec;
    definition: SpecDefinition<unknown[], unknown>;
    numRuns?: number;
    target?: (...inputs: unknown[]) => Awaitable<unknown>;
};

type RunLawRequest = {
    analyzedSpec: AnalyzedSpec;
    law: LawDefinition<unknown[], unknown>;
    lawName: string;
    numRuns: number;
    parameterArbitraries: ReturnType<typeof arbitraryForShape>[];
    target: (...inputs: unknown[]) => Awaitable<unknown>;
};

function isStructuredLaw(
    law: LawDefinition<unknown[], unknown>,
): law is StructuredLaw<unknown[], unknown> {
    return typeof law !== "function";
}

function getSampleInputs(
    analyzedSpec: AnalyzedSpec,
    law: LawDefinition<unknown[], unknown>,
): unknown[] | undefined {
    if (!isStructuredLaw(law) || law.sample === undefined) {
        return undefined;
    }

    return analyzedSpec.parameterShapes.length === 1 ? [law.sample] : undefined;
}

function getInputNames(analyzedSpec: AnalyzedSpec): string[] {
    return analyzedSpec.parameterShapes.map((parameter) => parameter.name);
}

function getExecutionConfig({
    analyzedSpec,
    law,
    target,
}: {
    analyzedSpec: AnalyzedSpec;
    law: LawDefinition<unknown[], unknown>;
    target: (...inputs: unknown[]) => Awaitable<unknown>;
}) {
    return {
        dependencyArgumentNames: analyzedSpec.dependencyArgumentNames,
        dependencyParameterName: analyzedSpec.dependencyParameterName,
        given: getGiven(law),
        inputNames: getInputNames(analyzedSpec),
        law,
        target,
    };
}

function toSampleFailure(error: unknown) {
    return error instanceof Error && "details" in error
        ? (error.details as import("./types.ts").FailureDetails)
        : undefined;
}

async function runSampleLaw({
    analyzedSpec,
    law,
    lawName,
    target,
}: Pick<RunLawRequest, "analyzedSpec" | "law" | "lawName" | "target">): Promise<LawResult> {
    const sampleInputs = getSampleInputs(analyzedSpec, law);

    if (!sampleInputs) {
        throw new Error("sample is only supported for single-input functions.");
    }

    try {
        await executeLaw({
            ...getExecutionConfig({ analyzedSpec, law, target }),
            inputs: sampleInputs,
        });

        return { lawName, passed: true, runs: 1 };
    } catch (error) {
        return { failure: toSampleFailure(error), lawName, passed: false, runs: 1 };
    }
}

async function runPropertyLaw({
    analyzedSpec,
    law,
    lawName,
    numRuns,
    parameterArbitraries,
    target,
}: RunLawRequest): Promise<LawResult> {
    const property = asyncProperty(tuple(...parameterArbitraries), async (inputs) => {
        await executeLaw({ ...getExecutionConfig({ analyzedSpec, law, target }), inputs });
    });
    const details = asCheckDetails(await check(property, { numRuns }));

    if (!details.failed) {
        return { lawName, passed: true, runs: details.numRuns };
    }

    const inputs = getCounterexampleInputs(details);

    return {
        failure: getFailure(details, inputs),
        lawName,
        passed: false,
        runs: details.numRuns,
    };
}

function runLaw({
    analyzedSpec,
    law,
    lawName,
    numRuns,
    parameterArbitraries,
    target,
}: RunLawRequest): Promise<LawResult> {
    const sampleInputs = getSampleInputs(analyzedSpec, law);

    if (sampleInputs) {
        return runSampleLaw({ analyzedSpec, law, lawName, target });
    }

    return runPropertyLaw({
        analyzedSpec,
        law,
        lawName,
        numRuns,
        parameterArbitraries,
        target,
    });
}

function getParameterArbitraries(
    analyzedSpec: AnalyzedSpec,
): ReturnType<typeof arbitraryForShape>[] {
    return analyzedSpec.parameterShapes.map(({ shape }) => arbitraryForShape(shape));
}

async function collectLawResults({
    analyzedSpec,
    definition,
    numRuns = 250,
    target,
}: PropertySuiteRequest): Promise<LawResult[]> {
    const parameterArbitraries = getParameterArbitraries(analyzedSpec);
    const resolvedTarget = target ?? definition.target;
    const lawResults: LawResult[] = [];

    for (const [lawName, law] of Object.entries(definition.laws)) {
        lawResults.push(
            await runLaw({
                analyzedSpec,
                law,
                lawName,
                numRuns,
                parameterArbitraries,
                target: resolvedTarget,
            }),
        );
    }

    return lawResults;
}

function toPropertySuiteResult(lawResults: LawResult[]): PropertySuiteResult {
    const firstFailure = lawResults.find((lawResult) => !lawResult.passed);

    return firstFailure
        ? { firstFailure, lawResults, passed: false }
        : { lawResults, passed: true };
}

export function runPropertySuite(request: PropertySuiteRequest): Promise<PropertySuiteResult> {
    return collectLawResults(request).then(toPropertySuiteResult);
}
