import path from "node:path";

import ts from "typescript";

import { getObjectArgument, getStringArgument } from "./call-arguments.ts";
import { getExportedSpecCall } from "./spec-call.ts";
import { getCallName, resolveFunctionLike } from "./static-reference.ts";

export type PropertySource = {
    location: string;
    snippet: string;
};

function getBuilderArgument(specCall: ts.CallExpression): ts.Expression {
    const [, builder] = specCall.arguments;

    if (!builder) {
        throw new Error("spec() must receive a builder callback.");
    }

    return builder;
}

function getNamespace(specCall: ts.CallExpression): string | undefined {
    const [target] = specCall.arguments;

    if (target && ts.isIdentifier(target)) {
        return target.text;
    }

    return undefined;
}

function getBuilderFunction({
    checker,
    specCall,
}: {
    checker: ts.TypeChecker;
    specCall: ts.CallExpression;
}): ts.FunctionLikeDeclaration {
    const declaration = resolveFunctionLike(checker, getBuilderArgument(specCall));

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

function toEntryName(namespace: string | undefined, propertyName: string): string {
    if (namespace) {
        return `${namespace} / ${propertyName}`;
    }

    return propertyName;
}

function addPropertyEntry({
    entries,
    namespace,
    propertyName,
    locationNode,
    objectLiteral,
    sourceFile,
}: {
    entries: Record<string, PropertySource>;
    namespace: string | undefined;
    propertyName: string;
    locationNode: ts.Node;
    objectLiteral?: ts.ObjectLiteralExpression;
    sourceFile: ts.SourceFile;
}): void {
    entries[toEntryName(namespace, propertyName)] = {
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

function visitPropertyCall({
    call,
    checker,
    entries,
    namespace,
    sourceFile,
}: {
    call: ts.CallExpression;
    checker: ts.TypeChecker;
    entries: Record<string, PropertySource>;
    namespace: string | undefined;
    sourceFile: ts.SourceFile;
}): void {
    try {
        addPropertyEntry({
            entries,
            namespace,
            propertyName: getStringArgument({ call, checker, index: 0 }),
            locationNode: call,
            objectLiteral: getObjectArgument({ call, checker, index: 1 }),
            sourceFile,
        });
    } catch {}
}

export function getPropertySources(
    checker: ts.TypeChecker,
    sourceFile: ts.SourceFile,
): Record<string, PropertySource> {
    const entries: Record<string, PropertySource> = {};
    const specCall = getExportedSpecCall(sourceFile);
    const namespace = getNamespace(specCall);
    const statements = getBuilderStatements(getBuilderFunction({ checker, specCall }));

    for (const statement of statements) {
        const builderCall = getBuilderCall(statement);

        if (builderCall && builderCall.name === "property") {
            visitPropertyCall({
                call: builderCall.call,
                checker,
                entries,
                namespace,
                sourceFile,
            });
        }
    }

    return entries;
}
