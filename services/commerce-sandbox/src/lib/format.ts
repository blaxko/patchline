export const ORDER_ID_RE = /^[A-Z]{2,3}-[A-Z0-9]{4}$/;
export const TRACKING_ID_RE = /^TRK-\d{4,6}$/;
export const SKU_RE = /^[A-Z0-9]+(-[A-Z0-9]+)*$/;

export function isValidOrderIdFormat(orderId: string): boolean {
  return ORDER_ID_RE.test(orderId);
}

export function isValidTrackingIdFormat(trackingId: string): boolean {
  return TRACKING_ID_RE.test(trackingId);
}

export function isValidSkuFormat(sku: string): boolean {
  return SKU_RE.test(sku);
}
