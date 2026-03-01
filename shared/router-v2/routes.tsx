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
import type {GetOptions, GetOptionsParams, GetOptionsRet, RouteDef, RouteMap} from '@/constants/types/router'
import type {RootParamList as KBRootParamList} from '@/router-v2/route-params'
import {createNativeStackNavigator} from '@react-navigation/native-stack'
import {createComponentForStaticNavigation} from '@react-navigation/core'
import type {NativeStackNavigationOptions} from '@react-navigation/native-stack'

// We have normal routes, modal routes, and logged out routes.
// We also end up using existence of a nameToTab value for a route as a test
// of whether we're on a loggedIn route: loggedOut routes have no selected tab.
export const routes = {
  ...deviceNewRoutes,
  ...chatNewRoutes,
  ...cryptoNewRoutes,
  ...peopleNewRoutes,
  ...profileNewRoutes,
  ...fsNewRoutes,
  ...settingsNewRoutes,
  ...teamsNewRoutes,
  ...gitNewRoutes,
} satisfies RouteMap

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

export const modalRoutes = {
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
} satisfies RouteMap

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

export const loggedOutRoutes = {..._loggedOutRoutes, ...signupNewRoutes} satisfies RouteMap

type LayoutFn = (props: {
  children: React.ReactNode
  route: GetOptionsParams['route']
  navigation: GetOptionsParams['navigation']
}) => React.ReactNode
type MakeLayoutFn = (isModal: boolean, isLoggedOut: boolean, getOptions?: GetOptions) => LayoutFn
type OptionsFn = (params: GetOptionsParams) => GetOptionsRet
type MakeOptionsFn = (rd: RouteDef) => OptionsFn

type StaticScreenConfig = {
  if?: () => boolean
  layout: LayoutFn
  options: OptionsFn
  screen: React.ComponentType<any>
}
export type StaticScreensConfig = Record<string, StaticScreenConfig>

export function routeMapToStaticScreens<T extends RouteMap>(
  rs: T,
  makeLayoutFn: MakeLayoutFn,
  makeOptionsFn: MakeOptionsFn,
  isModal: boolean,
  isLoggedOut: boolean
): {[K in keyof T & string]: StaticScreenConfig} {
  const result: Record<string, StaticScreenConfig> = {}
  for (const [name, rd] of Object.entries(rs)) {
    if (!rd) continue
    result[name] = {
      layout: makeLayoutFn(isModal, isLoggedOut, rd.getOptions),
      options: makeOptionsFn(rd),
      screen: rd.screen,
    }
  }
  return result as {[K in keyof T & string]: StaticScreenConfig}
}

export function routeMapToScreenElements(
  rs: RouteMap,
  Screen: React.ComponentType<any>,
  makeLayoutFn: MakeLayoutFn,
  makeOptionsFn: MakeOptionsFn,
  isModal: boolean,
  isLoggedOut: boolean
) {
  return (Object.keys(rs) as Array<keyof KBRootParamList>).flatMap(name => {
    const rd = rs[name as string]
    if (!rd) return []
    return [
      <Screen
        key={String(name)}
        name={name}
        component={rd.screen}
        layout={makeLayoutFn(isModal, isLoggedOut, rd.getOptions)}
        options={makeOptionsFn(rd)}
      />,
    ]
  })
}

// Creates a static stack navigator component from a config object.
// Encapsulates the `as any` boundary needed because our RouteMap has dynamic
// string keys while React Navigation's static API infers ParamList from
// literal screen names.
export function createStaticStackComponent(
  config: {
    groups?: Record<
      string,
      {
        if?: () => boolean
        screenOptions?: NativeStackNavigationOptions
        screens: StaticScreensConfig | Record<string, {screen: React.ComponentType}>
      }
    >
    initialRouteName?: string
    screenOptions?: NativeStackNavigationOptions
    screens?: StaticScreensConfig | Record<string, {screen: React.ComponentType}>
  },
  displayName: string
): React.ComponentType {
  // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
  const nav = createNativeStackNavigator(config as any)
  // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
  return createComponentForStaticNavigation(nav as any, displayName)
}
