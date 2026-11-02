// Framework-free reads for the deep link, push and lifecycle flows: Go's app state lines, the route the app saved for its next launch,
// the app-log lines (app-log.ts `<level> <text>`) a link or a tapped push leaves, and what a cold
// launch's first recording shows.

// Go's "useful update: %v, we are currently in state: %v": the comma keeps it from also matching a
// BACKGROUNDACTIVE transition. A push sent before this is handed to the app instead of shown.
export const GO_BACKGROUND = /MobileAppState\.Update: useful update: BACKGROUND,/
export const GO_FOREGROUND = /MobileAppState\.Update: useful update: FOREGROUND,/
export const GO_INACTIVE = /MobileAppState\.Update: useful update: INACTIVE,/
// before a launched app is active, iOS reports INACTIVE or BACKGROUNDACTIVE, whichever launch
// callback lands first
export const GO_LAUNCHING = /MobileAppState\.Update: useful update: (?:INACTIVE|BACKGROUNDACTIVE),/
// Go's image server start, with the address the app must then hold
export const GO_HTTP_SRV = /startHTTPSrv: start success: addr: (\S+)/

// `n` round trips to the background and back, as Go logs them in order.
export const roundTrips = (n: number) => Array.from({length: n}, () => [GO_BACKGROUND, GO_FOREGROUND]).flat()

// Whether the route the app saved for its next launch (util/storeless-actions.tsx persistRoute:
// ui.routeState2, JSON {routeName, param, uid}) is the People tab with no conversation: a cold launch
// then lands on People unless what launched it opened something else.
export const savedRouteIsPeople = (saved: string | null | undefined): boolean => {
  if (!saved) return false
  let v: unknown
  try {
    v = JSON.parse(saved)
  } catch {
    return false
  }
  if (typeof v !== 'object' || v === null) return false
  const {param, routeName} = v as {param?: unknown; routeName?: unknown}
  if (routeName !== 'tabs.peopleTab') return false
  return typeof param !== 'object' || param === null || (param as {selectedConversationIDKey?: unknown}).selectedConversationIDKey === undefined
}

const capturedOf = (lines: ReadonlyArray<string>, re: RegExp) => lines.flatMap(l => re.exec(l)?.slice(1, 2) ?? [])

// The links the app took from tapped notifications (router-v2/deep-link-emitter.tsx), in order.
export const pushTapLinks = (lines: ReadonlyArray<string>) => capturedOf(lines, /^info \[PushTap\] took a tap link: (\S+)$/)

// The links the app took from Linking while running (router-v2/linking.tsx), in order.
export const deepLinkEvents = (lines: ReadonlyArray<string>) => capturedOf(lines, /^info \[DeepLink\] url event: (\S+)$/)

// Lines of the account switch a tapped push can start (router-v2/account-link-switch.tsx).
export const accountLinkLines = (lines: ReadonlyArray<string>) => lines.filter(l => l.includes('[AccountLink]'))

// The app's own line for a change of its focus (constants/init/index.tsx), e.g. 'active'.
export const focusChanges = (lines: ReadonlyArray<string>) => capturedOf(lines, /^info app focus changed: (\w+)$/)

// Whether `focus` is the app going inactive and coming back: inactive and active in turn, from inactive
// to active. On iOS 26 pulling Notification Center down resigns the app, makes it active for a few ms
// and resigns it again as the center settles, so a pull can be two such turns.
export const focusLeftAndBack = (focus: ReadonlyArray<string>) =>
  focus.length >= 2 && focus.length % 2 === 0 && focus.every((f, i) => f === (i % 2 === 0 ? 'inactive' : 'active'))

// Whether a relaunched app's first recording shows it came up on `route`: the screen up as the
// recorder started on the new runtime, with People (the route it saved) never shown in it.
export const launchedInto = (r: {routes: ReadonlyArray<string>; startRoutes?: ReadonlyArray<string>} | undefined, route: string) =>
  !!r?.startRoutes?.includes(route) && !r.startRoutes.includes('peopleRoot') && !r.routes.includes('peopleRoot')
