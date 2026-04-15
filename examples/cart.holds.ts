import { spec } from "holds";

import {
    calculateCartSummary,
    type CartItem,
    type CartSummary,
    type CheckoutInput,
} from "./cart.ts";

function itemCountOf(items: CartItem[]): number {
    return items.reduce((count, item) => count + item.quantity, 0);
}

function subtotalOf(items: CartItem[]): number {
    return items.reduce((sum, item) => sum + item.unitPriceCents * item.quantity, 0);
}

function fragileLineCount(items: CartItem[]): number {
    return items.filter((item) => item.fragile).length;
}

function isZeroSummary(result: CartSummary): boolean {
    return Object.values(result).every((value) => value === 0);
}

function hasCouponCode(input: CheckoutInput): boolean {
    return Boolean(input.couponCode?.trim());
}

function normalizedCouponCode(input: CheckoutInput): string | undefined {
    return input.couponCode?.trim();
}

function hasPositiveSubtotal(input: CheckoutInput): boolean {
    return subtotalOf(input.cart.items) > 0;
}

function isPaidShippingCase(input: CheckoutInput): boolean {
    return itemCountOf(input.cart.items) > 0 && subtotalOf(input.cart.items) < 5000;
}

const noCoupon = {
    fetchCoupon: null,
};

export const cartSpec = spec(calculateCartSummary, ({ law, section }) => {
    section("totals", () => {
        law("empty cart stays empty", {
            given: noCoupon,
            where: ({ input }) => itemCountOf(input.cart.items) === 0,
            holds: ({ result }) => isZeroSummary(result),
        });

        law("item count matches quantities", {
            given: noCoupon,
            holds: ({ input, result }) => result.itemCount === itemCountOf(input.cart.items),
        });

        law("subtotal matches unit price times quantity", {
            given: noCoupon,
            holds: ({ input, result }) => result.subtotal === subtotalOf(input.cart.items),
        });

        law("total balances subtotal discount and shipping", {
            given: noCoupon,
            holds: ({ result }) =>
                result.total === result.subtotal - result.discount + result.shipping,
        });
    });

    section("shipping", () => {
        law("shipping is zero at or above threshold", {
            given: noCoupon,
            where: ({ input }) => subtotalOf(input.cart.items) >= 5000,
            holds: ({ result }) => result.shipping === 0,
        });

        law("shipping is zero exactly at the threshold", {
            given: noCoupon,
            where: ({ input }) => subtotalOf(input.cart.items) === 5000,
            holds: ({ result }) => result.shipping === 0,
        });

        law("standard shipping matches the published formula", {
            given: noCoupon,
            where: ({ input }) => isPaidShippingCase(input) && input.cart.membership === "standard",
            holds: ({ input, result }) =>
                result.shipping === 700 + fragileLineCount(input.cart.items) * 200,
        });

        law("premium shipping halves the paid shipping formula", {
            given: noCoupon,
            where: ({ input }) => isPaidShippingCase(input) && input.cart.membership === "premium",
            holds: ({ input, result }) =>
                result.shipping ===
                Math.floor((700 + fragileLineCount(input.cart.items) * 200) / 2),
        });
    });

    section("coupons", () => {
        law("missing coupon means no discount", {
            where: ({ input }) => !hasCouponCode(input),
            given: {
                fetchCoupon: {
                    return: null,
                    where: ({ input }) => hasCouponCode(input),
                },
            },
            holds: ({ result }) => result.discount === 0,
        });

        law("coupon code is passed to fetchCoupon", {
            where: ({ input }) => hasPositiveSubtotal(input) && hasCouponCode(input),
            given: {
                fetchCoupon: {
                    return: { type: "percent", value: 10 },
                    where: ({ args, input }) => args.code === normalizedCouponCode(input),
                },
            },
            holds: ({ input, result }) =>
                result.discount === Math.round(subtotalOf(input.cart.items) * 0.1),
        });

        law("100 percent coupon makes the subtotal free", {
            where: ({ input }) => hasPositiveSubtotal(input) && hasCouponCode(input),
            given: {
                fetchCoupon: { type: "percent", value: 100 },
            },
            holds: ({ input, result }) =>
                result.discount === subtotalOf(input.cart.items) &&
                result.total === result.shipping,
        });

        law("fixed coupons clamp at the subtotal", {
            where: ({ input }) => hasPositiveSubtotal(input) && hasCouponCode(input),
            given: {
                fetchCoupon: { type: "fixed", value: 4000 },
            },
            holds: ({ input, result }) =>
                result.discount === Math.min(subtotalOf(input.cart.items), 4000),
        });

        law("negative fixed coupons are ignored", {
            where: ({ input }) => hasCouponCode(input),
            given: {
                fetchCoupon: { type: "fixed", value: -25 },
            },
            holds: ({ result }) => result.discount === 0,
        });

        law("negative percent coupons are ignored", {
            where: ({ input }) => hasCouponCode(input),
            given: {
                fetchCoupon: { type: "percent", value: -25 },
            },
            holds: ({ result }) => result.discount === 0,
        });
    });
});
