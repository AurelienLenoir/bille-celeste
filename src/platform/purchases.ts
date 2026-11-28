import { detectPlatform, isNative } from '.';

/**
 * In-app purchases through RevenueCat (PLAN.md § 10.4): "No ads" (non-consumable, entitlement
 * `no_ads`) and two feather packs (consumables). Needs the RevenueCat public keys in the build
 * (VITE_REVENUECAT_IOS / _ANDROID) and the products set up in both stores; otherwise the shop
 * simply shows no purchases. Never available in a browser.
 */
export const PRODUCTS = {
  noAds: 'bille_no_ads',
  feathersSmall: 'bille_feathers_500',
  feathersLarge: 'bille_feathers_1500',
} as const;
export type ProductKey = keyof typeof PRODUCTS;

/** Feathers each pack gives. */
export const PACK_FEATHERS: Partial<Record<ProductKey, number>> = { feathersSmall: 500, feathersLarge: 1500 };

export const NO_ADS_ENTITLEMENT = 'no_ads';

export type Offer = { key: ProductKey; price: string };

export type PurchaseOutcome = 'bought' | 'cancelled' | 'failed';

export type Purchases = {
  available: () => boolean;
  /** Products with their localised prices (empty when the store cannot be reached). */
  offers: () => Promise<Offer[]>;
  buy: (key: ProductKey) => Promise<PurchaseOutcome>;
  /** Restores "No ads" on a new phone (required by Apple). Resolves whether it is owned. */
  restore: () => Promise<boolean>;
  /** Does the store say "No ads" is owned? (checked at launch) */
  ownsNoAds: () => Promise<boolean>;
};

const unavailable: Purchases = {
  available: () => false,
  offers: async () => [],
  buy: async () => 'failed',
  restore: async () => false,
  ownsNoAds: async () => false,
};

const load = () => import('@revenuecat/purchases-capacitor');

export const createPurchases = (): Purchases => {
  const platform = detectPlatform();
  const env = import.meta.env;
  const apiKey =
    platform === 'ios' ? env.VITE_REVENUECAT_IOS : platform === 'android' ? env.VITE_REVENUECAT_ANDROID : undefined;
  if (!isNative() || !apiKey) return unavailable;

  let configured: Promise<boolean> | undefined;
  const ready = () =>
    (configured ??= load()
      .then(({ Purchases }) => Purchases.configure({ apiKey }))
      .then(() => true)
      .catch(() => false));

  const products = async () => {
    if (!(await ready())) return [];
    const { Purchases, PRODUCT_CATEGORY } = await load();
    const ids = Object.values(PRODUCTS);
    const { products: list } = await Purchases.getProducts({
      productIdentifiers: ids,
      type: PRODUCT_CATEGORY.NON_SUBSCRIPTION,
    });
    return list;
  };

  const ownsNoAds = async () => {
    if (!(await ready())) return false;
    try {
      const { Purchases } = await load();
      const { customerInfo } = await Purchases.getCustomerInfo();
      return NO_ADS_ENTITLEMENT in customerInfo.entitlements.active;
    } catch {
      return false;
    }
  };

  return {
    available: () => true,
    offers: async () => {
      try {
        const list = await products();
        return (Object.keys(PRODUCTS) as ProductKey[]).flatMap((key) => {
          const product = list.find((p) => p.identifier === PRODUCTS[key]);
          return product ? [{ key, price: product.priceString }] : [];
        });
      } catch {
        return [];
      }
    },
    buy: async (key) => {
      try {
        const product = (await products()).find((p) => p.identifier === PRODUCTS[key]);
        if (!product) return 'failed';
        const { Purchases } = await load();
        await Purchases.purchaseStoreProduct({ product });
        return 'bought';
      } catch (error) {
        const cancelled =
          typeof error === 'object' && error !== null && 'userCancelled' in error && !!error.userCancelled;
        return cancelled ? 'cancelled' : 'failed';
      }
    },
    restore: async () => {
      if (!(await ready())) return false;
      try {
        const { Purchases } = await load();
        const { customerInfo } = await Purchases.restorePurchases();
        return NO_ADS_ENTITLEMENT in customerInfo.entitlements.active;
      } catch {
        return false;
      }
    },
    ownsNoAds,
  };
};
