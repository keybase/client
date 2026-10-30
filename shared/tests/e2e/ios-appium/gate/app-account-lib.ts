// Who the simulator app is signed in as, read over Metro's inspector, and the refusal when it is not
// the smoke account. Free of wdio, so the release command (run by node) uses it too.

export type AppAccount = {loggedIn: boolean; switching: boolean; username: string}

// a function body for jsEval / evalInPage, returning an AppAccount
export const APP_ACCOUNT_BODY = `
    const c = kbModule('stores/config.tsx').useConfigState.getState()
    return {loggedIn: c.loggedIn, switching: c.userSwitching, username: kbModule('stores/current-user.tsx').useCurrentUserState.getState().username}
  `

export const notSmokeProblem = (a: AppAccount, smokeUser: string): string | undefined =>
  a.loggedIn && a.username === smokeUser
    ? undefined
    : `the simulator app is signed in as ${a.loggedIn ? a.username : '(nobody; signed out)'}, not the e2e smoke account; ` +
      `switch the simulator app to ${smokeUser} with its account switcher; refusing to run`

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
