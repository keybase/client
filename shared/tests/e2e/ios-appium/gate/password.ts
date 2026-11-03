// The second account's password change from the phone, through desktop's rotateSecondPassword
// contract (accounts/second-password-lib.ts): the new value is KB_SECOND_PASSWORD_NEXT in the env file
// until it is checked, then promoted. The flow passes the change (the phone's Change password screen);
// this file gives the checks and the repair the phone needs:
// - check: the second peer takes the new password (passphraseCheck, which only compares), and the
//   phone still keeps a stored secret for the second account and switches to it with no prompt;
// - repair: the phone only, signing the second account in with the new password from its login screen.
// The host's main service is never switched here: right after a change
// made on the phone, the host's login switch deadlocks in a logout hook, so whether the host's stored
// secret for the second account survived is left to the owner (the manual-only edge
// second-password-host-check, manual-only.ts). A peer that does not
// take the new password is thrown with the owner's command and never repaired. No message names an
// account or carries a password.
import {
  defaultEnvPath,
  loadE2EAccounts,
  readEnvFile,
  refuseWhileSecondPasswordChangePending,
  requireSecondPassword,
  secondPasswordCommand,
  type E2EEnv,
} from '../../accounts/env'
import {sayMasked, secondPasswordIsCurrent, type RotateDeps} from '../../accounts/second-password-lib'
import {maskE2E} from '../../accounts/sweep-lib'
import {ensurePeer} from '../../shared/peer-service'
import {appAccount, asSecond, restoreToSmoke} from './accounts'
import {restoreSecondSecret, storedSecretOf, withLoginPasswordMarked} from './sign-in'

// What the rotation reads and repairs, each side as a function so the tests can hand in fakes.
export type PhoneSides = {
  peerHasServerKeys: (env: E2EEnv) => Promise<boolean>
  peerPasswordIsCurrent: (env: E2EEnv, password: string) => Promise<boolean>
  // signs the second account in with `password` on the phone and puts the app back on smoke
  phoneRepair: (password: string) => Promise<void>
  phoneStoredSecret: (user: string) => Promise<boolean>
  // switches the app to the second account with no prompt, checks it is there, and back to smoke
  phoneSwitchToSecondAndBack: () => Promise<void>
  say: (s: string) => void
}

const liveSides = (): PhoneSides => ({
  peerHasServerKeys: async env => {
    const rpc = await (await ensurePeer('second', env)).rpc()
    try {
      return (await rpc.call<{hasServerKeys: boolean}>('keybase.1.account.hasServerKeys', {sessionID: 0})).hasServerKeys
    } finally {
      rpc.close()
    }
  },
  peerPasswordIsCurrent: async (env, password) => secondPasswordIsCurrent(env, password),
  phoneRepair: async password => {
    try {
      await withLoginPasswordMarked(async () => restoreSecondSecret(password))
    } finally {
      await restoreToSmoke()
    }
  },
  phoneStoredSecret: async user => storedSecretOf(user),
  phoneSwitchToSecondAndBack: async () =>
    asSecond(async () => {
      const a = await appAccount()
      if (!a.loggedIn || a.username !== loadE2EAccounts().secondUser) throw new Error('the phone did not land on the second account')
    }),
  say: sayMasked,
})

const OWNER_CHECK = `${secondPasswordCommand} --check`

// A check failure the phone's repair cannot fix.
class NotRepairable extends Error {}

// The RotateDeps for a password change made on the phone.
export const iosRotateDeps = (sides: PhoneSides = liveSides(), envFile = defaultEnvPath()): RotateDeps => ({
  check: async (env, password) => {
    if (!(await sides.peerPasswordIsCurrent(env, password))) {
      throw new NotRepairable(`the second peer does not take the new password, so the change did not take; the owner runs ${OWNER_CHECK}`)
    }
    if (!(await sides.phoneStoredSecret(env.secondUser))) throw new Error('the phone keeps no stored secret for the second account')
    try {
      await sides.phoneSwitchToSecondAndBack()
    } catch (e) {
      // the cause is not attached: its message may name an account
      // eslint-disable-next-line preserve-caught-error
      throw new Error(`the phone cannot switch to the second account without a password: ${maskE2E(e)}`)
    }
  },
  envFile,
  repair: async (_env, password) => sides.phoneRepair(password),
  repairable: e => !(e instanceof NotRepairable),
  say: sides.say,
})

// What a pending change means on the phone, after the env refusal: the gate types no password then.
export const PHONE_PENDING_NOTE =
  "the phone's second account may have no stored secret: once KB_SECOND_PASSWORD_NEXT is resolved, the next run's restore signs it in, or the owner signs it in on the phone"

// Throws the env refusal with the phone's note while a change is pending (in `env` or, when
// `envFile` is given, the env file now).
export const refusePendingOnPhone = (env: Pick<E2EEnv, 'secondPasswordChangePending'>, envFile?: string) => {
  const pending = !!env.secondPasswordChangePending || (envFile !== undefined && !!readEnvFile(envFile)['KB_SECOND_PASSWORD_NEXT'])
  if (!pending) return
  try {
    refuseWhileSecondPasswordChangePending({secondPasswordChangePending: true})
  } catch (e) {
    // the refusal names no password or account
    // eslint-disable-next-line preserve-caught-error
    throw new Error(`${e instanceof Error ? e.message : String(e)}; ${PHONE_PENDING_NOTE}`)
  }
}

// The second account's password for a phone flow to type: refused, with the phone's note, while a
// change is pending in `env` or the env file.
export const requirePhoneSecondPassword = (env: E2EEnv, envFile = defaultEnvPath()) => {
  refusePendingOnPhone(env, envFile)
  return requireSecondPassword(env)
}

// Throws unless a password change may start: no KB_SECOND_PASSWORD_NEXT pending (in `env` or the env
// file now) and no server-synced PGP key on the second account (a forced change would drop it).
export const requireRotatable = async (env: E2EEnv, sides: PhoneSides = liveSides(), envFile = defaultEnvPath()) => {
  refusePendingOnPhone(env, envFile)
  if (await sides.peerHasServerKeys(env)) {
    throw new Error('the second account has a server-synced PGP key, which a forced password change would drop; refusing')
  }
}
