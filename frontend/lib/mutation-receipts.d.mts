type MutationFailure = { success: false; error: string };
type MutationSuccess<T extends object = object> = { success: true } & T;
type MutationResult<T extends object = object> = MutationSuccess<T> | MutationFailure;

type Receipt = {
  id: string;
  userId: string;
  kind: string;
  requestKey: string;
  fingerprint: string;
  resultId: string | null;
  xpAwarded: number;
  createdAt: Date;
};

type DbLike = Record<string, any>;

export function mutationFingerprint(value: unknown): string;
export function normalizedDeckNameKey(name: string): string;
export function isDeckNameConflict(error: unknown): boolean;

export function readMutationReplay<T extends object>(input: {
  userId: string;
  kind: string;
  requestKey: string;
  fingerprint: string;
  replay: (receipt: Receipt, db: DbLike) => Promise<MutationResult<T>> | MutationResult<T>;
}): Promise<MutationResult<T> | null>;

export function runMutationWithReceipt<T extends object>(input: {
  userId: string;
  kind: string;
  requestKey: string;
  fingerprint: string;
  replay: (receipt: Receipt, db: DbLike) => Promise<MutationResult<T>> | MutationResult<T>;
}, operation: (tx: DbLike) => Promise<(MutationResult<T> & { receiptResultId?: string; receiptXpAwarded?: number })>): Promise<MutationResult<T>>;

export function createDeckForUser(userId: string, name: string, requestKey: string): Promise<MutationResult<{ deck: { id: string; userId: string; nome: string; nameKey: string | null; createdAt: Date } }>>;

export function persistStudyPlanForUser(userId: string, planData: {
  title: string;
  description: string | null;
  difficulty: string;
  topics: { title: string }[];
}, requestKey: string, intentFingerprint: string): Promise<MutationResult<{ planoId: string }>>;

export function persistTopicCardsForUser(userId: string, topicId: string, cards: { frente: string; verso: string }[], requestKey: string): Promise<MutationResult>;
