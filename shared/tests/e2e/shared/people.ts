// The smoke account's follow of the second account, read from `keybase list-following` on the host
// and put back from the CLI. Only the second account is ever followed or unfollowed here, and an
// error names no account. Framework-free: shared by the desktop and iOS flows.
import {loadE2EAccounts} from '../accounts/env.ts'
import {maskE2E} from '../accounts/sweep-lib.ts'
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


// whether the smoke account follows the second account, as the service lists it
export const followsSecond = async () => {
  const {secondUser, smokeUser} = loadE2EAccounts()
  await requireMainIsSmoke({smokeUser})
  const out = await runKeybase(['list-following', '-H'], {timeoutMs: 30_000}).catch((e: unknown) => {
    throw new Error(maskE2E(e))
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
    throw new Error(maskE2E(e))
  })
  await waitFor(
    `the follow state of the second account put back to ${want ? 'following' : 'not following'}`,
    async () => ((await followsSecond()) === want ? true : undefined),
    {timeout: 30_000}
  )
}

const uidPattern = /^[0-9a-f]{32}$/

// The uid in a `keybase apicall user/lookup` answer for one user (fields=basics); it must parse.
const lookedUpUid = (out: string) => {
  const parsed: unknown = JSON.parse(out)
  const them = (parsed as {them?: {id?: unknown}} | null)?.them
  const id = them?.id
  if (typeof id !== 'string' || !uidPattern.test(id)) throw new Error('keybase apicall user/lookup: the answer holds no uid')
  return id
}

// The usernames in a `keybase apicall user/list_followers_for_display` answer. It must parse: a
// status code 0 and a list of users, each with a username, else this throws, so a failed call never
// reads as "not following".
export const followersIn = (out: string) => {
  const parsed = JSON.parse(out) as {status?: {code?: unknown}; users?: unknown} | null
  const users = parsed?.users
  if (parsed?.status?.code !== 0 || !Array.isArray(users)) {
    throw new Error('keybase apicall user/list_followers_for_display: the answer is not a list of users')
  }
  return users.map(u => {
    const name = (u as {username?: unknown} | null)?.username
    if (typeof name !== 'string' || !username.test(name)) {
      throw new Error('keybase apicall user/list_followers_for_display: a user without a username')
    }
    return name
  })
}

// Whether the smoke account follows the second account, as the server's follower list says. A
// device's own list (followsSecond's `list-following`) shows another device's change only once the
// server's merkle tree holds it, which can take minutes; the server's list shows it at once. Bound:
// the lookup 30s, the list 30s.
export const serverSaysFollowsSecond = async () => {
  const {secondUser, smokeUser} = loadE2EAccounts()
  await requireMainIsSmoke({smokeUser})
  const call = async (args: Array<string>) =>
    runKeybase(['apicall', ...args], {timeoutMs: 30_000}).catch((e: unknown) => {
      throw new Error(maskE2E(e))
    })
  const uid = lookedUpUid(await call(['-a', `username=${secondUser}`, '-a', 'fields=basics', 'user/lookup']))
  const followers = followersIn(await call(['-a', `uid=${uid}`, '-a', 'reverse=0', 'user/list_followers_for_display']))
  return followers.includes(smokeUser)
}
