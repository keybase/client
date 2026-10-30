// Pure pieces of the block checks (blocks.ts), kept apart so they can be unit-tested.

export type Blocks = {chatBlocked: boolean; followBlocked: boolean}
export const UNBLOCKED: Blocks = {chatBlocked: false, followBlocked: false}

type UserBlock = {chatBlocked?: boolean; followBlocked?: boolean; username: string}

// `username`'s blocks in a user.getUserBlocks answer: none when it is not listed.
export const blocksOf = (res: ReadonlyArray<UserBlock> | null | undefined, username: string): Blocks => {
  const b = res?.find(r => r.username === username)
  return {chatBlocked: !!b?.chatBlocked, followBlocked: !!b?.followBlocked}
}

// Why the flows that need the second account cannot run while the smoke account blocks it, or
// undefined when it does not. Never names an account.
export const secondBlockedProblem = (b: Blocks) =>
  b.chatBlocked || b.followBlocked
    ? `the smoke account has the second account blocked (${b.chatBlocked ? 'chat' : 'followers'}): a chat-blocks restore failed; unblock it before running the flows that need the second account`
    : undefined
