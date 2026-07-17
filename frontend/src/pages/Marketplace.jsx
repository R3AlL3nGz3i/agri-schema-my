import { useEffect, useMemo, useRef } from "react";
import { Link } from "react-router-dom";
import { Leaf, ArrowLeft } from "lucide-react";
import { MARKETPLACE_B64 } from "../marketplaceData";
import { useApp } from "../context/AppContext";
import {
  VOUCHER_TIERS,
  createVoucher,
  getCreditProgress,
  loadCommunityState,
  saveCommunityState,
} from "../services/communityStore";
import {
  KARMA_PER_RINGGIT,
  SELLER_SHIPPING_SLOT_COST,
  createShippingPromotion,
  loadMarketplaceRewards,
  saveMarketplaceRewards,
} from "../services/marketplaceRewardsStore";

// The marketplace is a self-contained HTML bundle (its own runtime + assets).
// We embed it as an opaque-origin iframe via a base64 data URL so the entire
// site ships as one standalone HTML file with no external requests.
const DATA_URL_PREFIX = "data:text/html;charset=utf-8;base64,";
const BUYER_NAV_MARKER = String.raw`<!-- ============ BUYER TOP NAV ============ -->`;
const MARKETPLACE_REWARD_MESSAGE = "agrischeme:marketplace-reward";

// MARKETPLACE_B64 contains an outer document whose template is stored as a
// JSON string. Any injected markup must keep line breaks escaped or the
// embedded bundle cannot unpack itself at runtime.
function encodeBundledMarkup(markup) {
  return markup.replace(/\r?\n/g, String.raw`\n`);
}

function escapeMarkupText(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;")
    .replace(/\r?\n/g, " ");
}

function encodeBundledJsValue(value) {
  return JSON.stringify(value)
    .replaceAll("\\", "\\\\")
    .replaceAll('"', '\\"');
}

const BUYER_LAYOUT_REPLACEMENTS = [
  [
    String.raw`<header style=\"position:sticky;top:0;z-index:50;background:#fff;border-bottom:1px solid #e5e7eb;\">`,
    String.raw`<header style=\"position:sticky;top:0;z-index:50;margin-left:248px;background:#fff;border-bottom:1px solid #e5e7eb;\">`,
  ],
  ...["Browse", "Product detail", "Cart", "Checkout"].map((screen) => [
    String.raw`<main data-screen-label=\"${screen}\" style=\"flex:1;\">`,
    String.raw`<main data-screen-label=\"${screen}\" style=\"flex:1;margin-left:248px;\">`,
  ]),
  [
    String.raw`<main data-screen-label=\"Order confirmed\" style=\"flex:1;display:flex;align-items:center;justify-content:center;padding:56px 24px;\">`,
    String.raw`<main data-screen-label=\"Order confirmed\" style=\"flex:1;margin-left:248px;display:flex;align-items:center;justify-content:center;padding:56px 24px;\">`,
  ],
];

const SELLER_VIEW_REPLACEMENTS = [
  [
    String.raw`<span style=\"display:flex;align-items:center;gap:7px;background:#dcfce7;border:1px solid #bbf7d0;padding:5px 11px;border-radius:999px;\">`,
    String.raw`<div style=\"display:flex;background:#f3f4f6;border-radius:10px;padding:3px;margin-left:auto;margin-right:10px;\">\n            <button sc-camel-on-click=\"{{ setBuyerMode }}\" title=\"Switch to buyer marketplace\" style=\"height:34px;padding:0 15px;border:none;border-radius:8px;font-size:13px;font-weight:600;cursor:pointer;background:none;color:#6b7280;\">Shop<\u002Fbutton>\n            <button sc-camel-on-click=\"{{ setSellerMode }}\" title=\"Seller portal\" style=\"height:34px;padding:0 15px;border:none;border-radius:8px;font-size:13px;font-weight:600;cursor:pointer;background:#fff;color:#1a6b3c;box-shadow:0 1px 2px rgba(0,0,0,.08);\">Sell<\u002Fbutton>\n          <\u002Fdiv>\n          <span style=\"display:flex;align-items:center;gap:7px;background:#dcfce7;border:1px solid #bbf7d0;padding:5px 11px;border-radius:999px;\">`,
  ],
];

const BUYER_ONLY_REPLACEMENTS = [
  [
    String.raw`<button sc-camel-on-click=\"{{ setSellerMode }}\" style=\"{{ sellTabStyle }}\">Sell<\u002Fbutton>`,
    "",
  ],
  [
    String.raw`<button sc-camel-on-click=\"{{ goOnboard }}\" style=\"height:42px;padding:0 18px;border:none;border-radius:10px;background:#1a6b3c;color:#fff;font-weight:600;font-size:13.5px;cursor:pointer;\" style-hover=\"background:#0f4a28;\">Sign up<\u002Fbutton>`,
    "",
  ],
  [
    "setSellerMode: () => this.setState({ screen: 'seller' }),",
    "setSellerMode: () => this.setState({ screen: 'browse' }),",
  ],
  [
    "finishOnboard: () => this.setState({ screen: s.onboardRole === 'farmer' ? 'seller' : 'browse' }),",
    "finishOnboard: () => this.setState({ screen: 'browse' }),",
  ],
];

