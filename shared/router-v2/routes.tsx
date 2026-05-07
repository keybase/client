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
  const allRouteKeys = [
    ...Object.keys(deviceNewRoutes),
    ...Object.keys(chatNewRoutes),
    ...Object.keys(cryptoNewRoutes),
    ...Object.keys(peopleNewRoutes),
    ...Object.keys(profileNewRoutes),
    ...Object.keys(fsNewRoutes),
    ...Object.keys(settingsNewRoutes),
    ...Object.keys(teamsNewRoutes),
    ...Object.keys(gitNewRoutes),
  ]
  const seen = new Set<string>()
  for (const k of allRouteKeys) {
    if (seen.has(k)) throw new Error('Duplicate route name: ' + k)
    seen.add(k)
  }
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
  const allModalKeys = [
    ...Object.keys(chatNewModalRoutes),
    ...Object.keys(cryptoNewModalRoutes),
    ...Object.keys(deviceNewModalRoutes),
    ...Object.keys(fsNewModalRoutes),
    ...Object.keys(gitNewModalRoutes),
    ...Object.keys(loginNewModalRoutes),
    ...Object.keys(peopleNewModalRoutes),
    ...Object.keys(profileNewModalRoutes),
    ...Object.keys(settingsNewModalRoutes),
    ...Object.keys(signupNewModalRoutes),
    ...Object.keys(teamsNewModalRoutes),
    ...Object.keys(walletsNewModalRoutes),
    ...Object.keys(incomingShareNewModalRoutes),
  ]
  const seen = new Set<string>()
  for (const k of allModalKeys) {
    if (seen.has(k)) throw new Error('Duplicate modal route name: ' + k)
    seen.add(k)
  }
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
type MakeOptionsFn = (rd: RouteDef) => (params: GetOptionsParams) => GetOptionsRet
type CheckedRouteEntry<Routes extends Record<string, RouteDef>> = Routes[keyof Routes]

function toNavOptions(opts: GetOptionsRet): NativeStackNavigationOptions {
  if (!opts) return {}
  return opts as NativeStackNavigationOptions
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
        return toNavOptions(opts)
      },
      screen: rd.screen,
    }
  }
  return result
}

export function routeMapToScreenElements<const RS extends Record<string, RouteDef>>(
  rs: RS,
  Screen: React.ComponentType<any>,
  makeLayoutFn: MakeLayoutFn,
  makeOptionsFn: MakeOptionsFn,
  isModal: boolean,
  isLoggedOut: boolean,
  isTabScreen: boolean
) {
  return (Object.keys(rs) as Array<keyof RS & string>).flatMap(name => {
    const rd = rs[name] as CheckedRouteEntry<RS>
    return [
      <Screen
        key={name}
        name={name}
        component={rd.screen}
        {...(rd.initialParams === undefined ? {} : {initialParams: rd.initialParams})}
        layout={makeLayoutFn(isModal, isLoggedOut, isTabScreen, rd.getOptions)}
        options={makeOptionsFn(rd)}
      />,
    ]
  })
}
