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
