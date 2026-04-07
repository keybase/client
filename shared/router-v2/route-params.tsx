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
        : undefined
      : undefined
    : undefined
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

type _AllScreens = typeof routes & typeof modalRoutes & typeof loggedOutRoutes

export type RootParamList = _ExtractParams<_AllScreens> &
  Tabs & {loading: undefined; loggedOut: undefined; loggedIn: undefined}

export type RouteKeys = keyof RootParamList
export type NoParamRouteKeys = {
  [K in RouteKeys]: RootParamList[K] extends undefined ? K : never
}[RouteKeys]
export type ParamRouteKeys = Exclude<RouteKeys, NoParamRouteKeys>
// Routes with required params would break if navigated to without params.
// Routes where all params are optional can be safely navigated to with just a name string.
export type AllOptionalParamRouteKeys = {
  [K in ParamRouteKeys]: {} extends NonNullable<RootParamList[K]> ? K : never
}[ParamRouteKeys]
export type NavigateAppendArg<RouteName extends RouteKeys> = RouteName extends RouteName
  ? RootParamList[RouteName] extends undefined
    ? RouteName
    : {} extends NonNullable<RootParamList[RouteName]>
      ? RouteName | {name: RouteName; params: RootParamList[RouteName]}
      : {name: RouteName; params: RootParamList[RouteName]}
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
