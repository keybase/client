import type {RouteProp} from '@react-navigation/native'
import type {NativeStackNavigationProp} from '@react-navigation/native-stack'
import type {routes, modalRoutes, loggedOutRoutes} from './routes'

// tsgo bug: StaticParamList is the idiomatic React Navigation equivalent of _ExtractParams,
// but tsgo reports "TS2315: Type 'StaticParamList' is not generic" (works fine with regular tsc).
// Once tsgo fixes re-exported generic type aliases, replace _ExtractParams:
//   type _SyntheticConfig = {readonly config: {readonly screens: _AllScreens}}
//   export type RootParamList = StaticParamList<_SyntheticConfig> & Tabs & {...}
//
// Similarly, avoid matching on RouteDef<any, infer Params> — tsgo fails to infer Params
// through conditional types in RouteDef's field definitions. Instead, extract params
// directly from the screen function's route prop, which tsgo handles correctly.
type _ExtractParams<T> = {
  [K in keyof T]: T[K] extends {screen: infer U}
    ? U extends (args: infer V) => any
      ? V extends {route: {params: infer W}}
        ? W
        : V extends {route: {params?: infer W}}
          ? W
          : {}
      : {}
    : {}
}

type Tabs = {
  'tabs.chatTab': {}
  'tabs.cryptoTab': {}
  'tabs.devicesTab': {}
  'tabs.folderTab': {}
  'tabs.loginTab': {}
  'tabs.peopleTab': {}
  'tabs.searchTab': {}
  'tabs.settingsTab': {}
  'tabs.teamsTab': {}
  'tabs.gitTab': {}
  'tabs.fsTab': {}
  'tabs.walletsTab': {}
}

type _AllScreens = typeof routes & typeof modalRoutes & typeof loggedOutRoutes

export type RootParamList = _ExtractParams<_AllScreens> &
  Tabs & {loading: {}; loggedOut: {}; loggedIn: {}}

export type RouteKeys = keyof RootParamList
export type NavigateAppendArg<RouteName extends RouteKeys> = RouteName extends RouteName
  ? {name: RouteName; params: RootParamList[RouteName]}
  : never
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
