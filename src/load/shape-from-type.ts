import ts from "typescript";

import type { Shape } from "../types/shape.ts";

type ShapeRequest = {
    checker: ts.TypeChecker;
    seen: ReadonlySet<ts.Type>;
    type: ts.Type;
};

type ShapeResolver = (request: ShapeRequest) => Shape | undefined;

function flattenUnionOptions(options: Shape[]): Shape[] {
    return options.flatMap((option) => {
        if (option.kind === "union") {
            return flattenUnionOptions(option.options);
        }

        return [option];
    });
}

function literalValue(
    checker: ts.TypeChecker,
    type: ts.LiteralType,
): boolean | number | string | undefined {
    if (typeof type.value === "string" || typeof type.value === "number") {
        return type.value;
    }

    if (type.flags & ts.TypeFlags.BooleanLiteral) {
        return checker.typeToString(type) === "true";
    }

    return undefined;
}

function literalShape({ checker, type }: ShapeRequest): Shape | undefined {
    if (!type.isLiteral()) {
        return undefined;
    }

    const value = literalValue(checker, type as ts.LiteralType);

    if (value === undefined) {
        return undefined;
    }

    return { kind: "literal", value };
}

function numberShape({ type }: ShapeRequest): Shape | undefined {
    if (type.flags & ts.TypeFlags.NumberLike) {
        return { kind: "number" };
    }

    return undefined;
}

function booleanShape({ checker, type }: ShapeRequest): Shape | undefined {
    if (!(type.flags & ts.TypeFlags.BooleanLike)) {
        return undefined;
    }

    if (type.isLiteral()) {
        return { kind: "literal", value: checker.typeToString(type) === "true" };
    }

    return { kind: "boolean" };
}

function stringShape({ type }: ShapeRequest): Shape | undefined {
    if (!(type.flags & ts.TypeFlags.StringLike)) {
        return undefined;
    }

    if (type.isLiteral() && typeof type.value === "string") {
        return { kind: "literal", value: type.value };
    }

    return { kind: "string" };
}

function nullShape({ type }: ShapeRequest): Shape | undefined {
    if (type.flags & ts.TypeFlags.Null) {
        return { kind: "null" };
    }

    return undefined;
}

function undefinedShape({ type }: ShapeRequest): Shape | undefined {
    if (type.flags & ts.TypeFlags.Undefined) {
        return { kind: "undefined" };
    }

    return undefined;
}

function unknownShape({ type }: ShapeRequest): Shape | undefined {
    if (type.flags & (ts.TypeFlags.Any | ts.TypeFlags.Unknown)) {
        return { kind: "unknown" };
    }

    return undefined;
}

function unionShapeFromType({ checker, seen, type }: ShapeRequest): Shape | undefined {
    if (!type.isUnion()) {
        return undefined;
    }

    return {
        kind: "union",
        options: flattenUnionOptions(
            type.types.map((part) => shapeFromType({ checker, seen, type: part })),
        ),
    };
}

function isArrayContainer(checker: ts.TypeChecker, type: ts.Type): boolean {
    return (
        !checker.isTupleType(type) &&
        checker.isArrayLikeType(type) &&
        !(type.flags & ts.TypeFlags.StringLike)
    );
}

function arrayShapeFromType({ checker, seen, type }: ShapeRequest): Shape | undefined {
    if (!isArrayContainer(checker, type)) {
        return undefined;
    }

    const elementType = checker.getTypeArguments(type as ts.TypeReference)[0];

    if (!elementType) {
        throw new Error("Could not resolve array element type.");
    }

    return { element: shapeFromType({ checker, seen, type: elementType }), kind: "array" };
}

function tupleShapeFromType({ checker, seen, type }: ShapeRequest): Shape | undefined {
    if (!checker.isTupleType(type)) {
        return undefined;
    }

    return {
        items: checker
            .getTypeArguments(type as ts.TypeReference)
            .map((item) => shapeFromType({ checker, seen, type: item })),
        kind: "tuple",
    };
}

function objectShapeFromType({ checker, seen, type }: ShapeRequest): Shape | undefined {
    if (seen.has(type)) {
        throw new Error("Recursive types are not supported yet.");
    }

    const properties = checker.getPropertiesOfType(type);

    if (properties.length === 0) {
        return undefined;
    }

    const nextSeen = new Set([...seen, type]);

    return {
        kind: "object",
        properties: properties.map((property) => {
            const declaration = property.valueDeclaration ?? property.declarations?.[0];

            if (!declaration) {
                throw new Error(`Could not resolve declaration for property ${property.name}`);
            }

            return {
                name: property.name,
                optional: (property.flags & ts.SymbolFlags.Optional) !== 0,
                shape: shapeFromType({
                    checker,
                    seen: nextSeen,
                    type: checker.getTypeOfSymbolAtLocation(property, declaration),
                }),
            };
        }),
    };
}

function getIndexValueType(checker: ts.TypeChecker, type: ts.Type): ts.Type | undefined {
    return (
        checker.getIndexTypeOfType(type, ts.IndexKind.String) ??
        checker.getIndexTypeOfType(type, ts.IndexKind.Number)
    );
}

function recordShapeFromType({ checker, seen, type }: ShapeRequest): Shape | undefined {
    const valueType = getIndexValueType(checker, type);

    if (!valueType) {
        return undefined;
    }

    return {
        kind: "record",
        value: shapeFromType({ checker, seen: new Set([...seen, type]), type: valueType }),
    };
}

const shapeResolvers: ShapeResolver[] = [
    literalShape,
    numberShape,
    booleanShape,
    stringShape,
    nullShape,
    undefinedShape,
    unknownShape,
    unionShapeFromType,
    tupleShapeFromType,
    arrayShapeFromType,
    objectShapeFromType,
    recordShapeFromType,
];

export function shapeFromType(request: ShapeRequest): Shape {
    for (const resolver of shapeResolvers) {
        const resolvedShape = resolver(request);

        if (resolvedShape) {
            return resolvedShape;
        }
    }

    throw new Error(`Unsupported type: ${request.checker.typeToString(request.type)}`);
}
