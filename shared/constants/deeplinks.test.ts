/** @jest-environment jsdom */
/// <reference types="jest" />
import * as Tabs from './tabs'
import * as NavTree from './nav-tree'
import {settingsDevicesTab} from './settings'
import {handleAppLink} from './deeplinks'
import {installNavigation, makeRootState, type Layout, type MountedNavigation} from '@/test/navigation'

let nav: MountedNavigation

const withIsMobile = (isMobile: boolean, f: () => void) => {
  const was = global.isMobile
  global.isMobile = isMobile
  try {
    f()
  } finally {
    global.isMobile = was
  }
}

// The tree as it stands when a link arrives: chat's tab root showing, nothing above it.
// The native tab navigator mounts a tab on first focus, so `visited` tabs start with their stacks
// up. The desktop one mounts every tab, each in a hidden Activity that React renders after the
// visible tab, so a desktop app is settled once every tab's stack has come up.
const atChat = (layout: Layout, visited: ReadonlyArray<Tabs.AppTab> = []) => {
  const base = makeRootState({tab: Tabs.chatTab}) as {routes: Array<NavTree.Route>}
  const loggedIn = base.routes[0]!
  const tabs = loggedIn.state as {index: number; routes: Array<object>}
  const rootState = {
    ...base,
    routes: [
      {
        ...loggedIn,
        state: {
          ...tabs,
          routes: [
            ...tabs.routes,
            ...visited.map(tab => ({
              key: tab,
              name: tab,
              state: {index: 0, routes: [{key: `${NavTree.tabRoots[tab]}-0`, name: NavTree.tabRoots[tab]}]},
            })),
          ],
        },
      },
      ...base.routes.slice(1),
    ],
  } as NavTree.NavState
  nav = installNavigation({layout, rootState})
}

const tabStacksUp = () => {
  const loggedIn = nav.getRootState()?.routes?.[0]?.state as {routes: ReadonlyArray<{state?: object}>} | undefined
  return !!loggedIn?.routes.every(r => r.state)
}

const atChatOnDesktop = async () => {
  atChat('desktop')
  for (let i = 0; i < 50 && !tabStacksUp(); i++) {
    await new Promise(resolve => setTimeout(resolve, 1))
  }
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
// One call covers phone and tablet: the push carries no target, so it is handled by whichever
// navigator registers the route -- the root stack above the tabs on a phone, the Settings tab
// stack on a tablet. navUpToScreen cannot do that; it pins its popTo to the active stack, which
// at a tab root on a phone is the Settings tab stack, where the route does not exist.
// The tablet case starts with Settings already visited: from a never-visited Settings tab the push
// is not handled (the tab's stack is not mounted yet when it is dispatched).
test.each<Layout>(['phone', 'tablet'])('a devices link shows the devices screen on a %s', layout => {
  atChat(layout, layout === 'tablet' ? [Tabs.settingsTab] : [])
  withIsMobile(true, () => {
    handleAppLink('keybase://devices')
  })
  expect(tabOf()).toBe(Tabs.settingsTab)
  expect(nav.visibleScreen()?.name).toBe(settingsDevicesTab)
})

test('on a phone the devices screen sits on the root stack above the tabs', () => {
  atChat('phone')
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