function getKarmaCard() {
  return encodeBundledMarkup(String.raw`<div style=\"margin:0 14px 12px;padding:13px;border:1px solid #374151;border-radius:10px;background:#1f2937;\">
    <div style=\"display:flex;align-items:center;justify-content:space-between;gap:8px;\"><span style=\"font-size:10.5px;color:#9ca3af;text-transform:uppercase;letter-spacing:.06em;font-weight:700;\">Agri Points<\u002Fspan><span style=\"font-size:17px;color:#e8b84b;font-weight:800;\">{{ karmaCredits }}<\u002Fspan><\u002Fdiv>
    <div style=\"font-size:11.5px;color:#fff;font-weight:600;margin-top:6px;\">{{ karmaLevel }}<\u002Fdiv>
    <div style=\"height:5px;background:#374151;border-radius:999px;overflow:hidden;margin-top:8px;\"><div style=\"{{ karmaProgressStyle }}\"><\u002Fdiv><\u002Fdiv>
    <div style=\"font-size:10.5px;color:#9ca3af;margin-top:6px;\">{{ karmaCreditLabel }}<\u002Fdiv>
    <div style=\"margin-top:9px;padding-top:9px;border-top:1px solid #374151;color:#9ca3af;font-size:10.5px;line-height:1.45;\">Redeem Agri Points into cash vouchers in the Vouchers tab, then apply one at checkout. ${KARMA_PER_RINGGIT} Agri Points = RM1.<\u002Fdiv>
  <\u002Fdiv>`);
}

function getBuyerSidebar(profile) {
  return encodeBundledMarkup(String.raw`
  <sc-if value=\"{{ showTopNav }}\" hint-placeholder-val=\"{{ true }}\">
    <aside style=\"position:fixed;inset:0 auto 0 0;z-index:60;width:248px;height:100vh;flex:none;background:#111827;color:#fff;display:flex;flex-direction:column;\">
      <div style=\"display:flex;align-items:center;gap:9px;padding:18px 18px;border-bottom:1px solid #374151;\">
        <svg width=\"20\" height=\"20\" sc-camel-view-box=\"0 0 24 24\" fill=\"none\" stroke=\"#e8b84b\" stroke-width=\"2.25\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10Z\"><\u002Fpath><path d=\"M2 21c0-3 1.85-5.36 5.08-6\"><\u002Fpath><\u002Fsvg>
        <span style=\"font-weight:700;font-size:16px;\">AgriScheme<span style=\"color:#e8b84b;\"> Marketplace<\u002Fspan><\u002Fspan>
      <\u002Fdiv>
      <div style=\"padding:16px 14px 8px;\"><button sc-camel-on-click=\"{{ goBrowse }}\" style=\"display:flex;align-items:center;justify-content:center;gap:7px;width:100%;background:#1a6b3c;color:#fff;border:none;padding:11px;border-radius:10px;font-size:13.5px;font-weight:600;cursor:pointer;\" style-hover=\"background:#0f4a28;\">Browse products<\u002Fbutton><\u002Fdiv>
      <nav aria-label=\"Buyer portal\" style=\"flex:1;padding:6px 14px;display:flex;flex-direction:column;gap:2px;overflow-y:auto;\">
        <p style=\"font-size:11px;color:#6b7280;text-transform:uppercase;letter-spacing:.06em;padding:8px 12px 4px;margin:0;\">Buyer Portal<\u002Fp>
        <button sc-camel-on-click=\"{{ goBrowse }}\" style=\"{{ buyerHomeTabStyle }}\"><span style=\"{{ buyerHomeDotStyle }}\"><\u002Fspan>Marketplace home<\u002Fbutton>
        <button sc-camel-on-click=\"{{ goFreeShipping }}\" style=\"{{ buyerShippingTabStyle }}\"><span style=\"{{ buyerShippingDotStyle }}\"><\u002Fspan>Free shipping<\u002Fbutton>
        <button sc-camel-on-click=\"{{ goVouchers }}\" style=\"{{ buyerVoucherTabStyle }}\"><span style=\"{{ buyerVoucherDotStyle }}\"><\u002Fspan>Vouchers<\u002Fbutton>
      <\u002Fnav>
      ${getKarmaCard()}
      <div style=\"border-top:1px solid #374151;padding:14px;\"><div style=\"display:flex;align-items:center;gap:9px;min-width:0;\"><div style=\"width:30px;height:30px;border-radius:999px;background:#1a6b3c;display:flex;align-items:center;justify-content:center;flex:none;color:#fff;font-size:12px;font-weight:700;\">${profile.initial}<\u002Fdiv><div style=\"min-width:0;\"><p style=\"font-size:13px;font-weight:600;margin:0;color:#fff;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;\">${profile.name}<\u002Fp><p style=\"font-size:11.5px;color:#9ca3af;margin:0;\">${profile.roleLabel}<\u002Fp><\u002Fdiv><\u002Fdiv><\u002Fdiv>
    <\u002Faside>
  <\u002Fsc-if>`);
}

