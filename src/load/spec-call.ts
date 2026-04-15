import path from "node:path";

import ts from "typescript";

export type LawSource = {
    location: string;
    snippet: string;
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

function getPropertyName(propertyName: ts.PropertyName): string {
    if (ts.isIdentifier(propertyName) || ts.isStringLiteral(propertyName)) {
        return propertyName.text;
    }

    throw new Error("Only identifier and string literal law names are supported.");
}

function getTargetExpression(specCall: ts.CallExpression): ts.Identifier {
    const [targetExpression] = specCall.arguments;

    if (!targetExpression || !ts.isIdentifier(targetExpression)) {
        throw new Error("spec() must receive a direct function identifier as its first argument.");
    }

    return targetExpression;
}

function getLawObject(specCall: ts.CallExpression): ts.ObjectLiteralExpression {
    const [, lawObject] = specCall.arguments;

    if (!lawObject || !ts.isObjectLiteralExpression(lawObject)) {
        throw new Error("spec() must receive a law object as its second argument.");
    }

    return lawObject;
}

export function getTargetSymbol(checker: ts.TypeChecker, sourceFile: ts.SourceFile): ts.Symbol {
    const targetExpression = getTargetExpression(getExportedSpecCall(sourceFile));
    const symbol = checker.getSymbolAtLocation(targetExpression);

    if (!symbol) {
        throw new Error(`Could not resolve ${targetExpression.text} from ${sourceFile.fileName}`);
    }

    return symbol.flags & ts.SymbolFlags.Alias ? checker.getAliasedSymbol(symbol) : symbol;
}

export function getLawSources(sourceFile: ts.SourceFile): Record<string, LawSource> {
    const lawObject = getLawObject(getExportedSpecCall(sourceFile));
    const entries: Record<string, LawSource> = {};

    for (const property of lawObject.properties) {
        if (!ts.isPropertyAssignment(property)) {
            throw new Error("Only property assignments are supported in spec law objects.");
        }

        const name = getPropertyName(property.name);
        const { character, line } = sourceFile.getLineAndCharacterOfPosition(
            property.getStart(sourceFile),
        );

        entries[name] = {
            location: `${path.relative(process.cwd(), sourceFile.fileName)}:${line + 1}:${character + 1}`,
            snippet: property.initializer.getText(sourceFile),
        };
    }

    return entries;
}
