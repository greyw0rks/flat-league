import { z } from 'zod';
import { encodeAbiParameters, keccak256, concat, stringToHex, type Address, type Hex } from 'viem';

export const questionSchema = z.object({
  id: z.string().min(1).max(40), prompt: z.string().min(8).max(600),
  options: z.array(z.object({ id: z.string().min(1).max(40), text: z.string().min(1).max(250) })).length(4),
  correctOption: z.string().min(1).max(40)
}).superRefine((q, ctx) => {
  if (new Set(q.options.map(o => o.id)).size !== 4 || !q.options.some(o => o.id === q.correctOption))
    ctx.addIssue({ code: 'custom', message: 'Options must have unique IDs and a valid correct option.' });
});
export type Question = z.infer<typeof questionSchema>;
export const draftSchema = z.object({
  title: z.string().trim().min(4).max(80), description: z.string().trim().min(12).max(1000),
  pool: z.string().regex(/^\d+(\.\d{1,18})?$/),
  startAt: z.number().int().positive(), endAt: z.number().int().positive(),
  maxParticipants: z.number().int().min(1).max(1000), questions: z.array(questionSchema).length(10)
}).superRefine((d, ctx) => {
  if (d.endAt < d.startAt + 120_000 || d.endAt > d.startAt + 7 * 86400_000)
    ctx.addIssue({ code: 'custom', message: 'Choose a competition window between two minutes and seven days.' });
  if (new Set(d.questions.map(q => q.id)).size !== 10)
    ctx.addIssue({ code: 'custom', message: 'Question IDs must be unique.' });
});
export type DraftInput = z.infer<typeof draftSchema>;
export type CompetitionStatus = 'upcoming' | 'live' | 'awaiting' | 'expired' | 'finalized' | 'cancelled' | 'refunded';
export interface CompetitionView {
  id: string; onchainId: string; creator: Address; title: string; description: string;
  pool: string; startAt: number; endAt: number; finalizeBy: number; maxParticipants: number;
  participantCount: number; status: CompetitionStatus; rulesHash: Hex; questionCommitment: Hex;
  resultSigner: Address; registrar: Address; fundingHash: Hex; settlementHash: Hex | null;
  joined?: boolean; registrationStatus?: string; attemptId?: string; attemptState?: string;
}
export interface Standing {
  wallet: Address; score: number; elapsedMs: number; startedAt: number;
  rank: number; reward: string; paid: boolean; txHash: Hex | null;
}
export interface AttemptView {
  id: string; competitionId: string; state: string; deadline: number; serverNow: number;
  accepted: number; question: Omit<Question, 'correctOption'> | null;
}
export interface Payout { winner: Address; score: number; elapsedMs: number; amount: bigint }

export function canonical(value: unknown): string {
  if (Array.isArray(value)) return '[' + value.map(canonical).join(',') + ']';
  if (value !== null && typeof value === 'object') {
    const v = value as Record<string, unknown>;
    return '{' + Object.keys(v).sort().map(k => JSON.stringify(k) + ':' + canonical(v[k])).join(',') + '}';
  }
  return JSON.stringify(value);
}
export function hashArtifact(value: unknown): Hex { return keccak256(stringToHex(canonical(value))); }
export function commitQuestions(questions: Question[], salt: Hex): Hex {
  return keccak256(concat([stringToHex(canonical({ version: 1, questions })), salt]));
}
export function competitionStatus(state: number, start: number, end: number, finalizeBy: number, now = Date.now()): CompetitionStatus {
  if (state === 1) return 'finalized'; if (state === 2) return 'cancelled'; if (state === 3) return 'refunded';
  if (now >= finalizeBy) return 'expired'; if (now >= end) return 'awaiting';
  return now >= start ? 'live' : 'upcoming';
}
export function rankAttempts<T extends { wallet: string; score: number; elapsedMs: number; startedAt: number }>(rows: T[]): T[] {
  return [...rows].sort((a, b) => b.score - a.score || a.elapsedMs - b.elapsedMs || a.startedAt - b.startedAt || (BigInt(a.wallet) < BigInt(b.wallet) ? -1 : BigInt(a.wallet) > BigInt(b.wallet) ? 1 : 0));
}
export function allocatePool(pool: bigint, count: number): bigint[] {
  const weights = [60n, 25n, 15n].slice(0, Math.min(3, count));
  if (!weights.length) return [];
  const denominator = weights.reduce((s, n) => s + n, 0n);
  const payouts = weights.map(w => pool * w / denominator);
  payouts[0] += pool - payouts.reduce((s, n) => s + n, 0n);
  return payouts;
}
export const resultTypes = { Result: [
  { name: 'competitionId', type: 'uint256' }, { name: 'rulesHash', type: 'bytes32' },
  { name: 'resultArtifactHash', type: 'bytes32' }, { name: 'payoutsHash', type: 'bytes32' },
  { name: 'nonce', type: 'uint256' }, { name: 'validUntil', type: 'uint64' }
] } as const;
export const noContestTypes = { NoContest: [
  { name: 'competitionId', type: 'uint256' }, { name: 'rulesHash', type: 'bytes32' },
  { name: 'resultArtifactHash', type: 'bytes32' }, { name: 'nonce', type: 'uint256' }, { name: 'validUntil', type: 'uint64' }
] } as const;
const payoutTypeHash = keccak256(stringToHex('Payout(address winner,uint16 score,uint32 elapsedMs,uint256 amount)'));
export function hashPayouts(payouts: Payout[]): Hex {
  const hashes = payouts.map(p => keccak256(encodeAbiParameters(
    [{ type: 'bytes32' }, { type: 'address' }, { type: 'uint16' }, { type: 'uint32' }, { type: 'uint256' }],
    [payoutTypeHash, p.winner, p.score, p.elapsedMs, p.amount]
  )));
  return keccak256(concat(hashes));
}