function getBuyerFreeShippingScreen() {
  return encodeBundledMarkup(String.raw`
  <!-- ============ FREE SHIPPING PRODUCTS ============ -->
  <sc-if value=\"{{ isFreeShipping }}\" hint-placeholder-val=\"{{ false }}\">
    <main data-screen-label=\"Free shipping\" style=\"flex:1;margin-left:248px;\">
      <div style=\"max-width:1120px;margin:0 auto;padding:34px 24px;\">
        <div style=\"margin-bottom:22px;\"><h1 style=\"font-size:26px;font-weight:700;color:#111827;margin:0;\">Free shipping products<\u002Fh1><p style=\"font-size:14px;color:#6b7280;margin:6px 0 0;\">Shipping is sponsored by sellers. One order uses one shipping slot, regardless of product quantity.<\u002Fp><\u002Fdiv>
        <sc-if value=\"{{ freeShippingEmpty }}\" hint-placeholder-val=\"{{ false }}\"><div style=\"padding:48px 24px;border:1px dashed #d1d5db;border-radius:14px;background:#fff;text-align:center;color:#6b7280;\">No sponsored shipping products are available right now.<\u002Fdiv><\u002Fsc-if>
        <sc-if value=\"{{ freeShippingAvailable }}\" hint-placeholder-val=\"{{ true }}\"><div style=\"display:grid;grid-template-columns:repeat(auto-fill,minmax(258px,1fr));gap:20px;\"><sc-for list=\"{{ freeShippingProducts }}\" as=\"p\" hint-placeholder-count=\"2\"><div sc-camel-on-click=\"{{ p.open }}\" style=\"background:#fff;border:1px solid #bbf7d0;border-radius:14px;box-shadow:0 1px 2px rgba(0,0,0,.04);overflow:hidden;cursor:pointer;\"><div style=\"{{ p.imgStyle }}\"><span style=\"font:11px ui-monospace,monospace;color:rgba(15,74,40,.5);\">{{ p.imgLabel }}<\u002Fspan><\u002Fdiv><div style=\"padding:15px 16px 17px;\"><span style=\"display:inline-flex;padding:4px 9px;border-radius:999px;background:#dcfce7;color:#15803d;font-size:11px;font-weight:700;\">Free shipping<\u002Fspan><div style=\"font-weight:700;font-size:15px;margin-top:9px;color:#111827;\">{{ p.name }}<\u002Fdiv><div style=\"font-size:12.5px;color:#6b7280;margin-top:3px;\">{{ p.farm }}<\u002Fdiv><div style=\"display:flex;align-items:end;justify-content:space-between;margin-top:12px;\"><span style=\"font-weight:800;font-size:17px;color:#1a6b3c;\">{{ p.price }}<\u002Fspan><span style=\"font-size:11.5px;color:#15803d;font-weight:600;\">{{ p.slotsLabel }}<\u002Fspan><\u002Fdiv><\u002Fdiv><\u002Fdiv><\u002Fsc-for><\u002Fdiv><\u002Fsc-if>
      <\u002Fdiv>
    <\u002Fmain>
  <\u002Fsc-if>`);
}

function getBuyerVoucherScreen() {
  const tierCards = VOUCHER_TIERS.map((tier) => String.raw`<div style=\"background:#fff;border:1px solid #e5e7eb;border-radius:14px;padding:18px;display:flex;flex-direction:column;\"><div style=\"font-size:20px;font-weight:800;color:#1a6b3c;\">RM${tier.value} voucher<\u002Fdiv><div style=\"font-size:12.5px;color:#6b7280;margin-top:3px;\">Redeem RM${tier.value} &middot; ${tier.cost} pts<\u002Fdiv><sc-if value=\"{{ voucherCanRedeem${tier.value} }}\" hint-placeholder-val=\"{{ true }}\"><button sc-camel-on-click=\"{{ voucherRedeem${tier.value} }}\" style=\"width:100%;height:40px;margin-top:14px;border:none;border-radius:9px;background:#1a6b3c;color:#fff;font-size:13px;font-weight:700;cursor:pointer;\">Redeem<\u002Fbutton><\u002Fsc-if><sc-if value=\"{{ voucherCannotRedeem${tier.value} }}\" hint-placeholder-val=\"{{ false }}\"><button disabled style=\"width:100%;height:40px;margin-top:14px;border:none;border-radius:9px;background:#e5e7eb;color:#9ca3af;font-size:13px;font-weight:700;cursor:not-allowed;\">Not enough points<\u002Fbutton><\u002Fsc-if><\u002Fdiv>`).join("");
  return encodeBundledMarkup(String.raw`
  <!-- ============ VOUCHERS ============ -->
  <sc-if value=\"{{ isVouchers }}\" hint-placeholder-val=\"{{ false }}\">
    <main data-screen-label=\"Vouchers\" style=\"flex:1;margin-left:248px;\">
      <div style=\"max-width:1120px;margin:0 auto;padding:34px 24px;\">
        <div style=\"margin-bottom:22px;\"><h1 style=\"font-size:26px;font-weight:700;color:#111827;margin:0;\">Cash vouchers<\u002Fh1><p style=\"font-size:14px;color:#6b7280;margin:6px 0 0;\">Redeem your Agri Points into fixed cash vouchers, then apply one at checkout for a direct discount.<\u002Fp><\u002Fdiv>
        <div style=\"display:flex;justify-content:space-between;align-items:center;margin-bottom:18px;padding:12px 16px;border-radius:12px;background:#f9fafb;border:1px solid #e5e7eb;\"><span style=\"font-size:13px;color:#6b7280;\">Agri Points balance<\u002Fspan><strong style=\"font-size:17px;color:#1a6b3c;\">{{ karmaCredits }}<\u002Fstrong><\u002Fdiv>
        <div style=\"display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:16px;\">${tierCards}<\u002Fdiv>
        <div style=\"margin-top:26px;\"><div style=\"font-size:14px;font-weight:700;color:#111827;margin-bottom:10px;\">Your vouchers<\u002Fdiv><sc-if value=\"{{ buyerVouchersEmpty }}\" hint-placeholder-val=\"{{ true }}\"><div style=\"padding:28px 16px;border:1px dashed #d1d5db;border-radius:12px;background:#fff;color:#9ca3af;font-size:13px;text-align:center;\">No vouchers yet. Redeem points above to create one.<\u002Fdiv><\u002Fsc-if><sc-if value=\"{{ buyerVouchersAvailable }}\" hint-placeholder-val=\"{{ false }}\"><div style=\"display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:14px;\"><sc-for list=\"{{ buyerVouchers }}\" as=\"v\" hint-placeholder-count=\"2\"><div style=\"display:flex;align-items:center;justify-content:space-between;gap:12px;padding:16px;border:1px solid #bbf7d0;border-radius:12px;background:#fff;\"><span style=\"font-size:17px;font-weight:800;color:#1a6b3c;\">{{ v.valueLabel }}<\u002Fspan><span style=\"padding:4px 9px;border-radius:999px;background:#dcfce7;color:#15803d;font-size:11px;font-weight:700;\">Active<\u002Fspan><\u002Fdiv><\u002Fsc-for><\u002Fdiv><\u002Fsc-if>
      <\u002Fdiv>
      <\u002Fdiv>
    <\u002Fmain>
  <\u002Fsc-if>`);
}

