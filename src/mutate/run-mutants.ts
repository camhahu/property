import { readFile } from "node:fs/promises";

import ts from "typescript";

import type { AnalyzedSpec } from "../load/analyze-spec-file.ts";
import type { SpecDefinition } from "../public/spec.ts";
import { runPropertySuite } from "../run/properties.ts";
import { importTargetFunction } from "../runtime/import-target-function.ts";
import { applyMutation, createCandidates, type MutationCandidate } from "./candidates.ts";

type MutationRunRequest = {
    analyzedSpec: AnalyzedSpec;
    candidate: MutationCandidate;
    definition: SpecDefinition<unknown[], unknown>;
    id: string;
    sourceText: string;
};

type MutationState = {
    candidates: MutationCandidate[];
    sourceText: string;
};

export type MutationResult = {
    description: string;
    id: string;
    killed: boolean;
    killedBy?: string;
};

async function loadMutationState(analyzedSpec: AnalyzedSpec): Promise<MutationState> {
    const sourceText = await readFile(analyzedSpec.targetFilePath, "utf8");
    const sourceFile = ts.createSourceFile(
        analyzedSpec.targetFilePath,
        sourceText,
        ts.ScriptTarget.Latest,
        true,
        ts.ScriptKind.TS,
    );

    return {
        candidates: createCandidates(sourceFile, analyzedSpec.targetName),
        sourceText,
    };
}

async function runMutantCandidate({
    analyzedSpec,
    candidate,
    definition,
    id,
    sourceText,
}: MutationRunRequest): Promise<MutationResult> {
    const mutatedTarget = await importTargetFunction({
        exportName: analyzedSpec.targetName,
        id,
        sourceFilePath: analyzedSpec.targetFilePath,
        sourceText: applyMutation(sourceText, candidate),
    });
    const propertyResult = await runPropertySuite({
        analyzedSpec,
        definition,
        numRuns: 100,
        target: mutatedTarget,
    });

    return {
        description: candidate.description,
        id,
        killed: !propertyResult.passed,
        killedBy: propertyResult.firstFailure?.lawName,
    };
}

export async function runMutants(
    analyzedSpec: AnalyzedSpec,
    definition: SpecDefinition<unknown[], unknown>,
): Promise<MutationResult[]> {
    const { candidates, sourceText } = await loadMutationState(analyzedSpec);
    const results: MutationResult[] = [];

    for (const [index, candidate] of candidates.entries()) {
        results.push(
            await runMutantCandidate({
                analyzedSpec,
                candidate,
                definition,
                id: `mutant-${index + 1}`,
                sourceText,
            }),
        );
    }

    return results;
}
