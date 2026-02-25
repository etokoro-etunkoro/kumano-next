export type RenominationState = {
  pendingBlocks: string[];
  emptySlots: Array<{ block: string; count: number }>;
} | null;

export type RenominationInput = Record<string, string[]>;
