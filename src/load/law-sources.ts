import path from "node:path";

import ts from "typescript";

import { getCallbackArgument, getObjectArgument, getStringArgument } from "./call-arguments.ts";
import { getExportedSpecCall } from "./spec-call.ts";
import { getCallName, resolveFunctionLike } from "./static-reference.ts";

export type LawSource = {
    location: string;
    snippet: string;
};

function getBuilderFunction({
    checker,
    specCall,
}: {
    checker: ts.TypeChecker;
    specCall: ts.CallExpression;
}): ts.FunctionLikeDeclaration {
    const [, builder] = specCall.arguments;

    if (!builder) {
        throw new Error("spec() must receive a builder callback as its second argument.");
    }

    const declaration = resolveFunctionLike(checker, builder);

    if (!declaration) {
        throw new Error("spec() must receive a statically analyzable builder callback.");
    }

    return declaration;
}

function getBuilderStatements(builder: ts.FunctionLikeDeclaration): ts.Statement[] {
    if (!builder.body || !ts.isBlock(builder.body)) {
        throw new Error("spec() builder callbacks must use a block body.");
    }

    return [...builder.body.statements];
}

function getLocation(sourceFile: ts.SourceFile, node: ts.Node): string {
    const position = node.getStart(sourceFile);
    const { character, line } = sourceFile.getLineAndCharacterOfPosition(position);
    return `${path.relative(process.cwd(), sourceFile.fileName)}:${line + 1}:${character + 1}`;
}

function getEntryName(groups: string[], lawName: string): string {
    if (groups.length > 0) {
        return `${groups.join(" / ")} / ${lawName}`;
    }

    return lawName;
}

function addLawEntry({
    entries,
    groups,
    lawName,
    locationNode,
    objectLiteral,
    sourceFile,
}: {
    entries: Record<string, LawSource>;
    groups: string[];
    lawName: string;
    locationNode: ts.Node;
    objectLiteral?: ts.ObjectLiteralExpression;
    sourceFile: ts.SourceFile;
}): void {
    entries[getEntryName(groups, lawName)] = {
        location: getLocation(sourceFile, objectLiteral ?? locationNode),
        snippet: objectLiteral?.getText(sourceFile) ?? "",
    };
}

function getBuilderCall(
    statement: ts.Statement,
): { call: ts.CallExpression; name: string } | undefined {
    if (!ts.isExpressionStatement(statement) || !ts.isCallExpression(statement.expression)) {
        return undefined;
    }

    const name = getCallName(statement.expression.expression);

    if (name) {
        return { call: statement.expression, name };
    }

    return undefined;
}

function visitLawCall({
    call,
    checker,
    entries,
    groups,
    sourceFile,
}: {
    call: ts.CallExpression;
    checker: ts.TypeChecker;
    entries: Record<string, LawSource>;
    groups: string[];
    sourceFile: ts.SourceFile;
}): void {
    addLawEntry({
        entries,
        groups,
        lawName: getStringArgument({ call, checker, index: 0 }),
        locationNode: call,
        objectLiteral: getObjectArgument({ call, checker, index: 1 }),
        sourceFile,
    });
}

function visitSectionCall({
    call,
    checker,
    entries,
    groups,
    sourceFile,
}: {
    call: ts.CallExpression;
    checker: ts.TypeChecker;
    entries: Record<string, LawSource>;
    groups: string[];
    sourceFile: ts.SourceFile;
}): void {
    walkBuilderStatements({
        checker,
        entries,
        groups: [...groups, getStringArgument({ call, checker, index: 0 })],
        sourceFile,
        statements: getBuilderStatements(getCallbackArgument({ call, checker, index: 1 })),
    });
}

function visitBuilderCall({
    call,
    checker,
    entries,
    groups,
    name,
    sourceFile,
}: {
    call: ts.CallExpression;
    checker: ts.TypeChecker;
    entries: Record<string, LawSource>;
    groups: string[];
    name: string;
    sourceFile: ts.SourceFile;
}): void {
    try {
        if (name === "law") {
            visitLawCall({ call, checker, entries, groups, sourceFile });
        }

        if (name === "section") {
            visitSectionCall({ call, checker, entries, groups, sourceFile });
        }
    } catch {}
}

function walkBuilderStatements({
    checker,
    entries,
    groups,
    sourceFile,
    statements,
}: {
    checker: ts.TypeChecker;
    entries: Record<string, LawSource>;
    groups: string[];
    sourceFile: ts.SourceFile;
    statements: ts.Statement[];
}): void {
    for (const statement of statements) {
        const builderCall = getBuilderCall(statement);

        if (!builderCall) {
            continue;
        }

        visitBuilderCall({ ...builderCall, checker, entries, groups, sourceFile });
    }
}

export function getLawSources(
    checker: ts.TypeChecker,
    sourceFile: ts.SourceFile,
): Record<string, LawSource> {
    const entries: Record<string, LawSource> = {};

    walkBuilderStatements({
        checker,
        entries,
        groups: [],
        sourceFile,
        statements: getBuilderStatements(
            getBuilderFunction({ checker, specCall: getExportedSpecCall(sourceFile) }),
        ),
    });

    return entries;
}
