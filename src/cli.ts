#!/usr/bin/env bun

import path from "node:path";

import { analyzeSpecFile } from "./load/analyze-spec-file.ts";
import { importSpecModule } from "./load/import-spec-module.ts";
import { runMutants } from "./mutate/run-mutants.ts";
import { renderMutationReport, renderPropertyReport } from "./report/text.ts";
import { runPropertySuite } from "./run/properties.ts";

function usage(): never {
    console.error("Usage: holds run <spec-file>");
    process.exit(1);
    throw new Error("unreachable");
}

async function run(specFilePath: string): Promise<void> {
    const analyzedSpec = analyzeSpecFile(specFilePath);
    const definition = await importSpecModule(specFilePath);
    const propertyResult = await runPropertySuite({ analyzedSpec, definition });

    console.log(
        renderPropertyReport({
            inputName: analyzedSpec.inputName,
            lawSources: analyzedSpec.lawSources,
            result: propertyResult,
            specFilePath: analyzedSpec.specFilePath,
            targetName: analyzedSpec.targetName,
        }),
    );

    if (!propertyResult.passed) {
        process.exitCode = 1;
        return;
    }

    const mutationResults = await runMutants(analyzedSpec, definition);

    console.log(renderMutationReport(mutationResults));

    if (mutationResults.some((result) => !result.killed)) {
        process.exitCode = 1;
    }
}

const command = process.argv[2];
const specFilePath = process.argv[3];

if (command !== "run" || specFilePath === undefined) {
    usage();
}

await run(path.resolve(specFilePath));
