import type * as React from 'react'
import type {RouteProp} from '@react-navigation/native'
import type {NativeStackNavigationProp} from '@react-navigation/native-stack'
import type {RouteDef} from '@/constants/types/router'
import type {newRoutes as chatNewRoutes, newModalRoutes as chatNewModalRoutes} from '../chat/routes'
import type {newRoutes as cryptoNewRoutes, newModalRoutes as cryptoNewModalRoutes} from '../crypto/routes'
import type {newRoutes as deviceNewRoutes, newModalRoutes as deviceNewModalRoutes} from '../devices/routes'
import type {newRoutes as fsNewRoutes, newModalRoutes as fsNewModalRoutes} from '../fs/routes'
import type {newRoutes as gitNewRoutes, newModalRoutes as gitNewModalRoutes} from '../git/routes'
import type {newRoutes as loginNewRoutes, newModalRoutes as loginNewModalRoutes} from '../login/routes'
import type {newRoutes as peopleNewRoutes, newModalRoutes as peopleNewModalRoutes} from '../people/routes'
import type {newRoutes as profileNewRoutes, newModalRoutes as profileNewModalRoutes} from '../profile/routes'
import type {
  newRoutes as settingsNewRoutes,
  newModalRoutes as settingsNewModalRoutes,
} from '../settings/routes'
import type {newRoutes as signupNewRoutes, newModalRoutes as signupNewModalRoutes} from '../signup/routes'
import type {newRoutes as teamsNewRoutes, newModalRoutes as teamsNewModalRoutes} from '../teams/routes'
import type {newModalRoutes as walletsNewModalRoutes} from '../wallets/routes'
import type {newModalRoutes as incomingShareNewModalRoutes} from '../incoming-share/routes'

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
type ExtractRouteParams<Route> = Route extends RouteDef<any, infer Params>
  ? NormalizeParams<Params>
  : '__routeParams' extends keyof Route
    ? Route extends {__routeParams?: infer Params}
      ? NormalizeParams<Params>
      : undefined
  : Route extends {screen: infer Screen}
    ? ExtractScreenParams<Screen>
    : undefined

type _ExtractParams<T> = {
  [K in keyof T]: ExtractRouteParams<T[K]>
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

type _AllScreens = typeof deviceNewRoutes &
  typeof chatNewRoutes &
  typeof cryptoNewRoutes &
  typeof peopleNewRoutes &
  typeof profileNewRoutes &
  typeof fsNewRoutes &
  typeof settingsNewRoutes &
  typeof teamsNewRoutes &
  typeof gitNewRoutes &
  typeof chatNewModalRoutes &
  typeof cryptoNewModalRoutes &
  typeof deviceNewModalRoutes &
  typeof fsNewModalRoutes &
  typeof gitNewModalRoutes &
  typeof loginNewModalRoutes &
  typeof peopleNewModalRoutes &
  typeof profileNewModalRoutes &
  typeof settingsNewModalRoutes &
  typeof signupNewModalRoutes &
  typeof teamsNewModalRoutes &
  typeof walletsNewModalRoutes &
  typeof incomingShareNewModalRoutes &
  typeof loginNewRoutes &
  typeof signupNewRoutes

type KeybaseRootParamList = _ExtractParams<_AllScreens> &
  Tabs & {loading: undefined; loggedOut: undefined; loggedIn: undefined}
export type RootParamList = KeybaseRootParamList

export type RouteKeys = keyof RootParamList
export type NoParamRouteKeys = {
  [K in RouteKeys]: RootParamList[K] extends undefined ? K : never
}[RouteKeys]
export type ParamRouteKeys = Exclude<RouteKeys, NoParamRouteKeys>
export type NavigateAppendArg<RouteName extends RouteKeys> = RootParamList[RouteName] extends undefined
  ? RouteName
  : {name: RouteName; params: RootParamList[RouteName]}
export type NavigateAppendType = NavigateAppendArg<RouteKeys>
export type RootRouteProps<RouteName extends keyof RootParamList> = RouteProp<RootParamList, RouteName>

export type RouteProps2<RouteName extends keyof RootParamList> = {
  route: RootRouteProps<RouteName>
  navigation: NativeStackNavigationProp<RootParamList, RouteName>
}

export function getRouteParamsFromRoute<T extends keyof RootParamList>(
  route: unknown
): RootParamList[T] | undefined {
  return (route as {params?: RootParamList[T]} | undefined)?.params
}
