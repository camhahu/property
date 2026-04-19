import path from "node:path";

import type ts from "typescript";

import type { Shape } from "../types/shape.ts";
import { createProgram } from "./create-program.ts";
import { getPropertySources, type PropertySource } from "./property-sources.ts";
import { shapeFromType } from "./shape-from-type.ts";
import { getTargetSymbol } from "./spec-call.ts";

export type { PropertySource } from "./property-sources.ts";

export type AnalyzedSpec = {
    dependencyArgumentNames: Record<string, string[]>;
    dependencyParameterName?: string;
    inputName: string;
    inputShape: Shape;
    propertySources: Record<string, PropertySource>;
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

function getInputParameter(signature: ts.Signature): ts.Symbol {
    if (signature.parameters.length === 0 || signature.parameters.length > 2) {
        throw new Error(
            "spec targets must have one business input parameter and at most one dependency bag.",
        );
    }

    const [inputParameter] = signature.parameters;

    if (!inputParameter) {
        throw new Error("spec targets must have one business input parameter.");
    }

    return inputParameter;
}

function getDependencyParameter(signature: ts.Signature): ts.Symbol | undefined {
    if (signature.parameters.length === 2) {
        return signature.parameters[1];
    }

    return undefined;
}

function getDependencyPropertyEntry(
    checker: ts.TypeChecker,
    property: ts.Symbol,
): [string, string[]] | undefined {
    const propertyDeclaration = property.valueDeclaration ?? property.declarations?.[0];

    if (!propertyDeclaration) {
        return undefined;
    }

    return toDependencyPropertyEntry(
        property,
        checker.getSignaturesOfType(
            checker.getTypeOfSymbolAtLocation(property, propertyDeclaration),
            0,
        )[0],
    );
}

function toDependencyPropertyEntry(
    property: ts.Symbol,
    propertySignature: ts.Signature | undefined,
): [string, string[]] | undefined {
    if (propertySignature) {
        return [
            property.name,
            propertySignature.parameters.map((parameter) => parameter.getName()),
        ];
    }

    return undefined;
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
            .map((property) => getDependencyPropertyEntry(checker, property))
            .filter((entry): entry is [string, string[]] => entry !== undefined),
    );
}

function getInputAnalysis({
    checker,
    declaration,
    signature,
}: {
    checker: ts.TypeChecker;
    declaration: ts.Declaration;
    signature: ts.Signature;
}): { dependencyParameterName?: string; inputName: string; inputShape: Shape } {
    const inputParameter = getInputParameter(signature);

    const inputIndex = signature.parameters.indexOf(inputParameter);
    const inputName = getParameterName({ index: inputIndex, parameter: inputParameter, signature });
    const parameterDeclaration = inputParameter.valueDeclaration ?? declaration;
    const dependencyParameter = getDependencyParameter(signature);

    return {
        dependencyParameterName: dependencyParameter?.getName(),
        inputName,
        inputShape: shapeFromType({
            checker,
            seen: new Set<ts.Type>(),
            type: checker.getTypeOfSymbolAtLocation(inputParameter, parameterDeclaration),
        }),
    };
}

export function analyzeSpecFile(specFilePath: string): AnalyzedSpec {
    const program = createProgram(specFilePath);
    const checker = program.getTypeChecker();
    const sourceFile = getSourceFile(program, specFilePath);
    const targetSymbol = getTargetSymbol(checker, sourceFile);
    const declaration = getDeclaration(targetSymbol);
    const signature = getSignature({ checker, declaration, symbol: targetSymbol });
    const targetSourceFile = declaration.getSourceFile();
    const inputAnalysis = getInputAnalysis({ checker, declaration, signature });

    return {
        dependencyArgumentNames: getDependencyArgumentNames({ checker, declaration, signature }),
        dependencyParameterName: inputAnalysis.dependencyParameterName,
        inputName: inputAnalysis.inputName,
        inputShape: inputAnalysis.inputShape,
        propertySources: getPropertySources(checker, sourceFile),
        specFilePath,
        targetFilePath: path.resolve(targetSourceFile.fileName),
        targetName: targetSymbol.getName(),
    };
}
