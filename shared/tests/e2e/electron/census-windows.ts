// The desktop app's windows besides the main one (desktop/remote), which have no route, so the
// route inventory never lists them. Kept by hand: the census fails when this list and the app's
// remoteComponentNames differ, and when a window here has no rendered `window/<name>` tour entry.
export const CENSUS_WINDOWS: ReadonlyArray<string> = ['menubar', 'pinentry', 'tracker', 'unlock-folders']
