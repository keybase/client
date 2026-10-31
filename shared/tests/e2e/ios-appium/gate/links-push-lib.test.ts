import {accountLinkLines, deepLinkEvents, focusChanges, GO_BACKGROUND, launchedInto, pushTapLinks, savedRouteIsPeople} from './links-push-lib'

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

test('a cold launch lands on a route only when its first recording starts there and never shows People', () => {
  expect(launchedInto({routes: [], startRoutes: ['loggedIn', 'chatConversation']}, 'chatConversation')).toBe(true)
  // the restored People tab shown first, then the conversation
  expect(launchedInto({routes: ['chatConversation'], startRoutes: ['tabs.peopleTab', 'peopleRoot']}, 'chatConversation')).toBe(false)
  expect(launchedInto({routes: ['peopleRoot'], startRoutes: ['chatConversation']}, 'chatConversation')).toBe(false)
  // a recording from an older bundle, or none at all
  expect(launchedInto({routes: ['chatConversation']}, 'chatConversation')).toBe(false)
  expect(launchedInto(undefined, 'chatConversation')).toBe(false)
})
