import type {RouteProp} from '@react-navigation/native'
import type {NativeStackNavigationProp} from '@react-navigation/native-stack'
import type {routes, modalRoutes, loggedOutRoutes} from './routes'

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

type _AllScreens = typeof routes & typeof modalRoutes & typeof loggedOutRoutes

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

export type RootRouteProps<RouteName extends keyof RootParamList> = RouteProp<RootParamList, RouteName>

// most roots have no params but chat can get it set after the fact in some flows
export type RouteProps2<RouteName extends keyof RootParamList> = {
  route: RouteName extends TabRoots
    ? Partial<RouteProp<RootParamList, RouteName>>
    : RouteProp<RootParamList, RouteName>
  navigation: NativeStackNavigationProp<RootParamList, RouteName>
}

export function getRouteParamsFromRoute<T extends keyof RootParamList>(
  route: unknown
): RootParamList[T] | undefined {
  return (route as {params?: RootParamList[T]} | undefined)?.params
}
