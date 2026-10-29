/**
 * Shared configuration and currency definitions for AgentCart AI.
 * Single source of truth for exchange rates and currency codes across backend and frontend.
 */

// Fixed demonstration exchange rate (1 USD = 85 INR).
// Kept at existing rate of 85; explicitly marked as fixed demonstration rate (not a live floating rate).
const INR_TO_USD_RATE = Number(process.env.INR_TO_USD_RATE) || 85;

// PayPal checkout transaction currency (must be a valid 3-letter currency code supported by PayPal, e.g. USD)
const PAYPAL_CURRENCY = (process.env.PAYPAL_CURRENCY || 'USD').trim().toUpperCase();

// Shipping thresholds & fees (in INR)
const FREE_SHIPPING_THRESHOLD = 2000;
const STANDARD_SHIPPING_FEE = 150;

// PayPal Sandbox API Base URL
const PAYPAL_API_BASE = 'https://api-m.sandbox.paypal.com';

module.exports = {
  INR_TO_USD_RATE,
  PAYPAL_CURRENCY,
  FREE_SHIPPING_THRESHOLD,
  STANDARD_SHIPPING_FEE,
  PAYPAL_API_BASE
};
