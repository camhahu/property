import ts from "typescript";

export type MutationCandidate = {
    description: string;
    end: number;
    replacement: string;
    start: number;
};

const tokenMutations = new Map<ts.SyntaxKind, string>([
    [ts.SyntaxKind.AmpersandAmpersandToken, "||"],
    [ts.SyntaxKind.AsteriskToken, "/"],
    [ts.SyntaxKind.BarBarToken, "&&"],
    [ts.SyntaxKind.EqualsEqualsEqualsToken, "!=="],
    [ts.SyntaxKind.ExclamationEqualsEqualsToken, "==="],
    [ts.SyntaxKind.GreaterThanEqualsToken, ">"],
    [ts.SyntaxKind.GreaterThanToken, ">="],
    [ts.SyntaxKind.LessThanEqualsToken, "<"],
    [ts.SyntaxKind.LessThanToken, "<="],
    [ts.SyntaxKind.MinusToken, "+"],
    [ts.SyntaxKind.PlusToken, "-"],
    [ts.SyntaxKind.SlashToken, "*"],
]);

function getBinaryMutation(
    node: ts.BinaryExpression,
    sourceFile: ts.SourceFile,
): MutationCandidate | undefined {
    const replacement = tokenMutations.get(node.operatorToken.kind);

    return replacement
        ? {
              description: `replace ${node.operatorToken.getText(sourceFile)} with ${replacement}`,
              end: node.operatorToken.end,
              replacement,
              start: node.operatorToken.getStart(sourceFile),
          }
        : undefined;
}

function getNumericMutation(node: ts.NumericLiteral, sourceFile: ts.SourceFile): MutationCandidate {
    const replacement = node.text === "0" ? "1" : "0";

    return {
        description: `replace ${node.getText(sourceFile)} with ${replacement}`,
        end: node.end,
        replacement,
        start: node.getStart(sourceFile),
    };
}

function getBooleanMutation(
    node: ts.Node,
    sourceFile: ts.SourceFile,
): MutationCandidate | undefined {
    if (node.kind !== ts.SyntaxKind.TrueKeyword && node.kind !== ts.SyntaxKind.FalseKeyword) {
        return undefined;
    }

    const current = node.getText(sourceFile);
    const replacement = current === "true" ? "false" : "true";

    return {
        description: `replace ${current} with ${replacement}`,
        end: node.end,
        replacement,
        start: node.getStart(sourceFile),
    };
}

function getMutationCandidate(
    node: ts.Node,
    sourceFile: ts.SourceFile,
): MutationCandidate | undefined {
    if (ts.isBinaryExpression(node)) {
        return getBinaryMutation(node, sourceFile);
    }

    if (ts.isNumericLiteral(node)) {
        return getNumericMutation(node, sourceFile);
    }

    return getBooleanMutation(node, sourceFile);
}

function getFunctionDeclarations(
    sourceFile: ts.SourceFile,
    targetName: string,
): ts.FunctionDeclaration[] {
    const declarations = sourceFile.statements.filter(
        (statement): statement is ts.FunctionDeclaration =>
            ts.isFunctionDeclaration(statement) && statement.name !== undefined,
    );

    const includesTarget = declarations.some(
        (declaration) => declaration.name?.text === targetName,
    );

    if (!includesTarget) {
        throw new Error(`Could not find function declaration for ${targetName}`);
    }

    return declarations;
}

export function createCandidates(
    sourceFile: ts.SourceFile,
    targetName: string,
): MutationCandidate[] {
    const candidates: MutationCandidate[] = [];
    const declarations = getFunctionDeclarations(sourceFile, targetName);
    const visit = (node: ts.Node): void => {
        const candidate = getMutationCandidate(node, sourceFile);

        if (candidate) {
            candidates.push(candidate);
        }

        ts.forEachChild(node, visit);
    };

    for (const declaration of declarations) {
        visit(declaration);
    }

    return candidates;
}

export function applyMutation(sourceText: string, candidate: MutationCandidate): string {
    return `${sourceText.slice(0, candidate.start)}${candidate.replacement}${sourceText.slice(candidate.end)}`;
}
