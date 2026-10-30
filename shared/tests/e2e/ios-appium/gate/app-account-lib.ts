// Who the simulator app is signed in as, read over Metro's inspector, and the refusal when it is not
// the smoke account. Free of wdio, so the release command (run by node) uses it too.
import {signedInName} from '../../accounts/sweep-lib.ts'

export type AppAccount = {loggedIn: boolean; switching: boolean; username: string}

// a function body for jsEval / evalInPage, returning an AppAccount
export const APP_ACCOUNT_BODY = `
    const c = kbModule('stores/config.tsx').useConfigState.getState()
    return {loggedIn: c.loggedIn, switching: c.userSwitching, username: kbModule('stores/current-user.tsx').useCurrentUserState.getState().username}
  `

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
