export const EVM_ADDR = /^0x[0-9a-fA-F]{40}$/;

export interface CaState {
  live: boolean;
  text: string;
  date: string | null;
}

// Inert until stated: only a well-formed address activates the slot.
// The date is shown only when both an address and a date are set.
export function caState(ca: string, date: string): CaState {
  if (!EVM_ADDR.test(ca)) return { live: false, text: "Not yet announced", date: null };
  return { live: true, text: ca, date: date || null };
}
