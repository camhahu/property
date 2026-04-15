import path from "node:path";

import type ts from "typescript";

import type { ParameterShape } from "../types/shape.ts";
import { createProgram } from "./create-program.ts";
import { shapeFromType } from "./shape-from-type.ts";
import { getLawSources, getTargetSymbol, type LawSource } from "./spec-call.ts";

export type { LawSource } from "./spec-call.ts";

export type AnalyzedSpec = {
    dependencyArgumentNames: Record<string, string[]>;
    dependencyParameterName?: string;
    lawSources: Record<string, LawSource>;
    parameterShapes: ParameterShape[];
    specFilePath: string;
    targetFilePath: string;
    targetName: string;
};

function getSourceFile(program: ts.Program, specFilePath: string): ts.SourceFile {
    const sourceFile = program.getSourceFile(specFilePath);

    if (!sourceFile) {
        throw new Error(`Could not load ${specFilePath}`);
    }

    return sourceFile;
}

function getDeclaration(symbol: ts.Symbol): ts.Declaration {
    const declaration = symbol.valueDeclaration ?? symbol.declarations?.[0];

    if (!declaration) {
        throw new Error(`Could not find a declaration for ${symbol.getName()}`);
    }

    return declaration;
}

function getSignature({
    checker,
    declaration,
    symbol,
}: {
    checker: ts.TypeChecker;
    declaration: ts.Declaration;
    symbol: ts.Symbol;
}): ts.Signature {
    const targetType = checker.getTypeOfSymbolAtLocation(symbol, declaration);
    const signature = checker.getSignaturesOfType(targetType, 0)[0];

    if (!signature) {
        throw new Error(`${symbol.getName()} is not callable.`);
    }

    return signature;
}

function isDependencyParameter(name: string | undefined, parameterCount: number): boolean {
    return parameterCount > 1 && (name === "dependencies" || name === "deps");
}

function getParameterName({
    index,
    parameter,
    signature,
}: {
    index: number;
    parameter: ts.Symbol;
    signature: ts.Signature;
}): string {
    return signature.declaration?.parameters[index]?.name.getText() ?? parameter.getName();
}

function getDependencyParameter(signature: ts.Signature): ts.Symbol | undefined {
    return signature.parameters.find((parameter, index) =>
        isDependencyParameter(
            getParameterName({ index, parameter, signature }),
            signature.parameters.length,
        ),
    );
}

function getDependencyPropertyArgumentNames(
    checker: ts.TypeChecker,
    property: ts.Symbol,
): [string, string[]] | undefined {
    const propertyDeclaration = property.valueDeclaration ?? property.declarations?.[0];

    if (!propertyDeclaration) {
        return undefined;
    }

    return toDependencyPropertyEntry(
        property,
        getDependencyPropertySignature({ checker, property, propertyDeclaration }),
    );
}

function getDependencyPropertySignature({
    checker,
    property,
    propertyDeclaration,
}: {
    checker: ts.TypeChecker;
    property: ts.Symbol;
    propertyDeclaration: ts.Declaration;
}): ts.Signature | undefined {
    const propertyType = checker.getTypeOfSymbolAtLocation(property, propertyDeclaration);
    return checker.getSignaturesOfType(propertyType, 0)[0];
}

function toDependencyPropertyEntry(
    property: ts.Symbol,
    propertySignature: ts.Signature | undefined,
): [string, string[]] | undefined {
    return propertySignature
        ? [property.name, propertySignature.parameters.map((parameter) => parameter.getName())]
        : undefined;
}

function getDependencyArgumentNames({
    checker,
    declaration,
    signature,
}: {
    checker: ts.TypeChecker;
    declaration: ts.Declaration;
    signature: ts.Signature;
}): Record<string, string[]> {
    const dependencyParameter = getDependencyParameter(signature);

    if (!dependencyParameter) {
        return {};
    }

    const parameterDeclaration = dependencyParameter.valueDeclaration ?? declaration;
    const dependencyType = checker.getTypeOfSymbolAtLocation(
        dependencyParameter,
        parameterDeclaration,
    );

    return Object.fromEntries(
        checker
            .getPropertiesOfType(dependencyType)
            .map((property) => getDependencyPropertyArgumentNames(checker, property))
            .filter((entry): entry is [string, string[]] => entry !== undefined),
    );
}

function toParameterShape({
    checker,
    declaration,
    name,
    parameter,
}: {
    checker: ts.TypeChecker;
    declaration: ts.Declaration;
    name: string;
    parameter: ts.Symbol;
}): ParameterShape {
    const parameterDeclaration = parameter.valueDeclaration ?? declaration;

    return {
        name,
        shape: shapeFromType({
            checker,
            seen: new Set<ts.Type>(),
            type: checker.getTypeOfSymbolAtLocation(parameter, parameterDeclaration),
        }),
    };
}

function getParameterAnalysis({
    checker,
    declaration,
    signature,
}: {
    checker: ts.TypeChecker;
    declaration: ts.Declaration;
    signature: ts.Signature;
}): { dependencyParameterName?: string; parameterShapes: ParameterShape[] } {
    let dependencyParameterName: string | undefined;
    const parameterShapes = signature.parameters.flatMap((parameter, index) => {
        const name = getParameterName({ index, parameter, signature });

        if (isDependencyParameter(name, signature.parameters.length)) {
            dependencyParameterName = name;
            return [];
        }

        return [toParameterShape({ checker, declaration, name, parameter })];
    });

    return { dependencyParameterName, parameterShapes };
}

export function analyzeSpecFile(specFilePath: string): AnalyzedSpec {
    const program = createProgram(specFilePath);
    const checker = program.getTypeChecker();
    const sourceFile = getSourceFile(program, specFilePath);
    const targetSymbol = getTargetSymbol(checker, sourceFile);
    const declaration = getDeclaration(targetSymbol);
    const signature = getSignature({ checker, declaration, symbol: targetSymbol });
    const targetSourceFile = declaration.getSourceFile();
    const parameterAnalysis = getParameterAnalysis({ checker, declaration, signature });

    return {
        dependencyArgumentNames: getDependencyArgumentNames({ checker, declaration, signature }),
        dependencyParameterName: parameterAnalysis.dependencyParameterName,
        lawSources: getLawSources(sourceFile),
        parameterShapes: parameterAnalysis.parameterShapes,
        specFilePath,
        targetFilePath: path.resolve(targetSourceFile.fileName),
        targetName: targetSymbol.getName(),
    };
}
