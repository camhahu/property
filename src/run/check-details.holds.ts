import { spec } from "holds";

import { getCounterexampleInput } from "./get-counterexample-input.ts";

export const counterexampleSpec = spec(getCounterexampleInput, ({ law, section }) => {
    section("selection", () => {
        law("returns undefined when the check did not fail", {
            where: ({ input }) => !input.failed,
            holds: ({ result }) => result === undefined,
        });

        law("ignores counterexamples when the check did not fail", {
            where: ({ input }) =>
                !input.failed &&
                Array.isArray(input.counterexample) &&
                input.counterexample.length > 0 &&
                input.counterexample[0] !== undefined,
            holds: ({ result }) => result === undefined,
        });

        law("returns undefined when there is no counterexample", {
            where: ({ input }) => input.failed && !input.counterexample,
            holds: ({ result }) => result === undefined,
        });

        law("returns the first counterexample value when present", {
            where: ({ input }) =>
                input.failed &&
                Array.isArray(input.counterexample) &&
                input.counterexample.length > 0,
            holds: ({ input, result }) => result === input.counterexample?.[0],
        });
    });
});