function getSellerFreeShippingPanel() {
  return encodeBundledMarkup(String.raw`
            <!-- Seller free shipping -->
            <sc-if value=\"{{ isSellerShipping }}\" hint-placeholder-val=\"{{ false }}\">
              <div data-screen-label=\"Seller free shipping\">
                <h2 style=\"font-size:21px;font-weight:700;color:#111827;margin:0 0 3px;\">Free shipping promotions<\u002Fh2><p style=\"font-size:13.5px;color:#9ca3af;margin:0 0 18px;\">Sponsor shipping for a product using ${SELLER_SHIPPING_SLOT_COST} Agri Points per completed order.<\u002Fp>
                <div style=\"display:grid;grid-template-columns:1fr 1.2fr;gap:18px;align-items:start;\">
                  <div style=\"background:#fff;border:1px solid #e5e7eb;border-radius:14px;padding:18px;\"><div style=\"font-size:14px;font-weight:700;color:#111827;margin-bottom:14px;\">Create promotion<\u002Fdiv><div style=\"display:flex;justify-content:space-between;align-items:center;margin:-3px 0 14px;padding:9px 10px;border-radius:8px;background:#f9fafb;font-size:11.5px;\"><span style=\"color:#6b7280;\">Available Agri Points<\u002Fspan><strong style=\"color:#1a6b3c;\">{{ sellerAvailableKarma }}<\u002Fstrong><\u002Fdiv><label style=\"display:block;font-size:12px;font-weight:600;color:#374151;margin-bottom:5px;\">Product<\u002Flabel><select value=\"{{ promoProductId }}\" sc-camel-on-change=\"{{ onPromoProduct }}\" style=\"width:100%;height:42px;border:1px solid #d1d5db;border-radius:9px;padding:0 10px;background:#fff;font-size:13px;\"><sc-for list=\"{{ sellerShippingProducts }}\" as=\"p\" hint-placeholder-count=\"2\"><option value=\"{{ p.value }}\">{{ p.label }}<\u002Foption><\u002Fsc-for><\u002Fselect><label style=\"display:block;font-size:12px;font-weight:600;color:#374151;margin:14px 0 5px;\">Sponsored order slots<\u002Flabel><input type=\"number\" min=\"0\" max=\"{{ promoSlotLimit }}\" value=\"{{ promoSlots }}\" sc-camel-on-change=\"{{ onPromoSlots }}\" style=\"width:100%;height:42px;border:1px solid #d1d5db;border-radius:9px;padding:0 10px;font-size:13px;\"><div style=\"display:flex;justify-content:space-between;margin-top:10px;font-size:11.5px;color:#6b7280;\"><span>Cost: {{ promoCostLabel }}<\u002Fspan><span>Maximum: {{ promoSlotLimit }} slots ({{ promoMaximumCost }})<\u002Fspan><\u002Fdiv><sc-if value=\"{{ promoCanPublish }}\" hint-placeholder-val=\"{{ true }}\"><button sc-camel-on-click=\"{{ publishShippingPromo }}\" style=\"width:100%;height:42px;margin-top:14px;border:none;border-radius:9px;background:#1a6b3c;color:#fff;font-size:13px;font-weight:700;cursor:pointer;\">Publish free shipping<\u002Fbutton><\u002Fsc-if><sc-if value=\"{{ promoCannotPublish }}\" hint-placeholder-val=\"{{ false }}\"><div style=\"margin-top:12px;padding:9px;border-radius:8px;background:#fef3c7;color:#92400e;font-size:11.5px;\">Not enough Agri Points for the selected number of slots.<\u002Fdiv><\u002Fsc-if><\u002Fdiv>
                  <div style=\"background:#fff;border:1px solid #e5e7eb;border-radius:14px;overflow:hidden;\"><div style=\"padding:14px 16px;border-bottom:1px solid #e5e7eb;font-size:14px;font-weight:700;color:#111827;\">Your active promotions<\u002Fdiv><sc-if value=\"{{ sellerPromotionsEmpty }}\" hint-placeholder-val=\"{{ true }}\"><div style=\"padding:28px 16px;color:#9ca3af;font-size:13px;text-align:center;\">No free-shipping promotions yet.<\u002Fdiv><\u002Fsc-if><sc-for list=\"{{ sellerShippingPromotions }}\" as=\"p\" hint-placeholder-count=\"2\"><div style=\"display:flex;align-items:center;justify-content:space-between;gap:12px;padding:14px 16px;border-bottom:1px solid #f3f4f6;\"><div><div style=\"font-size:13.5px;font-weight:700;color:#111827;\">{{ p.productName }}<\u002Fdiv><div style=\"font-size:11.5px;color:#6b7280;margin-top:3px;\">{{ p.slotsRemaining }} of {{ p.slotsTotal }} order slots remaining<\u002Fdiv><\u002Fdiv><span style=\"padding:4px 9px;border-radius:999px;background:#dcfce7;color:#15803d;font-size:11px;font-weight:700;\">Live<\u002Fspan><\u002Fdiv><\u002Fsc-for><\u002Fdiv>
                <\u002Fdiv>
              <\u002Fdiv>
            <\u002Fsc-if>`);
}

