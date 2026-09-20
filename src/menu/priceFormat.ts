const currencySuffixPattern = /^\s*([\d,.]+)\s*(\$|usd|lbp|l\.l\.|ل\.ل)\s*$/i;
const currencyPrefixPattern = /^\s*(\$|usd|lbp|l\.l\.|ل\.ل)\s*([\d,.]+)\s*$/i;

export type PriceCurrency = "USD" | "LBP";

function formatNumber(value: number, useGrouping: boolean) {
  return new Intl.NumberFormat("en-US", {
    useGrouping,
    minimumFractionDigits: Number.isInteger(value) ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(value);
}

function normalizeCurrency(currency: string): PriceCurrency {
  return currency === "$" || currency.toUpperCase() === "USD" ? "USD" : "LBP";
}

function parseCurrencyPrice(price: string) {
  const trimmedPrice = price.trim();
  const suffixMatch = trimmedPrice.match(currencySuffixPattern);
  const prefixMatch = trimmedPrice.match(currencyPrefixPattern);
  const amount = suffixMatch?.[1] ?? prefixMatch?.[2] ?? trimmedPrice;
  const currency = normalizeCurrency(suffixMatch?.[2] ?? prefixMatch?.[1] ?? "$");
  const numericAmount = Number.parseFloat(amount.replaceAll(",", ""));

  if (!amount || Number.isNaN(numericAmount)) return null;
  return { amount, currency, numericAmount };
}

export function priceInputValue(price: string, fallbackCurrency: PriceCurrency = "USD"): { readonly amount: string; readonly currency: PriceCurrency } {
  const parsedPrice = parseCurrencyPrice(price);
  if (!parsedPrice) return { amount: "", currency: fallbackCurrency };
  return { amount: parsedPrice.amount, currency: parsedPrice.currency };
}

export function priceFromInput(amount: string, currency: PriceCurrency) {
  const normalizedAmount = amount.trim();
  if (!normalizedAmount) return "";
  return currency === "USD" ? normalizedAmount : `${normalizedAmount} LBP`;
}

export function formatPrice(price: string) {
  const parsedPrice = parseCurrencyPrice(price);
  if (!parsedPrice) return "";

  if (parsedPrice.currency === "USD") return `$${parsedPrice.amount}`;
  return `${parsedPrice.amount} ${parsedPrice.currency}`;
}

export function formatPriceTotal(price: string, quantity: number) {
  const parsedPrice = parseCurrencyPrice(price);
  if (!parsedPrice) return "";

  const total = formatNumber(parsedPrice.numericAmount * quantity, parsedPrice.amount.includes(","));
  if (parsedPrice.currency === "USD") return `$${total}`;
  return `${total} ${parsedPrice.currency}`;
}
