import ts from "typescript";

import { getReferenceSymbolFromExpression } from "./static-reference.ts";

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

export function getTargetSymbol(checker: ts.TypeChecker, sourceFile: ts.SourceFile): ts.Symbol {
    const [targetExpression] = getExportedSpecCall(sourceFile).arguments;

    if (!targetExpression) {
        throw new Error("spec() must receive a statically analyzable function reference.");
    }

    const symbol = getReferenceSymbolFromExpression(checker, targetExpression);

    if (!symbol) {
        throw new Error("spec() must receive a statically analyzable function reference.");
    }

    return symbol;
}