function getCheckoutVoucherPanel() {
  return encodeBundledMarkup(String.raw`
            <div style=\"margin:13px 0;padding:12px;border:1px solid #bbf7d0;border-radius:10px;background:#f0fdf4;\">
              <div style=\"font-size:12.5px;font-weight:700;color:#15803d;\">Apply a cash voucher<\u002Fdiv>
              <select value=\"{{ selectedVoucherId }}\" sc-camel-on-change=\"{{ onSelectVoucher }}\" style=\"width:100%;height:38px;margin-top:9px;border:1px solid #bbf7d0;border-radius:8px;padding:0 10px;background:#fff;font-size:13px;outline:none;\"><option value=\"\">No voucher<\u002Foption><sc-for list=\"{{ voucherOptions }}\" as=\"v\" hint-placeholder-count=\"2\"><option value=\"{{ v.value }}\">{{ v.label }}<\u002Foption><\u002Fsc-for><\u002Fselect>
              <div style=\"display:flex;justify-content:space-between;margin-top:7px;font-size:10.5px;color:#15803d;\"><span>Redeem vouchers in the Vouchers tab<\u002Fspan><span>{{ checkoutVoucherDiscount }} discount<\u002Fspan><\u002Fdiv>
            <\u002Fdiv>`);
}

function addBuyerSidebar(html, profile) {
  const voucherRedeemBindings = VOUCHER_TIERS.map((tier) => String.raw`\n      voucherCanRedeem${tier.value}: availableWalletKarma >= ${tier.cost},\n      voucherCannotRedeem${tier.value}: availableWalletKarma < ${tier.cost},\n      voucherRedeem${tier.value}: () => { if (availableWalletKarma < ${tier.cost}) return; window.parent.postMessage({ type: '${MARKETPLACE_REWARD_MESSAGE}', action: 'redeem-voucher', value: ${tier.value}, cost: ${tier.cost} }, '*'); this.setState(st => ({ vouchers: st.vouchers.concat([{ id: 'local-voucher-' + Date.now(), value: ${tier.value}, status: 'active', createdAt: new Date().toISOString() }]), voucherKarmaSpent: st.voucherKarmaSpent + ${tier.cost} })); },`).join("");
  const withSidebar = html.replace(
    BUYER_NAV_MARKER,
    `${BUYER_NAV_MARKER}${getBuyerSidebar(profile)}`,
  );
  const productDetailMarker = String.raw`  <!-- ============ PRODUCT DETAIL ============ -->`;
  const sellerOrdersMarker = String.raw`            <!-- Orders -->`;
  const checkoutFulfillRow = String.raw`<div style=\"display:flex;justify-content:space-between;font-size:13.5px;margin-bottom:8px;color:#4b5563;\"><span>{{ fulfillLabel }}</span><span>{{ fulfillCost }}</span></div>`;
  const withRewardScreens = withSidebar
    .replace(
      productDetailMarker,
      encodeBundledMarkup(`${getBuyerFreeShippingScreen()}\n${getBuyerVoucherScreen()}\n${productDetailMarker}`),
    )
    .replace(
      sellerOrdersMarker,
      encodeBundledMarkup(`${getSellerFreeShippingPanel()}\n${sellerOrdersMarker}`),
    )
    .replace(
      checkoutFulfillRow,
      encodeBundledMarkup(`${checkoutFulfillRow}\n${getCheckoutVoucherPanel()}`),
    );
  const sellerFooter = String.raw`        <div style=\"border-top:1px solid #374151;padding:14px;\">`;
  const withSellerKarma = withRewardScreens.replace(
    sellerFooter,
    encodeBundledMarkup(`        ${getKarmaCard()}\n${sellerFooter}`),
  );
  const withRewardState = withSellerKarma
    .replace(
      String.raw`    extraListings: []\n  };`,
      String.raw`    extraListings: [],\n    vouchers: ${encodeBundledJsValue(profile.vouchers)},\n    selectedVoucherId: '',\n    voucherKarmaSpent: 0,\n    shippingPromotions: ${encodeBundledJsValue(profile.promotions)},\n    promoProductId: '3',\n    promoSlots: '1',\n    sellerPromoKarmaSpent: 0\n  };`,
    )
    .replace(
      String.raw`    const sellerTabDefs = [['dash', 'Dashboard'], ['listings', 'Listings'], ['new', 'New listing'], ['orders', 'Orders']];`,
      String.raw`    const sellerTabDefs = [['dash', 'Dashboard'], ['listings', 'Listings'], ['new', 'New listing'], ['shipping', 'Free shipping'], ['orders', 'Orders']];\n    const shippingPromo = s.shippingPromotions.find(promo => promo.slotsRemaining > 0 && s.cart.some(item => item.id === promo.productId));\n    const payableBeforeVoucher = subtotalN + (shippingPromo ? 0 : fSel.cost);\n    const availableWalletKarma = Math.max(0, ${profile.credits} - s.sellerPromoKarmaSpent - s.voucherKarmaSpent);\n    const appliedVoucher = s.vouchers.find(v => v.status === 'active' && v.id === s.selectedVoucherId);\n    const voucherDiscount = appliedVoucher ? Math.min(appliedVoucher.value, payableBeforeVoucher) : 0;\n    const sellerAvailableKarma = availableWalletKarma;\n    const sellerPromoSlotLimit = Math.floor(sellerAvailableKarma / ${SELLER_SHIPPING_SLOT_COST});\n    const sellerSelectedSlots = Math.max(0, Math.min(sellerPromoSlotLimit, parseInt(s.promoSlots, 10) || 0));\n    const buyerTabStyle = (active) => 'display:flex;align-items:center;gap:10px;text-align:left;height:40px;padding:0 12px;border:none;border-radius:9px;font-size:13.5px;font-weight:' + (active ? '600' : '500') + ';cursor:pointer;width:100%;background:' + (active ? '#374151' : 'none') + ';color:' + (active ? '#fff' : '#9ca3af') + ';';\n    const buyerDotStyle = (active) => 'width:6px;height:6px;border-radius:999px;flex:none;background:' + (active ? '#e8b84b' : '#4b5563') + ';';`,
    )
    .replace(
      String.raw`      goCart: () => this.setState({ screen: 'cart' }),\n      goCheckout: () => this.setState({ screen: 'checkout' }),`,
      String.raw`      goCart: () => this.setState({ screen: 'cart' }),\n      goFreeShipping: () => this.setState({ screen: 'freeShipping' }),\n      goVouchers: () => this.setState({ screen: 'vouchers' }),\n      buyerHomeTabStyle: buyerTabStyle(s.screen !== 'freeShipping' && s.screen !== 'vouchers'),\n      buyerShippingTabStyle: buyerTabStyle(s.screen === 'freeShipping'),\n      buyerVoucherTabStyle: buyerTabStyle(s.screen === 'vouchers'),\n      buyerHomeDotStyle: buyerDotStyle(s.screen !== 'freeShipping' && s.screen !== 'vouchers'),\n      buyerShippingDotStyle: buyerDotStyle(s.screen === 'freeShipping'),\n      buyerVoucherDotStyle: buyerDotStyle(s.screen === 'vouchers'),\n      karmaCredits: availableWalletKarma,\n      karmaLevel: '${profile.creditLevel}',\n      karmaProgressStyle: 'height:100%;width:${profile.creditPercent}%;background:#e8b84b;border-radius:999px;',\n      karmaCreditLabel: '${profile.creditLabel}',${voucherRedeemBindings}\n      buyerVouchers: s.vouchers.filter(v => v.status === 'active').map(v => ({ id: v.id, valueLabel: 'RM' + v.value })),\n      buyerVouchersEmpty: !s.vouchers.some(v => v.status === 'active'),\n      buyerVouchersAvailable: s.vouchers.some(v => v.status === 'active'),\n      voucherOptions: s.vouchers.filter(v => v.status === 'active').map(v => ({ value: v.id, label: 'RM' + v.value + ' voucher' })),\n      selectedVoucherId: appliedVoucher ? s.selectedVoucherId : '',\n      onSelectVoucher: (e) => this.setState({ selectedVoucherId: e.target.value }),\n      checkoutVoucherDiscount: this.fmt(voucherDiscount),\n      goCheckout: () => this.setState({ screen: 'checkout', selectedVoucherId: '' }),`,
    )
    .replace(
      String.raw`      isProduct: s.screen === 'product',`,
      String.raw`      isProduct: s.screen === 'product',\n      isFreeShipping: s.screen === 'freeShipping',\n      isVouchers: s.screen === 'vouchers',\n      freeShippingProducts: s.shippingPromotions.filter(promo => promo.slotsRemaining > 0).map(promo => { const product = all.find(p => p.id === promo.productId); if (!product) return null; return Object.assign(this.decorate(product), { slotsLabel: promo.slotsRemaining + ' order slot' + (promo.slotsRemaining === 1 ? '' : 's') + ' left' }); }).filter(Boolean),\n      freeShippingEmpty: !s.shippingPromotions.some(promo => promo.slotsRemaining > 0 && all.some(p => p.id === promo.productId)),\n      freeShippingAvailable: s.shippingPromotions.some(promo => promo.slotsRemaining > 0 && all.some(p => p.id === promo.productId)),`,
    )
    .replace(
      String.raw`      fulfillCost: fSel.cost === 0 ? 'Free' : this.fmt(fSel.cost),\n      subtotal: this.fmt(subtotalN),\n      total: this.fmt(subtotalN + fSel.cost),`,
      String.raw`      fulfillCost: shippingPromo ? 'Free (seller sponsored)' : (fSel.cost === 0 ? 'Free' : this.fmt(fSel.cost)),\n      subtotal: this.fmt(subtotalN),\n      total: this.fmt(Math.max(0, payableBeforeVoucher - voucherDiscount)),`,
    )
    .replace(
      String.raw`      placeOrder: () => this.setState({ screen: 'confirm', cart: [] }),`,
      String.raw`      placeOrder: () => {\n        if (shippingPromo) window.parent.postMessage({ type: '${MARKETPLACE_REWARD_MESSAGE}', action: 'claim-free-shipping', promotionId: shippingPromo.id, productId: shippingPromo.productId }, '*');\n        if (appliedVoucher) window.parent.postMessage({ type: '${MARKETPLACE_REWARD_MESSAGE}', action: 'apply-voucher', voucherId: appliedVoucher.id }, '*');\n        this.setState(st => ({ screen: 'confirm', cart: [], selectedVoucherId: '', vouchers: appliedVoucher ? st.vouchers.map(v => v.id === appliedVoucher.id ? Object.assign({}, v, { status: 'used' }) : v) : st.vouchers }));\n      },`,
    )
    .replace(
      String.raw`      isSellerOrders: s.sellerTab === 'orders',`,
      String.raw`      isSellerOrders: s.sellerTab === 'orders',\n      isSellerShipping: s.sellerTab === 'shipping',\n      sellerShippingProducts: sellerListings.map(p => ({ value: String(p.id), label: p.name })),\n      promoProductId: s.promoProductId,\n      onPromoProduct: (e) => this.setState({ promoProductId: e.target.value }),\n      promoSlots: String(sellerSelectedSlots),\n      onPromoSlots: (e) => this.setState({ promoSlots: String(Math.max(0, Math.min(sellerPromoSlotLimit, parseInt(e.target.value, 10) || 0))) }),\n      sellerAvailableKarma: String(sellerAvailableKarma),\n      promoSlotLimit: String(sellerPromoSlotLimit),\n      promoMaximumCost: (sellerPromoSlotLimit * ${SELLER_SHIPPING_SLOT_COST}) + ' Agri Points',\n      promoCostLabel: (sellerSelectedSlots * ${SELLER_SHIPPING_SLOT_COST}) + ' Agri Points',\n      promoCanPublish: sellerSelectedSlots > 0 && sellerSelectedSlots * ${SELLER_SHIPPING_SLOT_COST} <= sellerAvailableKarma,\n      promoCannotPublish: sellerSelectedSlots < 1 || sellerSelectedSlots * ${SELLER_SHIPPING_SLOT_COST} > sellerAvailableKarma,\n      publishShippingPromo: () => {\n        const slots = sellerSelectedSlots;\n        const product = sellerListings.find(p => String(p.id) === String(s.promoProductId));\n        const cost = slots * ${SELLER_SHIPPING_SLOT_COST};\n        if (!product || slots < 1 || cost > sellerAvailableKarma) return;\n        window.parent.postMessage({ type: '${MARKETPLACE_REWARD_MESSAGE}', action: 'publish-free-shipping', productId: product.id, productName: product.name, slots }, '*');\n        this.setState(st => ({ shippingPromotions: [{ id: 'local-' + Date.now(), sellerEmail: '${profile.email}', sellerName: '${profile.name}', productId: product.id, productName: product.name, slotsTotal: slots, slotsRemaining: slots, isMine: true }].concat(st.shippingPromotions), sellerPromoKarmaSpent: st.sellerPromoKarmaSpent + cost, promoSlots: sellerAvailableKarma - cost >= ${SELLER_SHIPPING_SLOT_COST} ? '1' : '0' }));\n      },\n      sellerShippingPromotions: s.shippingPromotions.filter(p => p.isMine && p.slotsRemaining > 0),\n      sellerPromotionsEmpty: !s.shippingPromotions.some(p => p.isMine && p.slotsRemaining > 0),`,
    );

  return BUYER_LAYOUT_REPLACEMENTS.reduce(
    (currentHtml, [search, replacement]) => currentHtml.replace(search, replacement),
    withRewardState,
  );
}

