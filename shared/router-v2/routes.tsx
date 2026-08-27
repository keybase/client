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
import type * as React from 'react'
import * as Tabs from '@/constants/tabs'
import {defineRouteMap} from '@/constants/types/router'
import type {GetOptions, GetOptionsParams, GetOptionsRet, RouteDef} from '@/constants/types/router'
import type {NativeStackNavigationOptions} from '@react-navigation/native-stack'

// The spread silently keeps the last route on a name collision, so assert uniqueness in dev
const assertNoDuplicateRouteNames = (...maps: Array<Record<string, unknown>>) => {
  const seen = new Set<string>()
  for (const m of maps) {
    for (const k of Object.keys(m)) {
      if (seen.has(k)) throw new Error('Duplicate route name: ' + k)
      seen.add(k)
    }
  }
}

// We have normal routes, modal routes, and logged out routes.
// We also end up using existence of a nameToTab value for a route as a test
// of whether we're on a loggedIn route: loggedOut routes have no selected tab.
export const routes = defineRouteMap({
  ...deviceNewRoutes,
  ...chatNewRoutes,
  ...cryptoNewRoutes,
  ...peopleNewRoutes,
  ...profileNewRoutes,
  ...fsNewRoutes,
  ...settingsNewRoutes,
  ...teamsNewRoutes,
  ...gitNewRoutes,
})

if (__DEV__) {
  assertNoDuplicateRouteNames(
    deviceNewRoutes,
    chatNewRoutes,
    cryptoNewRoutes,
    peopleNewRoutes,
    profileNewRoutes,
    fsNewRoutes,
    settingsNewRoutes,
    teamsNewRoutes,
    gitNewRoutes
  )
}

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

export const modalRoutes = defineRouteMap({
  ...chatNewModalRoutes,
  ...cryptoNewModalRoutes,
  ...deviceNewModalRoutes,
  ...fsNewModalRoutes,
  ...gitNewModalRoutes,
  ...loginNewModalRoutes,
  ...peopleNewModalRoutes,
  ...profileNewModalRoutes,
  ...settingsNewModalRoutes,
  ...signupNewModalRoutes,
  ...teamsNewModalRoutes,
  ...walletsNewModalRoutes,
  ...incomingShareNewModalRoutes,
})

if (__DEV__) {
  assertNoDuplicateRouteNames(
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
    incomingShareNewModalRoutes
  )
}

export const loggedOutRoutes = defineRouteMap({..._loggedOutRoutes, ...signupNewRoutes})

type LayoutFn = (props: {
  children: React.ReactNode
  route: GetOptionsParams['route']
  navigation: GetOptionsParams['navigation']
}) => React.ReactNode
type MakeLayoutFn = (
  isModal: boolean,
  isLoggedOut: boolean,
  isTabScreen: boolean,
  getOptions?: GetOptions
) => LayoutFn
type CheckedRouteEntry<Routes extends Record<string, RouteDef>> = Routes[keyof Routes]

function toNavOptions(opts: GetOptionsRet): NativeStackNavigationOptions {
  if (!opts) return {}
  return opts as NativeStackNavigationOptions
}

// iOS unhides a hidden UINavigationBar mid-push (setNavigationBarHidden:NO animated:YES), which
// makes UIKit slide the whole bar in from the right as its own animated plane, desynced from the
// screen slide — the push judders and flashes the target screen (react-native-screens#3773).
// Only headerless->headered pushes hit it; header->header is fine, and modals present rather than
// push so they may hide their bar freely. A pushed screen that wants no header must therefore keep
// an EMPTY bar instead: see the RNS_EMPTY_BAR options on the tabs screen in router.tsx and the
// `{headerShown: true, title: ''}` login route in login/routes.tsx.
const assertHeaderShown = (name: string, opts: NativeStackNavigationOptions, isModal: boolean) => {
  if (!isMobile || isModal || opts.headerShown !== false) return
  throw new Error(
    `Route '${name}' sets headerShown:false on a pushed screen. Pushing from it to a headered ` +
      `screen judders on iOS (react-native-screens#3773). Render an empty bar instead: ` +
      `{headerShown: true, title: ''}.`
  )
}

export function routeMapToStaticScreens<const RS extends Record<string, RouteDef>>(
  rs: RS,
  makeLayoutFn: MakeLayoutFn,
  isModal: boolean,
  isLoggedOut: boolean,
  isTabScreen: boolean
) {
  const result: Record<
    string,
    {
      initialParams?: object
      layout: (props: any) => React.ReactElement
      options: (p: {route: any; navigation: any}) => NativeStackNavigationOptions
      screen: React.ComponentType<any>
    }
  > = {}
  for (const [name, rd] of Object.entries(rs) as Array<[string, CheckedRouteEntry<RS>]>) {
    result[name] = {
      ...(rd.initialParams === undefined ? {} : {initialParams: rd.initialParams as object}),
      // Layout functions return JSX (ReactElement) and accept any route/navigation.
      // Cast bridges our specific KBRootParamList types to RN's generic ParamListBase.
      layout: makeLayoutFn(isModal, isLoggedOut, isTabScreen, rd.getOptions) as (props: any) => React.ReactElement,
      options: ({route, navigation}: {route: any; navigation: any}) => {
        const go = rd.getOptions
        const opts = typeof go === 'function' ? go({navigation, route}) : go
        const navOpts = toNavOptions(opts)
        if (__DEV__) {
          assertHeaderShown(name, navOpts, isModal)
        }
        return navOpts
      },
      screen: rd.screen,
    }
  }
  return result
}
