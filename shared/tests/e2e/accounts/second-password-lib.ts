// The second account's password belongs to the harness: a random value set through the second
// peer, kept only in the env file as KB_SECOND_PASSWORD. The main service holds a stored secret for
// the second account (the app's account switcher signs in with it), and a password change must not
// break it, so every change is followed by checkSecondSecretSurvives, and by repairSecondSecret
// when that fails.
//
// The password never reaches output: every error built here has it scrubbed. No step answers a
// terminal prompt. The repair signs the second account in through the app's login screen: the
// service sends every password prompt to the app (its registered secret UI wins over the caller's
// connection, go/engine/engine.go delegateUIs), and the app answers none while signed out, so a
// prompt on a harness connection is never asked.
import {randomBytes} from 'crypto'
import {
  defaultEnvPath,
  loadE2EAccounts,
  readEnvFile,
  refuseWhileSecondPasswordChangePending,
  setEnvVars,
  type E2EEnv,
} from './env.ts'
import {restoreMainAccount} from './peer-homes.ts'
import {runIdFromEnv} from './run-id.ts'
import {maskAccounts} from './sweep-lib.ts'
import type {PeerRpc} from '../shared/peer-rpc.ts'
import {ensurePeer, mainWhoami, runKeybase, runKeybaseDetached} from '../shared/peer-service.ts'

export type RpcLike = Pick<PeerRpc, 'call' | 'close'>

// The main service, as the check and the repair drive it.
export type MainSide = {
  // `keybase login --switch <user>` with no stdin: a password prompt fails it
  switchMain: (user: string) => Promise<void>
  whoami: () => Promise<string>
  say: (s: string) => void
}

export type CheckDeps = MainSide & {
  // the second peer sends a fresh marker to the smoke<->second DM; the main service reads it
  roundTrip: (env: E2EEnv) => Promise<void>
}

const message = (e: unknown) => (e instanceof Error ? e.message : String(e))
const scrub = (s: string, secret: string) => (secret ? s.split(secret).join('<password>') : s)
const scrubbed = (what: string, e: unknown, secret: string) =>
  new Error(scrub(what ? `${what}: ${message(e)}` : message(e), secret))

const base36 = '0123456789abcdefghijklmnopqrstuvwxyz'

// `e2e-` and 24 base36 characters from crypto.randomBytes (bytes past 251 are dropped so each
// character is equally likely).
export const newPassword = () => {
  let out = ''
  while (out.length < 24) {
    for (const b of randomBytes(32)) {
      if (b < 252 && out.length < 24) out += base36.charAt(b % 36)
    }
  }
  return `e2e-${out}`
}

// The longest each step here can take before its own deadline fails it, so a test hook running one
// can give itself enough time (Playwright's default hook timeout of 30s would kill a repair part way
// and leave the main service signed out).
const SWITCH_MS = 60_000
const WHOAMI_MS = 15_000
const READ_MS = 20_000
// restoreMainAccount: up to 3 tries of whoami, switch, whoami, 2s apart, then a last whoami
export const BACK_TO_SMOKE_WORST_MS = 3 * (WHOAMI_MS + SWITCH_MS + WHOAMI_MS + 2_000) + WHOAMI_MS
// ensurePeer (start 30s, two whoamis), the peer's chat api send (60s), the read window
const ROUND_TRIP_WORST_MS = 30_000 + 2 * WHOAMI_MS + 60_000 + READ_MS + 1_000
export const CHECK_WORST_MS = SWITCH_MS + WHOAMI_MS + BACK_TO_SMOKE_WORST_MS + ROUND_TRIP_WORST_MS
// signInThroughApp (second-sign-in.ts): its bounded actions and polls, there and back
export const APP_SIGN_IN_WORST_MS = 240_000
export const REPAIR_WORST_MS = APP_SIGN_IN_WORST_MS + BACK_TO_SMOKE_WORST_MS
// checkOrRepairSecondSecret: a check, the repair, a second check
export const CHECK_OR_REPAIR_WORST_MS = CHECK_WORST_MS + REPAIR_WORST_MS + CHECK_WORST_MS

// console.log with the account and team names masked (a failed `login --switch` names its account):
// stdout lands in run logs.
export const sayMasked = (s: string) => {
  const {secondUser, smokeUser, team} = loadE2EAccounts()
  console.log(maskAccounts(s, {team, users: {second: secondUser, smoke: smokeUser}}))
}

export const liveMain = (): MainSide => ({
  say: sayMasked,
  switchMain: async user => {
    await runKeybaseDetached(['login', '--switch', user], {timeoutMs: SWITCH_MS})
  },
  whoami: async () => mainWhoami().catch(() => ''),
})