function getMarketplaceSource(canSell, profile) {
  const marketplaceHtml = addBuyerSidebar(atob(MARKETPLACE_B64), profile);

  if (canSell) {
    const sellerEnabledHtml = SELLER_VIEW_REPLACEMENTS.reduce(
      (html, [search, replacement]) => html.replace(search, replacement),
      marketplaceHtml,
    );
    return DATA_URL_PREFIX + btoa(sellerEnabledHtml);
  }

  // The embedded prototype has its own navigation. Remove its seller entry
  // points and neutralise the seller transitions for buyer-only accounts.
  const buyerOnlyHtml = BUYER_ONLY_REPLACEMENTS.reduce(
    (html, [search, replacement]) => html.replace(search, replacement),
    marketplaceHtml,
  );

  return DATA_URL_PREFIX + btoa(buyerOnlyHtml);
}

export default function Marketplace() {
  const { user, isAdmin } = useApp();
  const iframeRef = useRef(null);
  const canSell = isAdmin || user?.role === "seller";
  const community = useMemo(() => loadCommunityState(user), [user]);
  const marketplaceRewards = useMemo(() => loadMarketplaceRewards(), []);
  const creditProgress = useMemo(() => getCreditProgress(community.credits), [community.credits]);
  const profile = useMemo(() => ({
    name: escapeMarkupText(user?.name || "Guest Farmer"),
    email: escapeMarkupText(user?.email || "guest@example.com"),
    initial: escapeMarkupText((user?.name || "F").trim().charAt(0).toUpperCase()),
    roleLabel: user?.role === "seller" ? "Seller - Buyer mode" : "Farmer - Buyer",
    credits: community.credits,
    creditLevel: creditProgress.name,
    creditPercent: creditProgress.percent,
    creditLabel: creditProgress.remaining
      ? `${creditProgress.remaining} Agri Points to next level`
      : "Highest community level reached",
    canRedeem: Boolean(user),
    vouchers: (community.vouchers || [])
      .filter((voucher) => voucher.status === "active")
      .map((voucher) => ({
        id: escapeMarkupText(String(voucher.id).slice(0, 80)),
        value: Number(voucher.value),
        status: "active",
      })),
    promotions: (marketplaceRewards.promotions || []).map((promotion) => ({
      id: escapeMarkupText(String(promotion.id).slice(0, 80)),
      sellerEmail: escapeMarkupText(String(promotion.sellerEmail || "").slice(0, 120)),
      sellerName: escapeMarkupText(String(promotion.sellerName || "Marketplace Seller").slice(0, 80)),
      productId: Number(promotion.productId),
      productName: escapeMarkupText(String(promotion.productName || "Product").slice(0, 80)),
      slotsTotal: Math.max(0, Number(promotion.slotsTotal) || 0),
      slotsRemaining: Math.max(0, Number(promotion.slotsRemaining) || 0),
      isMine: Boolean(user?.email && promotion.sellerEmail === user.email),
    })),
    sellerShippingSlotLimit: Math.floor(community.credits / SELLER_SHIPPING_SLOT_COST),
  }), [community, creditProgress, marketplaceRewards.promotions, user]);
  const source = useMemo(() => getMarketplaceSource(canSell, profile), [canSell, profile]);

  useEffect(() => {
    const handleMarketplaceMessage = (event) => {
      if (
        event.source !== iframeRef.current?.contentWindow
        || event.data?.type !== MARKETPLACE_REWARD_MESSAGE
        || !user
      ) return;

      const current = loadCommunityState(user);
      const action = event.data.action;

      if (action === "redeem-voucher") {
        const cost = Math.floor(Number(event.data.cost) || 0);
        const value = Math.floor(Number(event.data.value) || 0);
        const tier = VOUCHER_TIERS.find((t) => t.value === value && t.cost === cost);
        if (!tier || current.credits < cost) return;

        saveCommunityState(user, {
          ...current,
          credits: current.credits - cost,
          vouchers: [...(current.vouchers || []), createVoucher(value)],
          creditLedger: [{
            id: `credit-voucher-${Date.now()}`,
            amount: -cost,
            label: `Redeemed RM${value} voucher`,
            createdAt: new Date().toISOString(),
          }, ...(current.creditLedger || [])],
        });
        return;
      }

      if (action === "apply-voucher") {
        const voucherId = String(event.data.voucherId || "");
        saveCommunityState(user, {
          ...current,
          vouchers: (current.vouchers || []).map((voucher) =>
            voucher.id === voucherId ? { ...voucher, status: "used" } : voucher,
          ),
        });
        return;
      }

      if (action === "publish-free-shipping" && canSell) {
        const slots = Math.max(1, Math.min(25, Number(event.data.slots) || 1));
        const cost = slots * SELLER_SHIPPING_SLOT_COST;
        const productId = Number(event.data.productId);
        const productName = String(event.data.productName || "").trim();
        if (!productId || !productName || current.credits < cost) return;

        const rewards = loadMarketplaceRewards();
        const promotion = createShippingPromotion({ seller: user, productId, productName, slots });
        saveMarketplaceRewards({
          ...rewards,
          promotions: [promotion, ...(rewards.promotions || [])],
        });
        saveCommunityState(user, {
          ...current,
          credits: current.credits - cost,
          creditLedger: [{
            id: `credit-shipping-promo-${Date.now()}`,
            amount: -cost,
            label: `${slots} free-shipping order slot${slots === 1 ? "" : "s"} for ${productName}`,
            createdAt: new Date().toISOString(),
          }, ...(current.creditLedger || [])],
        });
        return;
      }

      if (action === "claim-free-shipping") {
        const promotionId = String(event.data.promotionId || "");
        const productId = Number(event.data.productId);
        const rewards = loadMarketplaceRewards();
        let claimed = false;
        saveMarketplaceRewards({
          ...rewards,
          promotions: (rewards.promotions || []).map((promotion) => {
            const matches = promotion.id === promotionId || promotion.productId === productId;
            if (!claimed && matches && promotion.slotsRemaining > 0) {
              claimed = true;
              return { ...promotion, slotsRemaining: promotion.slotsRemaining - 1 };
            }
            return promotion;
          }),
        });
      }
    };

    window.addEventListener("message", handleMarketplaceMessage);
    return () => window.removeEventListener("message", handleMarketplaceMessage);
  }, [canSell, user]);

  return (
    <div className="h-screen w-screen flex flex-col bg-primary-dark">
      {/* Slim brand bar to get back into the rest of the app */}
      <div className="flex-none flex items-center gap-3 px-4 h-11 text-white">
        <Link to="/" className="flex items-center gap-1.5 text-green-100 hover:text-white text-sm font-medium">
          <ArrowLeft size={16} /> Back to AgriScheme
        </Link>
        <span className="mx-1 text-white/30">|</span>
        <div className="flex items-center gap-1.5">
          <Leaf size={15} className="text-accent" />
          <span className="text-sm font-semibold">AgriScheme Marketplace</span>
          {!canSell && (
            <span className="rounded-full bg-white/10 px-2 py-0.5 text-xs font-medium text-green-100">
              Buyer view
            </span>
          )}
        </div>
      </div>
      <iframe
        ref={iframeRef}
        title="AgriScheme Marketplace"
        src={source}
        className="flex-1 w-full border-0 bg-white"
      />
    </div>
  );
}
