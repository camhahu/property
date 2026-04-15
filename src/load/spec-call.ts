import path from "node:path";

import ts from "typescript";

export type LawSource = {
    location: string;
    snippet: string;
};

type ArgumentDescriptor = {
    index: number;
    label: string;
};

type BuilderCall = {
    call: ts.CallExpression;
    name: string;
};

function isExported(statement: ts.VariableStatement): boolean {
    return Boolean(
        statement.modifiers?.some((modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword),
    );
}

function isSpecCallOrUndefined(
    expression: ts.Expression | undefined,
): expression is ts.CallExpression {
    return expression !== undefined && isSpecCallExpression(expression);
}

function isSpecCallExpression(expression: ts.Expression): expression is ts.CallExpression {
    return (
        ts.isCallExpression(expression) &&
        ts.isIdentifier(expression.expression) &&
        expression.expression.text === "spec"
    );
}

function getSpecCallFromVariable(statement: ts.VariableStatement): ts.CallExpression | undefined {
    if (!isExported(statement)) {
        return undefined;
    }

    return statement.declarationList.declarations
        .map((declaration) => declaration.initializer)
        .find(isSpecCallOrUndefined);
}

function getBuilderFunction(specCall: ts.CallExpression): ts.FunctionLikeDeclaration {
    const [, builder] = specCall.arguments;

    if (!builder || (!ts.isArrowFunction(builder) && !ts.isFunctionExpression(builder))) {
        throw new Error("spec() must receive a builder callback as its second argument.");
    }

    return builder;
}

function getBuilderStatements(builder: ts.FunctionLikeDeclaration): ts.Statement[] {
    if (!builder.body || !ts.isBlock(builder.body)) {
        throw new Error("spec() builder callbacks must use a block body.");
    }

    return [...builder.body.statements];
}

function getStringArgument(call: ts.CallExpression, descriptor: ArgumentDescriptor): string {
    const argument = call.arguments[descriptor.index];

    if (!argument || !ts.isStringLiteral(argument)) {
        throw new Error(`${descriptor.label} must be a string literal.`);
    }

    return argument.text;
}

function getObjectArgument(
    call: ts.CallExpression,
    descriptor: ArgumentDescriptor,
): ts.ObjectLiteralExpression {
    const argument = call.arguments[descriptor.index];

    if (!argument || !ts.isObjectLiteralExpression(argument)) {
        throw new Error(`${descriptor.label} must be an object literal.`);
    }

    return argument;
}

function getCallbackArgument(call: ts.CallExpression, index: number): ts.FunctionLikeDeclaration {
    const argument = call.arguments[index];

    if (!argument || (!ts.isArrowFunction(argument) && !ts.isFunctionExpression(argument))) {
        throw new Error("section() must receive a callback.");
    }

    return argument;
}

function addLawEntry({
    entries,
    groups,
    objectLiteral,
    sourceFile,
    lawName,
}: {
    entries: Record<string, LawSource>;
    groups: string[];
    objectLiteral: ts.ObjectLiteralExpression;
    sourceFile: ts.SourceFile;
    lawName: string;
}): void {
    const { character, line } = sourceFile.getLineAndCharacterOfPosition(
        objectLiteral.getStart(sourceFile),
    );
    const fullName = groups.length > 0 ? `${groups.join(" / ")} / ${lawName}` : lawName;

    entries[fullName] = {
        location: `${path.relative(process.cwd(), sourceFile.fileName)}:${line + 1}:${character + 1}`,
        snippet: objectLiteral.getText(sourceFile),
    };
}

function getBuilderCall(statement: ts.Statement): BuilderCall | undefined {
    if (!ts.isExpressionStatement(statement) || !ts.isCallExpression(statement.expression)) {
        return undefined;
    }

    return ts.isIdentifier(statement.expression.expression)
        ? { call: statement.expression, name: statement.expression.expression.text }
        : undefined;
}

function visitBuilderCall({
    call,
    entries,
    groups,
    name,
    sourceFile,
}: {
    call: ts.CallExpression;
    entries: Record<string, LawSource>;
    groups: string[];
    name: string;
    sourceFile: ts.SourceFile;
}): void {
    if (name === "law") {
        addLawEntry({
            entries,
            groups,
            objectLiteral: getObjectArgument(call, { index: 1, label: "law definition" }),
            sourceFile,
            lawName: getStringArgument(call, { index: 0, label: "law name" }),
        });
        return;
    }

    if (name !== "section") {
        return;
    }

    walkBuilderStatements({
        entries,
        groups: [...groups, getStringArgument(call, { index: 0, label: "section name" })],
        sourceFile,
        statements: getBuilderStatements(getCallbackArgument(call, 1)),
    });
}

function walkBuilderStatements({
    entries,
    groups,
    sourceFile,
    statements,
}: {
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

        visitBuilderCall({ ...builderCall, entries, groups, sourceFile });
    }
}

export function getExportedSpecCall(sourceFile: ts.SourceFile): ts.CallExpression {
    const exportAssignment = sourceFile.statements
        .filter(ts.isExportAssignment)
        .map((statement) => statement.expression)
        .find(isSpecCallExpression);

    if (exportAssignment) {
        return exportAssignment;
    }

    const exportedVariable = sourceFile.statements
        .filter(ts.isVariableStatement)
        .map(getSpecCallFromVariable)
        .find((call): call is ts.CallExpression => call !== undefined);

    if (exportedVariable) {
        return exportedVariable;
    }

    throw new Error(`No exported spec(...) call found in ${sourceFile.fileName}`);
}

function getTargetExpression(sourceFile: ts.SourceFile): ts.Identifier {
    const [targetExpression] = getExportedSpecCall(sourceFile).arguments;

    if (!targetExpression || !ts.isIdentifier(targetExpression)) {
        throw new Error("spec() must receive a direct function identifier as its first argument.");
    }

    return targetExpression;
}

export function getTargetSymbol(checker: ts.TypeChecker, sourceFile: ts.SourceFile): ts.Symbol {
    const targetExpression = getTargetExpression(sourceFile);
    const symbol = checker.getSymbolAtLocation(targetExpression);

    if (!symbol) {
        throw new Error(`Could not resolve ${targetExpression.text} from ${sourceFile.fileName}`);
    }

    return symbol.flags & ts.SymbolFlags.Alias ? checker.getAliasedSymbol(symbol) : symbol;
}

export function getLawSources(sourceFile: ts.SourceFile): Record<string, LawSource> {
    const entries: Record<string, LawSource> = {};

    walkBuilderStatements({
        entries,
        groups: [],
        sourceFile,
        statements: getBuilderStatements(getBuilderFunction(getExportedSpecCall(sourceFile))),
    });

    return entries;
}
