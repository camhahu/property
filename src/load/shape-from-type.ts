import ts from "typescript";

import type { Shape } from "../types/shape.ts";

type ShapeRequest = {
    checker: ts.TypeChecker;
    seen: ReadonlySet<ts.Type>;
    type: ts.Type;
};

type ShapeResolver = (request: ShapeRequest) => Shape | undefined;

function flattenUnionOptions(options: Shape[]): Shape[] {
    return options.flatMap((option) =>
        option.kind === "union" ? flattenUnionOptions(option.options) : [option],
    );
}

function numberShape({ type }: ShapeRequest): Shape | undefined {
    return type.flags & ts.TypeFlags.NumberLike ? { kind: "number" } : undefined;
}

function booleanShape({ checker, type }: ShapeRequest): Shape | undefined {
    if (!(type.flags & ts.TypeFlags.BooleanLike)) {
        return undefined;
    }

    return type.isLiteral()
        ? { kind: "literal", value: checker.typeToString(type) === "true" }
        : { kind: "boolean" };
}

function stringShape({ type }: ShapeRequest): Shape | undefined {
    if (!(type.flags & ts.TypeFlags.StringLike)) {
        return undefined;
    }

    return type.isLiteral() && typeof type.value === "string"
        ? { kind: "literal", value: type.value }
        : { kind: "string" };
}

function nullShape({ type }: ShapeRequest): Shape | undefined {
    return type.flags & ts.TypeFlags.Null ? { kind: "null" } : undefined;
}

function undefinedShape({ type }: ShapeRequest): Shape | undefined {
    return type.flags & ts.TypeFlags.Undefined ? { kind: "undefined" } : undefined;
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

function arrayShapeFromType({ checker, seen, type }: ShapeRequest): Shape | undefined {
    if (!checker.isArrayType(type)) {
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

const shapeResolvers: ShapeResolver[] = [
    numberShape,
    booleanShape,
    stringShape,
    nullShape,
    undefinedShape,
    unionShapeFromType,
    arrayShapeFromType,
    tupleShapeFromType,
    objectShapeFromType,
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