type ReadMessage = {msg?: {content?: {text?: {body?: string}}; sender?: {username?: string}}; error?: string}

const mainChatApi = async (msg: object, timeoutMs: number) => {
  const reply = JSON.parse(await runKeybase(['chat', 'api', '-m', JSON.stringify(msg)], {timeoutMs})) as {
    error?: {message?: string}
    result?: unknown
  }
  if (reply.error) throw new Error(`main chat api read: ${reply.error.message ?? 'error'}`)
  return reply.result
}

const sleep = async (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

// The second peer still signs in and sends, and the main service (as the smoke account) reads what
// it sent decrypted within 20s.
const liveRoundTrip = async (env: E2EEnv) => {
  const runId = runIdFromEnv(process.env)
  if (!runId) throw new Error('KB_E2E_RUN_ID is not set: the check stamps its message with the run id')
  const peer = await ensurePeer('second', env)
  const channel = {name: `${env.smokeUser},${env.secondUser}`}
  const body = `e2e-${runId}-pwcheck-${randomBytes(4).toString('hex')}`
  await peer.chatApi({method: 'send', params: {options: {channel, message: {body}}}})
  const deadline = Date.now() + READ_MS
  let errors: string[] = []
  while (Date.now() < deadline) {
    const res = (await mainChatApi(
      {method: 'read', params: {options: {channel, pagination: {num: 20}, peek: true}}},
      Math.max(1_000, deadline - Date.now())
    )) as {messages?: ReadMessage[]}
    const messages = res.messages ?? []
    const hit = messages.find(m => m.msg?.content?.text?.body === body)
    if (hit) {
      if (hit.msg?.sender?.username !== env.secondUser) throw new Error(`${body} arrived from ${hit.msg?.sender?.username}`)
      return
    }
    errors = messages.flatMap(m => (m.error ? [m.error] : []))
    await sleep(Math.min(1_000, Math.max(0, deadline - Date.now())))
  }
  throw new Error(`the main service did not read ${body} within 20s${errors.length ? ` (unreadable rows: ${errors.join('; ')})` : ''}`)
}

const liveCheck = (): CheckDeps => ({...liveMain(), roundTrip: liveRoundTrip})

// Back to the smoke account (retried) and checked; throws with the command to run by hand.
const backToSmoke = async (env: E2EEnv, main: MainSide) => {
  await restoreMainAccount(env.smokeUser, `keybase login --switch <KB_SMOKE_USER from ${defaultEnvPath()}>`, {
    say: main.say,
    switchTo: main.switchMain,
    whoami: main.whoami,
  })
}

// `work`, then always `restore`. A restore that fails after `work` failed keeps both errors (the
// work's first), so neither hides the other. Every error thrown after `work` failed is scrubbed of
// `secret`.
export const thenRestore = async <T,>(work: () => Promise<T>, restore: () => Promise<void>, secret = ''): Promise<T> => {
  let result: T
  try {
    result = await work()
  } catch (e) {
    try {
      await restore()
    } catch (r) {
      const restoreError = scrubbed('', r, secret)
      throw new AggregateError(
        [scrubbed('', e, secret), restoreError],
        scrub(`${message(e)}; and then switching back to the smoke account failed: ${message(r)}`, secret),
        // the caught error's scrubbed copy: the raw one may carry the password
        // eslint-disable-next-line preserve-caught-error
        {cause: restoreError}
      )
    }
    if (!secret) throw e
    // a scrubbed copy: the raw error may carry the password
    // eslint-disable-next-line preserve-caught-error
    throw scrubbed('', e, secret)
  }
  await restore()
  return result
}

// (a) the main service switches to second with no prompt, (b) always back to smoke, (c) the second
// peer still works. Switching the main service switches the app too, so this runs only between
// tests (a file's beforeAll/afterAll, or the setup command).
export const checkSecondSecretSurvives = async (env: E2EEnv, deps: CheckDeps = liveCheck()) => {
  await thenRestore(
    async () => {
      try {
        await deps.switchMain(env.secondUser)
        const who = await deps.whoami()
        if (who !== env.secondUser) {
          throw new Error(`the main service is ${who || 'signed out'} after switching to the second account`)
        }
      } catch (e) {
        throw new Error(`the main service cannot switch to the second account without a password: ${message(e)}`, {cause: e})
      }
    },
    async () => backToSmoke(env, deps)
  )
  await deps.roundTrip(env)
}

export type RepairSide = MainSide & {
  // signs the second account in with `password` through the app and puts the app back on smoke
  signIn: (env: E2EEnv, password: string) => Promise<void>
}

// loaded when used: it drives the app through Playwright, which the unit tests never load
const liveRepair = (): RepairSide => ({
  ...liveMain(),
  signIn: async (env, password) => (await import('../electron/helpers/second-sign-in.ts')).signSecondInThroughApp(env, password),
})

// Signs the second account in on the main service with `password`, which stores its secret again;
// then, always, back to smoke on the main service, checked.
export const repairSecondSecret = async (env: E2EEnv, password: string, deps: RepairSide = liveRepair()) =>
  thenRestore(
    async () => {
      try {
        await deps.signIn(env, password)
      } catch (e) {
        throw scrubbed('signing the second account in through the app', e, password)
      }
    },
    async () => backToSmoke(env, deps),
    password
  )

// What `keybase passphrase change --force` sends ("change password without entering the current
// one"), on the second peer. Force drops server-synced PGP keys, so it refuses first, sending
// nothing else, when the account has any.
export const setSecondPasswordViaPeer = async (
  env: E2EEnv,
  next: string,
  deps: {peerRpc: (env: E2EEnv) => Promise<RpcLike>} = {peerRpc: async e => (await ensurePeer('second', e)).rpc()}
) => {
  const rpc = await deps.peerRpc(env)
  try {
    const {hasServerKeys} = await rpc.call<{hasServerKeys: boolean}>('keybase.1.account.hasServerKeys', {sessionID: 0})
    if (hasServerKeys) {
      throw new Error('the second account has a server-synced PGP key, which a forced password change would drop; refusing')
    }
    await rpc.call('keybase.1.account.passphraseChange', {force: true, oldPassphrase: '', passphrase: next, sessionID: 0}, 60_000)
  } catch (e) {
    throw scrubbed('setting the second account password on its peer', e, next)
  } finally {
    rpc.close()
  }
}

export type RepairDeps = {
  check: (env: E2EEnv) => Promise<void>
  repair: (env: E2EEnv, password: string) => Promise<void>
  say?: (s: string) => void
}

const liveRepairDeps = (): RepairDeps => ({
  check: async e => checkSecondSecretSurvives(e),
  repair: async (e, pw) => repairSecondSecret(e, pw),
  say: sayMasked,
})

const brokenSecret = "the second account's stored secret on the main service is broken"

// The check, and when it fails the repair with `password` and the check once more; a second failure
// throws `broken`. Settings > Sign out drops the stored secret, so after it the next switch to the
// second account would prompt until a password login stores it again (Go stores it after any
// password login, whatever storeSecret the app answers). Both the check and the repair end with
// whoami checked as smoke.
export const checkOrRepairSecondSecret = async (
  env: E2EEnv,
  password: string,
  deps: RepairDeps = liveRepairDeps(),
  broken = `${brokenSecret} and signing it in again with KB_SECOND_PASSWORD did not fix it`
) => {
  try {
    await deps.check(env)
  } catch (first) {
    deps.say?.(scrub(`the second account's stored secret check failed (${message(first)}); signing it in again on the main service`, password))
    try {
      await deps.repair(env, password)
      await deps.check(env)
    } catch (second) {
      // the causes are not attached: their messages may carry the password
      // eslint-disable-next-line preserve-caught-error
      throw new Error(scrub(`${broken} (check: ${message(first)}; after the repair: ${message(second)})`, password))
    }
  }
}

export type RotateDeps = RepairDeps & {envFile: string}

// A new password: written to the env file as KB_SECOND_PASSWORD_NEXT first, set by `change`, then
// checked (repaired and checked once more on failure) and only then promoted to KB_SECOND_PASSWORD.
// Refuses, changing nothing, while a KB_SECOND_PASSWORD_NEXT from an earlier change is pending (in
// `env` or in the file now): the server may hold it, and overwriting it would lose the password.
export const rotateSecondPassword = async (
  env: E2EEnv,
  change: (next: string) => Promise<void>,
  deps: RotateDeps = {...liveRepairDeps(), envFile: defaultEnvPath()}
): Promise<string> => {
  refuseWhileSecondPasswordChangePending(env)
  refuseWhileSecondPasswordChangePending({secondPasswordChangePending: !!readEnvFile(deps.envFile)['KB_SECOND_PASSWORD_NEXT']})
  const next = newPassword()
  setEnvVars(deps.envFile, {KB_SECOND_PASSWORD_NEXT: next})
  try {
    await change(next)
  } catch (e) {
    throw scrubbed('changing the second account password failed (if it took anyway, it is KB_SECOND_PASSWORD_NEXT in the env file)', e, next)
  }
  await checkOrRepairSecondSecret(
    env,
    next,
    deps,
    `${brokenSecret} after a password change; the current password is KB_SECOND_PASSWORD_NEXT in the env file`
  )
  setEnvVars(deps.envFile, {KB_SECOND_PASSWORD: next, KB_SECOND_PASSWORD_NEXT: null})
  return next
}
