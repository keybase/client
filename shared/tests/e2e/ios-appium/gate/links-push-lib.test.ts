import {
  accountLinkLines,
  deepLinkEvents,
  focusChanges,
  focusLeftAndBack,
  GO_BACKGROUND,
  GO_FOREGROUND,
  GO_HTTP_SRV,
  GO_INACTIVE,
  GO_LAUNCHING,
  launchedInto,
  pushTapLinks,
  roundTrips,
  savedRouteIsPeople,
} from './links-push-lib'

test('the saved route is People only for the People tab with no conversation', () => {
  expect(savedRouteIsPeople(JSON.stringify({param: {}, routeName: 'tabs.peopleTab', uid: 'u'}))).toBe(true)
  expect(savedRouteIsPeople(JSON.stringify({routeName: 'tabs.peopleTab'}))).toBe(true)
  expect(savedRouteIsPeople(JSON.stringify({param: {selectedConversationIDKey: 'ab'}, routeName: 'tabs.peopleTab'}))).toBe(false)
  expect(savedRouteIsPeople(JSON.stringify({param: {}, routeName: 'tabs.chatTab'}))).toBe(false)
  // nothing saved, a cleared route, and what does not parse are never People
  for (const s of [undefined, null, '', 'not json', '"tabs.peopleTab"']) expect(savedRouteIsPeople(s)).toBe(false)
})

test("the app log's link lines are read by their own wording only", () => {
  const lines = [
    'info [DeepLink] url event: keybase://convid/ab?uid=00',
    'info [PushTap] took a tap link: keybase://convid/ab',
    'info [PushTap] a tap with no route, only opening the app',
    'info [AccountLink] switching accounts for a tapped push',
    'info app focus changed: active',
    // the same words quoted inside another line are not the app's own line
    'warn something said [PushTap] took a tap link: keybase://convid/cd',
    'info e2e-abcde1-log-x-1234',
  ]
  expect(deepLinkEvents(lines)).toEqual(['keybase://convid/ab?uid=00'])
  expect(pushTapLinks(lines)).toEqual(['keybase://convid/ab'])
  expect(accountLinkLines(lines)).toEqual(['info [AccountLink] switching accounts for a tapped push'])
  expect(focusChanges(lines)).toEqual(['active'])
  expect(pushTapLinks([])).toEqual([])
})

test("Go's background line matches BACKGROUND alone, not BACKGROUNDACTIVE", () => {
  expect(GO_BACKGROUND.test('MobileAppState.Update: useful update: BACKGROUND, we are currently in state: FOREGROUND')).toBe(true)
  expect(GO_BACKGROUND.test('MobileAppState.Update: useful update: BACKGROUNDACTIVE, we are currently in state: BACKGROUND')).toBe(false)
})

test("Go's other app state lines, its image server's address, and round trips in order", () => {
  const at = (s: string) => `MobileAppState.Update: useful update: ${s}, we are currently in state: X`
  expect(GO_FOREGROUND.test(at('FOREGROUND'))).toBe(true)
  expect(GO_INACTIVE.test(at('INACTIVE'))).toBe(true)
  expect(GO_INACTIVE.test(at('BACKGROUND'))).toBe(false)
  expect(GO_LAUNCHING.test(at('INACTIVE')) && GO_LAUNCHING.test(at('BACKGROUNDACTIVE'))).toBe(true)
  expect(GO_LAUNCHING.test(at('FOREGROUND'))).toBe(false)
  expect(GO_HTTP_SRV.exec('startHTTPSrv: start success: addr: 127.0.0.1:5000')?.[1]).toBe('127.0.0.1:5000')
  expect(roundTrips(2)).toEqual([GO_BACKGROUND, GO_FOREGROUND, GO_BACKGROUND, GO_FOREGROUND])
})

test('a cold launch lands on a route only when its first recording starts there and never shows People', () => {
  expect(launchedInto({routes: [], startRoutes: ['loggedIn', 'chatConversation']}, 'chatConversation')).toBe(true)
  // the restored People tab shown first, then the conversation
  expect(launchedInto({routes: ['chatConversation'], startRoutes: ['tabs.peopleTab', 'peopleRoot']}, 'chatConversation')).toBe(false)
  expect(launchedInto({routes: ['peopleRoot'], startRoutes: ['chatConversation']}, 'chatConversation')).toBe(false)
  // a recording from an older bundle, or none at all
  expect(launchedInto({routes: ['chatConversation']}, 'chatConversation')).toBe(false)
  expect(launchedInto(undefined, 'chatConversation')).toBe(false)
})

test('a trip away and back is inactive and active in turn, from inactive to active', () => {
  expect(focusLeftAndBack(['inactive', 'active'])).toBe(true)
  // iOS 26's Notification Center pull: a few ms of active as the center settles
  expect(focusLeftAndBack(['inactive', 'active', 'inactive', 'active'])).toBe(true)
  expect(focusLeftAndBack([])).toBe(false)
  expect(focusLeftAndBack(['inactive'])).toBe(false)
  expect(focusLeftAndBack(['active', 'inactive'])).toBe(false)
  expect(focusLeftAndBack(['inactive', 'active', 'inactive'])).toBe(false)
  expect(focusLeftAndBack(['inactive', 'background', 'active', 'active'])).toBe(false)
})
