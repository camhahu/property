import { readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

type ImportTargetFunctionRequest = {
    exportName: string;
    id: string;
    sourceFilePath: string;
    sourceText?: string;
};

function getTempFilePath(sourceFilePath: string, id: string): string {
    return path.join(path.dirname(sourceFilePath), `.holds-${id}.ts`);
}

async function writeTargetModule({
    id,
    sourceFilePath,
    sourceText,
}: ImportTargetFunctionRequest): Promise<string> {
    const tempFilePath = getTempFilePath(sourceFilePath, id);
    const resolvedSourceText = sourceText ?? (await readFile(sourceFilePath, "utf8"));

    await writeFile(tempFilePath, resolvedSourceText, "utf8");
    return tempFilePath;
}

export async function importTargetFunction({
    exportName,
    id,
    sourceFilePath,
    sourceText,
}: ImportTargetFunctionRequest): Promise<(...inputs: unknown[]) => unknown> {
    const tempFilePath = await writeTargetModule({
        exportName,
        id,
        sourceFilePath,
        sourceText,
    });

    try {
        const imported = await import(`${pathToFileURL(tempFilePath).href}?t=${Date.now()}`);
        const exported = imported[exportName];

        if (typeof exported !== "function") {
            throw new TypeError(`Could not load function ${exportName} from ${tempFilePath}`);
        }

        return exported as (...inputs: unknown[]) => unknown;
    } finally {
        await rm(tempFilePath, { force: true });
    }
}
