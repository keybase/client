// The smoke account's follow of the second account, read from `keybase list-following` on the host
// and put back from the CLI. Only the second account is ever followed or unfollowed here, and an
// error names no account. Framework-free: shared by the desktop and iOS flows.
import {loadE2EAccounts} from '../accounts/env.ts'
import {maskAccounts} from '../accounts/sweep-lib.ts'
import {waitFor} from './deadline.ts'
import {requireMainIsSmoke, runKeybase} from './peer-service.ts'

const username = /^[a-z0-9_-]+$/i

// The usernames a `keybase list-following -H` answer lists. The answer must parse: its "Username"
// header and the line under it first, then one username per line, else this throws, so a list that
// failed or changed shape never reads as "not following".
export const followingIn = (out: string) => {
  const [header, rule, ...users] = out
    .split('\n')
    .map(l => l.trim())
    .filter(l => l !== '')
  if (header !== 'Username' || !/^=+$/.test(rule ?? '') || !users.every(u => username.test(u))) {
    throw new Error('keybase list-following: the answer is not a header and a list of usernames')
  }
  return users
}

const masked = (e: unknown) => {
  const {secondUser, smokeUser, team} = loadE2EAccounts()
  return maskAccounts(e instanceof Error ? e.message : String(e), {team, users: {second: secondUser, smoke: smokeUser}})
}

// whether the smoke account follows the second account, as the service lists it
export const followsSecond = async () => {
  const {secondUser, smokeUser} = loadE2EAccounts()
  await requireMainIsSmoke({smokeUser})
  const out = await runKeybase(['list-following', '-H'], {timeoutMs: 30_000}).catch((e: unknown) => {
    throw new Error(masked(e))
  })
  return followingIn(out).includes(secondUser)
}

// The account a follow or unfollow may name: the second account, and no other.
export const requireFollowTarget = (user: string) => {
  if (user !== loadE2EAccounts().secondUser) throw new Error('refusing to follow or unfollow an account that is not the second account')
  return user
}

// Puts the smoke account's follow of the second account to `want` from the CLI and reads it back; a
// no-op when it already is. Bound: a read (30s), the write (60s), then 30s of reads.
export const setFollowSecondFromCli = async (want: boolean) => {
  if ((await followsSecond()) === want) return
  const user = requireFollowTarget(loadE2EAccounts().secondUser)
  await runKeybase(want ? ['follow', user, '-y'] : ['unfollow', user], {timeoutMs: 60_000}).catch((e: unknown) => {
    throw new Error(masked(e))
  })
  await waitFor(
    `the follow state of the second account put back to ${want ? 'following' : 'not following'}`,
    async () => ((await followsSecond()) === want ? true : undefined),
    {timeout: 30_000}
  )
}
