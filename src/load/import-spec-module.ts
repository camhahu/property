import { pathToFileURL } from "node:url";

import { tsImport } from "tsx/esm/api";

import type { SpecDefinition } from "../public/spec.ts";

function isSpecDefinition(value: unknown): value is SpecDefinition<unknown, unknown> {
    return (
        Boolean(value) &&
        typeof value === "object" &&
        (value as { __brand?: string }).__brand === "property-spec"
    );
}

function getExportedSpec(moduleExports: Record<string, unknown>): SpecDefinition<unknown, unknown> {
    const definitions = Object.values(moduleExports).filter(isSpecDefinition);
    const [definition] = definitions;

    if (definitions.length !== 1 || !definition) {
        throw new Error("Spec modules must export exactly one property spec.");
    }

    return definition;
}

export async function importSpecModule(
    specFilePath: string,
): Promise<SpecDefinition<unknown, unknown>> {
    const moduleUrl = pathToFileURL(specFilePath).href;
    const imported = await tsImport(moduleUrl, import.meta.url);
    return getExportedSpec(imported as Record<string, unknown>);
}
