// Who the simulator app is signed in as, read over Metro's inspector, and the refusal when it is not
// the smoke account. Free of wdio, so the release command (run by node) uses it too.
import {signedInName} from '../../accounts/sweep-lib.ts'

import {FIBER_WALK} from './secret-input-lib.ts'

export type AppAccount = {loggedIn: boolean; switching: boolean; username: string}

// a function body for jsEval / evalInPage, returning an AppAccount
export const APP_ACCOUNT_BODY = `
    const c = kbModule('stores/config.tsx').useConfigState.getState()
    return {loggedIn: c.loggedIn, switching: c.userSwitching, username: kbModule('stores/current-user.tsx').useCurrentUserState.getState().username}
  `

// An expression for whether the app holds push permission (usePushState.hasPermissions, which it reads
// from iOS at launch).
export const PUSH_HAS_PERMISSIONS = `!!kbModule('stores/push.tsx').usePushState.getState().hasPermissions`

// expo PermissionStatus values: 'granted', 'denied', 'undetermined'
export type LocationPermission = {background: string; foreground: string}

const EXPO_LOCATION = `kbModule('node_modules/expo-location/build/index.js')`

// An expression for a promise of the app's location permission as it reads it (expo-location; native,
// no RPC), a LocationPermission.
export const LOCATION_PERMISSION = `${EXPO_LOCATION}.getForegroundPermissionsAsync()
  .then(f => ${EXPO_LOCATION}.getBackgroundPermissionsAsync().then(b => ({background: b.status, foreground: f.status})))`

// Names a test account by its role only (signedInName): this line lands in run output and results.
export const notSmokeProblem = (a: AppAccount, accounts: {smokeUser: string; secondUser: string}): string | undefined => {
  if (a.loggedIn && a.username === accounts.smokeUser) return undefined
  const on = signedInName(a.loggedIn ? a.username : '', {second: accounts.secondUser, smoke: accounts.smokeUser})
  return (
    `the simulator app is signed in as ${on}, not the e2e smoke account; ` +
    'switch the simulator app to KB_SMOKE_USER with its account switcher; refusing to run'
  )
}

// How long a signed-out answer must hold before it is believed: a JS runtime that just started reports
// {loggedIn: false, username: ''} until its service handshake.
const SIGNED_OUT_SETTLE_MS = 60_000

// The account a just-launched app is on, once its answer can be believed: a signed-in one at once, a
// signed-out one only once answers have been coming for `settleMs` (`firstAnswerAt`); undefined while
// it switches accounts or may still be starting up.
export const settledAccount = (a: AppAccount, firstAnswerAt: number, now: number, settleMs = SIGNED_OUT_SETTLE_MS): AppAccount | undefined => {
  if (a.switching) return undefined
  if (a.loggedIn && a.username) return a
  return now - firstAnswerAt >= settleMs ? a : undefined
}

export type PhoneDevice = AppAccount & {deviceID: string; deviceName: string}

// a function body for jsEval, returning a PhoneDevice: the account and device the app is signed in on
export const PHONE_DEVICE_BODY = `
    const c = kbModule('stores/config.tsx').useConfigState.getState()
    const u = kbModule('stores/current-user.tsx').useCurrentUserState.getState()
    return {deviceID: u.deviceID, deviceName: u.deviceName, loggedIn: c.loggedIn, switching: c.userSwitching, username: u.username}
  `

// Why `d` is not the smoke account's device on the phone, or undefined when it is.
export const phoneDeviceProblem = (d: PhoneDevice, smokeUser: string): string | undefined => {
  if (!d.loggedIn || d.switching || d.username !== smokeUser) {
    return `the app is not settled on the smoke account (${d.loggedIn ? d.username : 'signed out'}${d.switching ? ', switching' : ''}), so its device is not the smoke account's`
  }
  return d.deviceID && d.deviceName ? undefined : 'the app names no device for the smoke account'
}

