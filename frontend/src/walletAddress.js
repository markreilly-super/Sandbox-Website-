// Maps the address data an express wallet hands back on
// `superpayments:expressCheckoutConfirmed` into the shape the Super API's
// /proceed endpoint expects.
//
// Two things make this necessary:
//
// 1. The SDK does NOT normalise addresses. Apple Pay and Google Pay each
//    return their own raw structure (ApplePayBillingContact vs
//    GooglePayBillingAddress) and the merchant has to branch on `detail.type`.
//
// 2. Neither wallet shape matches the /proceed address shape, which is
//    { firstName, lastName, addressLine1, addressLine2, addressLine3,
//      city, country, postCode, email, phone }.
//
// Only brands on Adyen populate `event.detail`. On a Stripe-backed brand the
// SDK dispatches the confirmed event with NO detail at all, so callers must
// cope with `null` coming back from here rather than assuming an address.

// /proceed has no state / county / province field, so `administrativeArea`
// ("NSW", "CA", …) is deliberately dropped — there is nowhere to put it.
// Google Pay also returns '' for a missing line rather than omitting it, and
// an empty string is not the same as "not supplied", so blanks are stripped.
const clean = (obj) => {
  const out = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v === null || v === undefined) continue;
    const s = typeof v === 'string' ? v.trim() : v;
    if (s === '') continue;
    out[k] = s;
  }
  return out;
};

// Google Pay gives one `name` string; /proceed wants it split. Everything
// after the first token becomes the surname, so "Mary Jane Watson" yields
// "Mary" / "Jane Watson". A single token yields a firstName and no lastName
// rather than a fabricated one.
const splitName = (name) => {
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return { firstName: null, lastName: null };
  return {
    firstName: parts[0],
    lastName: parts.length > 1 ? parts.slice(1).join(' ') : null,
  };
};

const fromApplePay = (addr, fallbackEmail) => {
  const lines = Array.isArray(addr.addressLines) ? addr.addressLines : [];
  return clean({
    firstName: addr.givenName,
    lastName: addr.familyName,
    addressLine1: lines[0],
    addressLine2: lines[1],
    // Apple can return more than three lines; keep the overflow rather than
    // silently truncating the address.
    addressLine3: lines.length > 3 ? lines.slice(2).join(', ') : lines[2],
    city: addr.locality,
    country: addr.countryCode,
    postCode: addr.postalCode,
    email: addr.emailAddress || fallbackEmail,
    phone: addr.phoneNumber,
  });
};

const fromGooglePay = (addr, fallbackEmail) => {
  const { firstName, lastName } = splitName(addr.name);
  return clean({
    firstName,
    lastName,
    addressLine1: addr.address1,
    addressLine2: addr.address2,
    addressLine3: addr.address3,
    city: addr.locality,
    country: addr.countryCode,
    postCode: addr.postalCode,
    // Google Pay carries the email on the event, not inside the address.
    email: addr.emailAddress || fallbackEmail,
    phone: addr.phoneNumber,
  });
};

const pickAddress = (addr, type, fallbackEmail) => {
  if (!addr || typeof addr !== 'object') return null;
  const mapped = type === 'applepay'
    ? fromApplePay(addr, fallbackEmail)
    : fromGooglePay(addr, fallbackEmail);
  return Object.keys(mapped).length ? mapped : null;
};

/**
 * Turn a wallet confirmation `event.detail` into /proceed address fields.
 *
 * @param {object|undefined} detail - `event.detail` from the SDK. Undefined on
 *   Stripe-backed brands.
 * @returns {{type: string, email: string|null, billingAddress: object|null,
 *   shippingAddress: object|null}|null} null when there is nothing usable.
 */
export const walletAddressesForProceed = (detail) => {
  if (!detail || !detail.type) return null;
  const email = detail.email || null;
  return {
    type: detail.type,
    email,
    billingAddress: pickAddress(detail.billingAddress, detail.type, email),
    shippingAddress: pickAddress(detail.shippingAddress, detail.type, email),
  };
};

/**
 * Build the address part of a /proceed body. Spread straight into the request:
 * returns {} when the wallet gave nothing, so the backend keeps its own
 * defaults instead of being handed empty objects.
 */
export const proceedAddressFields = (detail) => {
  const w = walletAddressesForProceed(detail);
  if (!w) return {};
  const body = {};
  if (w.billingAddress) body.billingAddress = w.billingAddress;
  if (w.shippingAddress) body.shippingAddress = w.shippingAddress;
  // Some wallets return only one of the two. Billing is the one the API cares
  // about for AVS, so fall back to the shipping address rather than letting the
  // backend substitute a hardcoded test address.
  if (!body.billingAddress && w.shippingAddress) body.billingAddress = w.shippingAddress;
  if (!body.shippingAddress && w.billingAddress) body.shippingAddress = w.billingAddress;
  return body;
};

export default proceedAddressFields;
