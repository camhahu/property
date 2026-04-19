import { asyncProperty, check } from "fast-check";

import { arbitraryForShape } from "../generate/arbitrary.ts";
import type { AnalyzedSpec } from "../load/analyze-spec-file.ts";
import type { Awaitable, CollectedProperty, SpecDefinition } from "../public/spec.ts";
import { asCheckDetails, getCounterexampleInput, getFailure } from "./check-details.ts";
import { executeProperty, getGiven } from "./property-execution.ts";
import type { PropertyResult, PropertySuiteResult } from "./types.ts";

export type { CallTrace, FailureDetails, PropertyResult, PropertySuiteResult } from "./types.ts";

type PropertySuiteRequest = {
    analyzedSpec: AnalyzedSpec;
    definition: SpecDefinition<unknown, unknown>;
    numRuns?: number;
    target?: (...inputs: unknown[]) => Awaitable<unknown>;
};

async function runProperty({
    analyzedSpec,
    property,
    numRuns,
    target,
}: {
    analyzedSpec: AnalyzedSpec;
    property: CollectedProperty<unknown, unknown>;
    numRuns: number;
    target: (...inputs: unknown[]) => Awaitable<unknown>;
}): Promise<PropertyResult> {
    const fastCheckProperty = asyncProperty(
        arbitraryForShape(analyzedSpec.inputShape),
        async (input) => {
            await executeProperty({
                dependencyArgumentNames: analyzedSpec.dependencyArgumentNames,
                dependencyParameterName: analyzedSpec.dependencyParameterName,
                given: getGiven(property),
                input,
                property,
                target,
            });
        },
    );
    const details = asCheckDetails(await check(fastCheckProperty, { numRuns }));

    if (details.failed) {
        return {
            failure: getFailure(details, getCounterexampleInput(details)),
            propertyName: property.name,
            passed: false,
            runs: details.numRuns,
        };
    }

    return { propertyName: property.name, passed: true, runs: details.numRuns };
}

async function collectPropertyResults({
    analyzedSpec,
    definition,
    numRuns = 250,
    target,
}: PropertySuiteRequest): Promise<PropertyResult[]> {
    const resolvedTarget = target ?? definition.target;
    const propertyResults: PropertyResult[] = [];

    for (const property of definition.properties) {
        propertyResults.push(
            await runProperty({ analyzedSpec, property, numRuns, target: resolvedTarget }),
        );
    }

    return propertyResults;
}

function toPropertySuiteResult(propertyResults: PropertyResult[]): PropertySuiteResult {
    const firstFailure = propertyResults.find((propertyResult) => !propertyResult.passed);

    if (firstFailure) {
        return { firstFailure, propertyResults, passed: false };
    }

    return { propertyResults, passed: true };
}

export async function runPropertySuite(
    request: PropertySuiteRequest,
): Promise<PropertySuiteResult> {
    return toPropertySuiteResult(await collectPropertyResults(request));
}
