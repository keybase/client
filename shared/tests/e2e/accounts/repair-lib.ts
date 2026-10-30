// Pure pieces of setup's repair of a block flow's leftovers (setup.mts), kept apart for unit tests.

// The prefix every e2e test account's username has. The repair writes to the accounts (blocks, a
// conversation's status, favorites), so it acts only on accounts that have it.
export const TEST_ACCOUNT_PREFIX = 'cnojima106'

// Why the repair must not write, or undefined when both accounts are test accounts. Never names an
// account.
export const notTestAccountsProblem = (smokeUser: string, secondUser: string) =>
  smokeUser.startsWith(TEST_ACCOUNT_PREFIX) && secondUser.startsWith(TEST_ACCOUNT_PREFIX)
    ? undefined
    : `refusing to repair: KB_SMOKE_USER and KB_SECOND_USER must both be e2e test accounts (names starting ${TEST_ACCOUNT_PREFIX})`

// The env file's record that the smoke+second folder was a favorite, set by setup once it has seen
// it so; the repair makes an ignored folder a favorite again only when it is set.
export const PAIR_FAVORITE_VAR = 'KB_PAIR_FOLDER_FAVORITE'
export const pairWasFavorite = (vars: Record<string, string | undefined>) => vars[PAIR_FAVORITE_VAR] === '1'
