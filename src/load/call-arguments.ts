import ts from "typescript";

import { resolveExpression } from "./static-reference.ts";

type ResolvedArgumentRequest = {
    call: ts.CallExpression;
    checker: ts.TypeChecker;
    index: number;
};

function getResolvedArgument({
    call,
    checker,
    index,
}: ResolvedArgumentRequest): ts.Expression | undefined {
    const argument = call.arguments[index];

    if (argument) {
        return resolveExpression(checker, argument);
    }

    return undefined;
}

export function getStringArgument(request: ResolvedArgumentRequest): string {
    const argument = getResolvedArgument(request);

    if (
        !argument ||
        (!ts.isStringLiteral(argument) && !ts.isNoSubstitutionTemplateLiteral(argument))
    ) {
        throw new Error("argument must be a string literal.");
    }

    return argument.text;
}

export function getObjectArgument(
    request: ResolvedArgumentRequest,
): ts.ObjectLiteralExpression | undefined {
    const argument = getResolvedArgument(request);

    if (argument && ts.isObjectLiteralExpression(argument)) {
        return argument;
    }

    return undefined;
}