export type ConfiguredAccount = {hasStoredSecret: boolean; username: string}
// `ask` names the ask an answer is for
export type ConfiguredAccounts = {ask: string} & (
  | {state: 'pending'}
  | {state: 'failed'; error: string}
  | {state: 'listed'; accounts: Array<ConfiguredAccount>}
)
export type ConfiguredAnswer = Exclude<ConfiguredAccounts, {state: 'pending'}>

// Where the eval that asks the phone's service for its configured accounts leaves the answer, for the
// evals that poll it (an eval returns before an RPC answers).
const CONFIGURED_KEY = 'globalThis.__kbE2EConfiguredAccounts'

// A function body for jsEval that asks the phone's own service (login.getConfiguredAccounts, the
// list the login screen and the switcher show). The answer is kept only while `ask` is the latest
// ask, so an earlier ask answering late cannot replace a newer one's answer.
export const configuredAccountsAskBody = (ask: string) => `
    const ask = ${JSON.stringify(ask)}
    ${CONFIGURED_KEY} = {ask, state: 'pending'}
    const keep = r => { if (${CONFIGURED_KEY} && ${CONFIGURED_KEY}.ask === ask) ${CONFIGURED_KEY} = {ask, ...r} }
    kbModule('constants/rpc/rpc-gen.tsx')
      .loginGetConfiguredAccountsRpcPromise()
      .then(
        list => keep({state: 'listed', accounts: (list ?? []).map(a => ({hasStoredSecret: a.hasStoredSecret, username: a.username}))}),
        e => keep({state: 'failed', error: String(e && e.message)})
      )
    return true
  `
// a function body for jsEval returning what the latest ask has been answered so far
export const CONFIGURED_ACCOUNTS_READ_BODY = `return ${CONFIGURED_KEY} ?? {ask: '', state: 'pending'}`

// The answer to `ask`, or undefined while it is unanswered or the read is of another ask.
export const answerTo = (r: ConfiguredAccounts, ask: string): ConfiguredAnswer | undefined =>
  r.ask === ask && r.state !== 'pending' ? r : undefined

// Whether the phone keeps a stored secret for `username`, or why the answer names none.
export const storedSecretIn = (r: ConfiguredAnswer, username: string): boolean | string => {
  if (r.state === 'failed') return `listing the phone's configured accounts failed: ${r.error}`
  const [a, ...more] = r.accounts.filter(x => x.username === username)
  if (!a || more.length) return `the phone lists ${username} among its configured accounts ${a ? more.length + 1 : 0} times, not once`
  return a.hasStoredSecret
}

// What the phone's login screen shows: the account it would sign in, whether it asks for that
// account's password and the error it shows. Never the password: the eval returns only these.
export type LoginScreen = {state: 'none' | 'many' | 'no fiber roots'} | {state: 'shown'; error: string; needPassword: boolean; selectedUser: string}

// a function body for jsEval, returning a LoginScreen: the props of the login screen's one mounted
// render component (login/relogin/index.tsx), found by walking each root's current tree
export const LOGIN_SCREEN_BODY = `${FIBER_WALK}
    const found = fibersMatching(f => {
      const p = f.memoizedProps
      return f.tag === 0 && !!p && typeof p.selectedUser === 'string' && typeof p.needPassword === 'boolean' && typeof p.selectedUserChange === 'function'
    })
    if (!found) return {state: 'no fiber roots'}
    if (found.length === 0) return {state: 'none'}
    if (found.length > 1) return {state: 'many'}
    const p = found[0].field.memoizedProps
    return {state: 'shown', error: String(p.error ?? ''), needPassword: p.needPassword, selectedUser: p.selectedUser}
  `

// Why the login screen is not asking for `username`'s password, or undefined when it is: a password
// is typed only into a screen that signs that account in.
export const passwordScreenProblem = (s: LoginScreen, username: string): string | undefined => {
  if (s.state === 'no fiber roots') return 'the app has no React DevTools hook to read the login screen with'
  if (s.state !== 'shown') return s.state === 'none' ? 'the login screen is not shown' : 'more than one login screen is mounted'
  if (s.selectedUser !== username) return `the login screen would sign in ${s.selectedUser || '(nobody)'}, not ${username}`
  return s.needPassword ? undefined : `the login screen asks no password for ${username}`
}
