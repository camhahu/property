import { pathToFileURL } from "node:url";

import type { SpecDefinition } from "../public/spec.ts";

function isSpecDefinition(value: unknown): value is SpecDefinition<unknown, unknown> {
    return (
        Boolean(value) &&
        typeof value === "object" &&
        (value as { __brand?: string }).__brand === "holds-spec"
    );
}

function getExportedSpec(moduleExports: Record<string, unknown>): SpecDefinition<unknown, unknown> {
    const definitions = Object.values(moduleExports).filter(isSpecDefinition);
    const [definition] = definitions;

    if (definitions.length !== 1 || !definition) {
        throw new Error("Spec modules must export exactly one holds spec.");
    }

    return definition;
}

export async function importSpecModule(
    specFilePath: string,
): Promise<SpecDefinition<unknown, unknown>> {
    const moduleUrl = pathToFileURL(specFilePath).href;
    const imported = await import(`${moduleUrl}?t=${Date.now()}`);
    return getExportedSpec(imported as Record<string, unknown>);
}
