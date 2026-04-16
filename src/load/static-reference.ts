import ts from "typescript";

function isWrappedExpression(
    expression: ts.Expression,
): expression is
    | ts.AsExpression
    | ts.NonNullExpression
    | ts.ParenthesizedExpression
    | ts.SatisfiesExpression {
    return (
        ts.isAsExpression(expression) ||
        ts.isNonNullExpression(expression) ||
        ts.isParenthesizedExpression(expression) ||
        ts.isSatisfiesExpression(expression)
    );
}

export function unwrapExpression(expression: ts.Expression): ts.Expression {
    if (isWrappedExpression(expression)) {
        return unwrapExpression(expression.expression);
    }

    return expression;
}

function getReferenceNode(expression: ts.Expression): ts.Node | undefined {
    const resolvedExpression = unwrapExpression(expression);

    if (ts.isIdentifier(resolvedExpression)) {
        return resolvedExpression;
    }

    if (ts.isPropertyAccessExpression(resolvedExpression)) {
        return resolvedExpression.name;
    }

    return undefined;
}

export function getResolvedSymbol(checker: ts.TypeChecker, node: ts.Node): ts.Symbol | undefined {
    const symbol = checker.getSymbolAtLocation(node);

    if (!symbol) {
        return undefined;
    }

    if (symbol.flags & ts.SymbolFlags.Alias) {
        return checker.getAliasedSymbol(symbol);
    }

    return symbol;
}

export function getReferenceDeclaration(
    checker: ts.TypeChecker,
    expression: ts.Expression,
): ts.Declaration | undefined {
    const referenceNode = getReferenceNode(expression);

    if (referenceNode) {
        return getResolvedSymbol(checker, referenceNode)?.valueDeclaration;
    }

    return undefined;
}

export function resolveExpression(
    checker: ts.TypeChecker,
    expression: ts.Expression,
): ts.Expression {
    const resolvedExpression = unwrapExpression(expression);
    const declaration = getReferenceDeclaration(checker, resolvedExpression);

    if (declaration && ts.isVariableDeclaration(declaration) && declaration.initializer) {
        return resolveExpression(checker, declaration.initializer);
    }

    return resolvedExpression;
}

function asInlineFunctionLike(expression: ts.Expression): ts.FunctionLikeDeclaration | undefined {
    if (ts.isArrowFunction(expression) || ts.isFunctionExpression(expression)) {
        return expression;
    }

    return undefined;
}

function asReferencedFunctionLike(
    declaration: ts.Declaration | undefined,
): ts.FunctionLikeDeclaration | undefined {
    if (
        declaration &&
        (ts.isFunctionDeclaration(declaration) || ts.isMethodDeclaration(declaration))
    ) {
        return declaration;
    }

    return undefined;
}

export function resolveFunctionLike(
    checker: ts.TypeChecker,
    expression: ts.Expression,
): ts.FunctionLikeDeclaration | undefined {
    const resolvedExpression = resolveExpression(checker, expression);

    return (
        asInlineFunctionLike(resolvedExpression) ??
        asReferencedFunctionLike(getReferenceDeclaration(checker, expression))
    );
}

export function getCallName(expression: ts.Expression): string | undefined {
    if (ts.isIdentifier(expression)) {
        return expression.text;
    }

    if (ts.isPropertyAccessExpression(expression)) {
        return expression.name.text;
    }

    return undefined;
}

export function getReferenceSymbolFromExpression(
    checker: ts.TypeChecker,
    expression: ts.Expression,
): ts.Symbol | undefined {
    const referenceNode = getReferenceNode(resolveExpression(checker, expression));

    if (referenceNode) {
        return getResolvedSymbol(checker, referenceNode);
    }

    return undefined;
}
