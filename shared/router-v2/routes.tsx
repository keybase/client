import {newRoutes as chatNewRoutes, newModalRoutes as chatNewModalRoutes} from '../chat/routes'
import {newRoutes as cryptoNewRoutes, newModalRoutes as cryptoNewModalRoutes} from '../crypto/routes'
import {newRoutes as deviceNewRoutes, newModalRoutes as deviceNewModalRoutes} from '../devices/routes'
import {newRoutes as fsNewRoutes, newModalRoutes as fsNewModalRoutes} from '@/fs/routes'
import {newRoutes as gitNewRoutes, newModalRoutes as gitNewModalRoutes} from '../git/routes'
import {newRoutes as _loggedOutRoutes, newModalRoutes as loginNewModalRoutes} from '../login/routes'
import {newRoutes as peopleNewRoutes, newModalRoutes as peopleNewModalRoutes} from '../people/routes'
import {newRoutes as profileNewRoutes, newModalRoutes as profileNewModalRoutes} from '../profile/routes'
import {newRoutes as settingsNewRoutes, newModalRoutes as settingsNewModalRoutes} from '../settings/routes'
import {newRoutes as signupNewRoutes, newModalRoutes as signupNewModalRoutes} from '../signup/routes'
import {newRoutes as teamsNewRoutes, newModalRoutes as teamsNewModalRoutes} from '../teams/routes'
import {newModalRoutes as walletsNewModalRoutes} from '../wallets/routes'
import {newModalRoutes as incomingShareNewModalRoutes} from '../incoming-share/routes'
import {isMobile} from '@/constants/platform'
import * as Tabs from '@/constants/tabs'
import type {RouteMap} from '@/constants/types/router2'

// We have normal routes, modal routes, and logged out routes.
// We also end up using existence of a nameToTab value for a route as a test
// of whether we're on a loggedIn route: loggedOut routes have no selected tab.
export const routes: RouteMap = {}

type RoutePlusTab = {route: RouteMap; tab: Tabs.Tab}

// Need all these as clauses as TS will ignore everything if it sees a single any
const _newRoutes: ReadonlyArray<RoutePlusTab> = [
  {route: deviceNewRoutes, tab: isMobile ? Tabs.settingsTab : Tabs.devicesTab} as RoutePlusTab,
  {route: chatNewRoutes, tab: Tabs.chatTab} as RoutePlusTab,
  {route: cryptoNewRoutes, tab: Tabs.cryptoTab} as RoutePlusTab,
  {route: peopleNewRoutes, tab: Tabs.peopleTab} as RoutePlusTab,
  {route: profileNewRoutes, tab: Tabs.peopleTab} as RoutePlusTab,
  {route: fsNewRoutes, tab: Tabs.fsTab} as RoutePlusTab,
  {route: settingsNewRoutes, tab: Tabs.settingsTab} as RoutePlusTab,
  {route: teamsNewRoutes, tab: Tabs.teamsTab} as RoutePlusTab,
  {route: gitNewRoutes, tab: Tabs.gitTab} as RoutePlusTab,
]

const seenNames = new Set()
_newRoutes.forEach(({route}) => {
  Object.keys(route).forEach(name => {
    // Just sanity check dupes
    if (seenNames.has(name)) {
      throw new Error('New route with dupe name, disallowed! ' + name)
    }
    seenNames.add(name)
    routes[name] = route[name]
  })
})

export const tabRoots = {
  [Tabs.peopleTab]: 'peopleRoot',
  [Tabs.chatTab]: 'chatRoot',
  [Tabs.cryptoTab]: 'cryptoRoot',
  [Tabs.fsTab]: 'fsRoot',
  [Tabs.teamsTab]: 'teamsRoot',
  [Tabs.gitTab]: 'gitRoot',
  [Tabs.devicesTab]: 'devicesRoot',
  [Tabs.settingsTab]: 'settingsRoot',

  [Tabs.loginTab]: '',
  [Tabs.searchTab]: '',
} as const

const _modalRoutes = [
  chatNewModalRoutes as RouteMap,
  cryptoNewModalRoutes as RouteMap,
  deviceNewModalRoutes as RouteMap,
  fsNewModalRoutes as RouteMap,
  gitNewModalRoutes as RouteMap,
  loginNewModalRoutes as RouteMap,
  peopleNewModalRoutes as RouteMap,
  profileNewModalRoutes as RouteMap,
  settingsNewModalRoutes as RouteMap,
  signupNewModalRoutes as RouteMap,
  teamsNewModalRoutes as RouteMap,
  walletsNewModalRoutes as RouteMap,
  incomingShareNewModalRoutes as RouteMap,
]

export const modalRoutes: RouteMap = _modalRoutes.reduce<RouteMap>((obj, modal) => {
  for (const name of Object.keys(modal)) {
    if (obj[name]) {
      throw new Error('New modal route with dupe name, disallowed! ' + name)
    }
    obj[name] = modal[name]
  }
  return obj
}, {})

export const loggedOutRoutes: RouteMap = {..._loggedOutRoutes, ...signupNewRoutes}
