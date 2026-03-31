import type * as React from 'react'
import type {RouteProp} from '@react-navigation/native'
// import type {StaticParamList} from '@react-navigation/core'
import type {newRoutes as chatNewRoutes, newModalRoutes as chatNewModalRoutes} from '../chat/routes'
import type {newRoutes as cryptoNewRoutes, newModalRoutes as cryptoNewModalRoutes} from '../crypto/routes'
import type {newRoutes as deviceNewRoutes, newModalRoutes as deviceNewModalRoutes} from '../devices/routes'
import type {newRoutes as fsNewRoutes, newModalRoutes as fsNewModalRoutes} from '../fs/routes'
import type {newRoutes as gitNewRoutes, newModalRoutes as gitNewModalRoutes} from '../git/routes'
import type {newRoutes as loginNewRoutes, newModalRoutes as loginNewModalRoutes} from '../login/routes'
import type {newRoutes as peopleNewRoutes, newModalRoutes as peopleNewModalRoutes} from '../people/routes'
import type {newRoutes as profileNewRoutes, newModalRoutes as profileNewModalRoutes} from '../profile/routes'
import type {newRoutes as settingsNewRoutes, newModalRoutes as settingsNewModalRoutes} from '../settings/routes'
import type {newRoutes as signupNewRoutes, newModalRoutes as signupNewModalRoutes} from '../signup/routes'
import type {newRoutes as teamsNewRoutes, newModalRoutes as teamsNewModalRoutes} from '../teams/routes'
import type {newModalRoutes as walletsNewModalRoutes} from '../wallets/routes'
import type {newModalRoutes as incomingShareNewModalRoutes} from '../incoming-share/routes'

// tsgo bug: StaticParamList is the idiomatic React Navigation equivalent of _ExtractParams,
// but tsgo reports "TS2315: Type 'StaticParamList' is not generic" (works fine with regular tsc).
// Once tsgo fixes re-exported generic type aliases, replace _ExtractParams:
//   type _SyntheticConfig = {readonly config: {readonly screens: _AllScreens}}
//   export type RootParamList = StaticParamList<_SyntheticConfig> & Tabs & {...}
type IsUnknown<T> = unknown extends T ? ([keyof T] extends [never] ? true : false) : false
type NormalizeParams<T> = IsUnknown<T> extends true ? undefined : T extends object | undefined ? T : undefined
type ExtractScreenParams<Screen> =
  Screen extends React.LazyExoticComponent<infer Inner>
    ? ExtractScreenParams<Inner>
    : Screen extends React.ComponentType<infer Props>
      ? Props extends {route: {params: infer Params}}
        ? NormalizeParams<Params>
        : Props extends {route: {params?: infer Params}}
          ? NormalizeParams<Params>
          : undefined
      : undefined
type _ExtractParams<T> = {
  [K in keyof T]: T[K] extends {screen: infer Screen} ? ExtractScreenParams<Screen> : undefined
}

type Tabs = {
  'tabs.chatTab': undefined
  'tabs.cryptoTab': undefined
  'tabs.devicesTab': undefined
  'tabs.folderTab': undefined
  'tabs.loginTab': undefined
  'tabs.peopleTab': undefined
  'tabs.searchTab': undefined
  'tabs.settingsTab': undefined
  'tabs.teamsTab': undefined
  'tabs.gitTab': undefined
  'tabs.fsTab': undefined
  'tabs.walletsTab': undefined
}

type TabRoots =
  | 'peopleRoot'
  | 'chatRoot'
  | 'cryptoRoot'
  | 'fsRoot'
  | 'teamsRoot'
  | 'walletsRoot'
  | 'gitRoot'
  | 'devicesRoot'
  | 'settingsRoot'

type _AllScreens =
  & typeof deviceNewRoutes
  & typeof chatNewRoutes
  & typeof cryptoNewRoutes
  & typeof peopleNewRoutes
  & typeof profileNewRoutes
  & typeof fsNewRoutes
  & typeof settingsNewRoutes
  & typeof teamsNewRoutes
  & typeof gitNewRoutes
  & typeof chatNewModalRoutes
  & typeof cryptoNewModalRoutes
  & typeof deviceNewModalRoutes
  & typeof fsNewModalRoutes
  & typeof gitNewModalRoutes
  & typeof loginNewModalRoutes
  & typeof peopleNewModalRoutes
  & typeof profileNewModalRoutes
  & typeof settingsNewModalRoutes
  & typeof signupNewModalRoutes
  & typeof teamsNewModalRoutes
  & typeof walletsNewModalRoutes
  & typeof incomingShareNewModalRoutes
  & typeof loginNewRoutes
  & typeof signupNewRoutes

export type RootParamList = _ExtractParams<_AllScreens> &
  Tabs & {loading: undefined; loggedOut: undefined; loggedIn: undefined}

export type RouteKeys = keyof RootParamList
type AllOptional<T> = {
  [K in keyof T]-?: undefined extends T[K] ? true : false
}[keyof T] extends true
  ? true
  : false
type Distribute<U> = U extends RouteKeys
  ? RootParamList[U] extends undefined
    ? U
    : AllOptional<RootParamList[U]> extends true
      ? {name: U; params: RootParamList[U]} | U
      : {name: U; params: RootParamList[U]}
  : never
export type NavigateAppendType = Distribute<RouteKeys>

type MaybeMissingParamsRouteProp<RouteName extends keyof RootParamList> = Omit<
  RouteProp<RootParamList, RouteName>,
  'params'
> & {
  params?: RootParamList[RouteName]
}

export type RootRouteProps<RouteName extends keyof RootParamList> = RouteName extends TabRoots
  ? MaybeMissingParamsRouteProp<RouteName>
  : RouteProp<RootParamList, RouteName>

export function getRouteParamsFromRoute<T extends keyof RootParamList>(
  route: unknown
): RootParamList[T] | undefined {
  return (route as {params?: RootParamList[T]} | undefined)?.params
}
