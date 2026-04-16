export type Shape =
    | { kind: "array"; element: Shape }
    | { kind: "boolean" }
    | { kind: "literal"; value: boolean | number | string }
    | { kind: "null" }
    | { kind: "number" }
    | {
          kind: "object";
          properties: Array<{
              name: string;
              optional: boolean;
              shape: Shape;
          }>;
      }
    | { kind: "record"; value: Shape }
    | { kind: "string" }
    | { kind: "tuple"; items: Shape[] }
    | { kind: "unknown" }
    | { kind: "undefined" }
    | { kind: "union"; options: Shape[] };

export type ParameterShape = {
    name: string;
    shape: Shape;
};
