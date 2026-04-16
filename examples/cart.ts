export type CartItem = {
    fragile: boolean;
    quantity: number;
    unitPriceCents: number;
};

export type Membership = "premium" | "standard";

export type Cart = {
    items: CartItem[];
    membership: Membership;
};

export type Coupon =
    | {
          type: "fixed";
          value: number;
      }
    | {
          type: "percent";
          value: number;
      };

export type CheckoutInput = {
    cart: Cart;
    couponCode?: string;
};

export type CheckoutDependencies = {
    fetchCoupon: (code: string) => Promise<Coupon | null>;
};

export type CartSummary = {
    discount: number;
    itemCount: number;
    shipping: number;
    subtotal: number;
    total: number;
};

function itemCountOf(items: CartItem[]): number {
    return items.reduce((count, item) => count + item.quantity, 0);
}

function subtotalOf(items: CartItem[]): number {
    return items.reduce((sum, item) => sum + item.unitPriceCents * item.quantity, 0);
}

function normalizedCouponCode(couponCode?: string): string | undefined {
    return couponCode?.trim();
}

function fetchedCoupon({
    couponCode,
    dependencies,
}: {
    couponCode?: string;
    dependencies: CheckoutDependencies;
}): Promise<Coupon | null> {
    const code = normalizedCouponCode(couponCode);

    if (code) {
        return dependencies.fetchCoupon(code);
    }

    return Promise.resolve(null);
}

function discountFromCoupon(coupon: Coupon | null, subtotal: number): number {
    if (!coupon) {
        return 0;
    }

    if (coupon.type === "percent") {
        const percent = Math.min(Math.max(coupon.value, 0), 100);
        return Math.round((subtotal * percent) / 100);
    }

    return Math.min(subtotal, Math.max(coupon.value, 0));
}

async function discountFor({
    couponCode,
    dependencies,
    subtotal,
}: {
    couponCode?: string;
    dependencies: CheckoutDependencies;
    subtotal: number;
}): Promise<number> {
    return discountFromCoupon(await fetchedCoupon({ couponCode, dependencies }), subtotal);
}

function shippingFor({
    cart,
    itemCount,
    subtotal,
}: {
    cart: Cart;
    itemCount: number;
    subtotal: number;
}): number {
    const freeShippingThreshold = 5000;
    const baseShipping = 700;
    const fragileSurcharge = 200;

    if (itemCount === 0 || subtotal >= freeShippingThreshold) {
        return 0;
    }

    const fragileLines = cart.items.filter((item) => item.fragile).length;
    const shipping = baseShipping + fragileLines * fragileSurcharge;

    if (cart.membership === "premium") {
        return Math.floor(shipping / 2);
    }

    return shipping;
}

export async function calculateCartSummary(
    input: CheckoutInput,
    services: CheckoutDependencies,
): Promise<CartSummary> {
    const itemCount = itemCountOf(input.cart.items);
    const subtotal = subtotalOf(input.cart.items);
    const discount = await discountFor({
        couponCode: input.couponCode,
        dependencies: services,
        subtotal,
    });
    const shipping = shippingFor({ cart: input.cart, itemCount, subtotal });

    return {
        discount,
        itemCount,
        shipping,
        subtotal,
        total: subtotal - discount + shipping,
    };
}
