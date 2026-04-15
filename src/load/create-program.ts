import path from "node:path";

import ts from "typescript";

export function createProgram(entryFilePath: string): ts.Program {
    const configPath = ts.findConfigFile(
        path.dirname(entryFilePath),
        ts.sys.fileExists,
        "tsconfig.json",
    );

    if (!configPath) {
        throw new Error(`Could not find tsconfig.json for ${entryFilePath}`);
    }

    const configFile = ts.readConfigFile(configPath, ts.sys.readFile);

    if (configFile.error) {
        throw new Error(
            ts.formatDiagnosticsWithColorAndContext([configFile.error], {
                getCanonicalFileName: (fileName) => fileName,
                getCurrentDirectory: () => process.cwd(),
                getNewLine: () => "\n",
            }),
        );
    }

    const parsedConfig = ts.parseJsonConfigFileContent(
        configFile.config,
        ts.sys,
        path.dirname(configPath),
    );

    if (!parsedConfig.fileNames.includes(entryFilePath)) {
        parsedConfig.fileNames.push(entryFilePath);
    }

    return ts.createProgram({
        options: parsedConfig.options,
        rootNames: parsedConfig.fileNames,
    });
}
