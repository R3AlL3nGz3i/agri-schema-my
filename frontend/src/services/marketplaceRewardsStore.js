const STORAGE_KEY = "agri_marketplace_rewards_v1";

export const SELLER_SHIPPING_SLOT_COST = 40;
export const KARMA_PER_RINGGIT = 100;
export const MAX_KARMA_DISCOUNT_RATE = 0.5;

const seedPromotions = [
  {
    id: "shipping-promo-tomatoes",
    sellerEmail: "seller@agrischeme.my",
    sellerName: "Kebun Komuniti Selangor",
    productId: 1,
    productName: "Cameron Highlands Tomatoes",
    slotsTotal: 3,
    slotsRemaining: 3,
    createdAt: "2026-07-16T04:00:00.000Z",
  },
];

export function loadMarketplaceRewards() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) return JSON.parse(stored);
  } catch {
    // Use the seeded prototype when browser storage is unavailable.
  }
  return { promotions: seedPromotions.map((promotion) => ({ ...promotion })) };
}

export function saveMarketplaceRewards(state) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Keep the current Marketplace session usable if persistence fails.
  }
}

export function createShippingPromotion({ seller, productId, productName, slots }) {
  return {
    id: `shipping-promo-${Date.now()}`,
    sellerEmail: seller?.email || "seller@example.com",
    sellerName: seller?.name || "Marketplace Seller",
    productId: Number(productId),
    productName: String(productName).slice(0, 80),
    slotsTotal: slots,
    slotsRemaining: slots,
    createdAt: new Date().toISOString(),
  };
}
