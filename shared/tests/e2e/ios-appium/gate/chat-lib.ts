// Pure pieces of the iOS chat helpers (helpers/chat.ts), kept apart so they can be unit-tested.
import {isDeepStrictEqual} from 'util'

// Whether an inbox row's accessibility label is the row of `name`. A small conversation's row reads
// "<name>, <time>, <snippet>", so the name is its whole first field (a name holding ", " spans
// several): a row of a longer name that starts with `name` is not it. A big team's channel row reads
// "# <channel>" and is asked for as "#<channel>".
export const inboxRowMatches = (label: string, name: string) => {
  if (!name) return false
  const l = label.replace(/^# /, '#')
  return l === name || l.startsWith(`${name}, `)
}

// Why a value read back after a relaunch is not the one wanted, or undefined when it is.
export const persistedMismatch = (what: string, got: unknown, want: unknown) =>
  isDeepStrictEqual(got, want) ? undefined : `${what} after a relaunch: ${JSON.stringify(got)}, want ${JSON.stringify(want)}`
