export const AI_SYNC_EVENT = "krishmitra:ai-sync";

export function emitAiSyncRefresh(reason = "ai") {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(AI_SYNC_EVENT, { detail: { reason } }));
}

export function subscribeAiSyncRefresh(handler) {
  if (typeof window === "undefined") return () => {};
  const wrapped = (event) => handler?.(event?.detail?.reason);
  window.addEventListener(AI_SYNC_EVENT, wrapped);
  return () => window.removeEventListener(AI_SYNC_EVENT, wrapped);
}
