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

const _newRoutes = [
  {route: deviceNewRoutes, tab: isMobile ? Tabs.settingsTab : Tabs.devicesTab},
  {route: chatNewRoutes, tab: Tabs.chatTab},
  {route: cryptoNewRoutes, tab: Tabs.cryptoTab},
  {route: peopleNewRoutes, tab: Tabs.peopleTab},
  {route: profileNewRoutes, tab: Tabs.peopleTab},
  {route: fsNewRoutes, tab: Tabs.fsTab},
  {route: settingsNewRoutes, tab: Tabs.settingsTab},
  {route: teamsNewRoutes, tab: Tabs.teamsTab},
  {route: gitNewRoutes, tab: Tabs.gitTab},
] satisfies ReadonlyArray<RoutePlusTab>

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
  chatNewModalRoutes,
  cryptoNewModalRoutes,
  deviceNewModalRoutes,
  fsNewModalRoutes,
  gitNewModalRoutes,
  loginNewModalRoutes,
  peopleNewModalRoutes,
  profileNewModalRoutes,
  settingsNewModalRoutes,
  signupNewModalRoutes,
  teamsNewModalRoutes,
  walletsNewModalRoutes,
  incomingShareNewModalRoutes,
] satisfies ReadonlyArray<RouteMap>

export const modalRoutes = _modalRoutes.reduce((obj, modal) => {
  for (const name of Object.keys(modal)) {
    if (obj[name]) {
      throw new Error('New modal route with dupe name, disallowed! ' + name)
    }
    obj[name] = modal[name]
  }
  return obj
}, {} as RouteMap) satisfies RouteMap

export const loggedOutRoutes: RouteMap = {..._loggedOutRoutes, ...signupNewRoutes}
