/** @jest-environment jsdom */
/// <reference types="jest" />
// isTablet is read at module load; this lets each test pick the device.
jest.mock('./platform', () => {
  const device = {isTablet: false}
  return {
    ...jest.requireActual<object>('./platform'),
    device,
    get isTablet() {
      return device.isTablet
    },
  }
})
import * as Tabs from './tabs'
import {settingsDevicesTab} from './settings'
import {handleAppLink} from './deeplinks'
import {switchTab} from './router'
import {
  installNavigation,
  makeRootState,
  renders,
  rendersUntil,
  type Layout,
  type MountedNavigation,
} from '@/test/navigation'

let nav: MountedNavigation
const {device} = jest.requireMock<{device: {isTablet: boolean}}>('./platform')

const withIsMobile = (isMobile: boolean, f: () => void, isTablet = false) => {
  const was = global.isMobile
  global.isMobile = isMobile
  device.isTablet = isTablet
  try {
    f()
  } finally {
    global.isMobile = was
    device.isTablet = false
  }
}

// The tree as it stands when a link arrives: chat's tab root showing, nothing above it, having
// visited `visited` first, as a user does. The native tab navigator mounts a tab once it has been
// focused. The desktop one mounts every tab, each in a hidden Activity that React renders after the
// visible tab, so a desktop app is settled once every tab's stack has come up.
const atChat = async (layout: Layout, visited: ReadonlyArray<Tabs.AppTab> = []) => {
  nav = installNavigation({layout, rootState: makeRootState({tab: Tabs.chatTab})})
  for (const tab of visited) {
    switchTab(tab)
    await renders()
  }
  switchTab(Tabs.chatTab)
  await renders()
}

const tabStacksUp = () => {
  const loggedIn = nav.getRootState()?.routes?.[0]?.state as {routes: ReadonlyArray<{state?: object}>} | undefined
  return !!loggedIn?.routes.every(r => r.state)
}

const atChatOnDesktop = async () => {
  await atChat('desktop')
  await rendersUntil(tabStacksUp, 50)
  expect(tabStacksUp()).toBe(true)
}

const tabOf = () => {
  const loggedIn = nav.getRootState()?.routes?.[0]?.state as
    | {index?: number; routes: ReadonlyArray<{name: string}>}
    | undefined
  return loggedIn?.routes[loggedIn.index ?? 0]?.name
}

// On desktop handleAppLink IS the linking subscription's listener (router.tsx passes it as
// both listener and fallback), so this case is the whole implementation there.
test('a devices link opens the devices tab on desktop', async () => {
  await atChatOnDesktop()
  withIsMobile(false, () => {
    handleAppLink('keybase://devices')
  })
  expect(tabOf()).toBe(Tabs.devicesTab)
  expect(nav.visibleScreen()?.name).toBe('devicesRoot')
  expect(nav.pushes()).toEqual([])
})

// The mobile half of this switch is the fallback only: isHandledByLinkingConfig now claims
// keybase://devices, so on mobile every producer routes it to the linking config instead (the
// phone shape it builds is covered by router-v2/linking-phone.test.ts). It still has to be
// phone-correct, because the config is the thing that can stop claiming a URL.
test.each<[Layout, ReadonlyArray<Tabs.AppTab>]>([
  ['phone', []],
  ['tablet', [Tabs.settingsTab]],
  // the native tab navigator has not mounted a never-focused tab's stack, so a push right after
  // switching to it would be dropped
  ['tablet', []],
])('a devices link shows the devices screen on a %s, having visited %j', async (layout, visited) => {
  await atChat(layout, visited)
  withIsMobile(
    true,
    () => {
      handleAppLink('keybase://devices')
    },
    layout === 'tablet'
  )
  await renders()
  expect(tabOf()).toBe(Tabs.settingsTab)
  expect(nav.visibleScreen()?.name).toBe(settingsDevicesTab)
})

test('on a tablet the devices screen sits on the Settings tab stack, above settings root', async () => {
  await atChat('tablet')
  withIsMobile(
    true,
    () => {
      handleAppLink('keybase://devices')
    },
    true
  )
  await renders()
  const loggedIn = nav.getRootState()?.routes?.[0]?.state as
    | {routes: ReadonlyArray<{name: string; state?: {index?: number; routes: ReadonlyArray<{name: string}>}}>}
    | undefined
  const settings = loggedIn?.routes.find(r => r.name === Tabs.settingsTab)?.state
  expect(settings?.routes.map(r => r.name)).toEqual(['settingsRoot', settingsDevicesTab])
  expect(settings?.index).toBe(1)
  expect(nav.getRootState()?.routes?.map(r => r.name)).toEqual(['loggedIn'])
})

test('on a phone the devices screen sits on the root stack above the tabs', async () => {
  await atChat('phone')
  withIsMobile(true, () => {
    handleAppLink('keybase://devices')
  })
  expect(nav.getRootState()?.routes?.map(r => r.name)).toEqual(['loggedIn', settingsDevicesTab])
})

// The invite install link normalizes to this; the linking config handles it on mobile, but
// desktop routes every URL through here, so both have to agree on where it goes.
test('an add-phone link opens the add-phone modal over settings', async () => {
  await atChatOnDesktop()
  withIsMobile(false, () => {
    handleAppLink('keybase://settingsAddPhone')
  })
  expect(tabOf()).toBe(Tabs.settingsTab)
  expect(nav.getRootState()?.routes?.at(-1)?.name).toBe('settingsAddPhone')
})

// The same for the other links that open a screen in a tab: on a tablet the tab may never have
// been opened, so its stack is not mounted when the link arrives.
test.each([
  ['keybase://private/testuser', Tabs.fsTab, 'fsRoot', 'fsBrowse'],
  ['keybase://profile/show/testuser', Tabs.peopleTab, 'peopleRoot', 'profile'],
] as const)('on a tablet %s lands on its tab never opened before', async (link, tab, root, screenName) => {
  nav = installNavigation({layout: 'tablet', rootState: makeRootState({tab: Tabs.chatTab})})
  await renders()
  withIsMobile(
    true,
    () => {
      handleAppLink(link)
    },
    true
  )
  await renders()
  expect(tabOf()).toBe(tab)
  expect(nav.visibleScreen()?.name).toBe(screenName)
  const loggedIn = nav.getRootState()?.routes?.[0]?.state as
    | {routes: ReadonlyArray<{name: string; state?: {routes: ReadonlyArray<{name: string}>}}>}
    | undefined
  expect(loggedIn?.routes.find(r => r.name === tab)?.state?.routes.map(r => r.name)).toEqual([root, screenName])
})
