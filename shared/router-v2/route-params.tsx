import type {routes, modalRoutes, loggedOutRoutes} from './routes'

// StaticParamList is the idiomatic React Navigation equivalent of _ExtractParams, but it
// infers `unknown` params for our React.lazy screens that take no props (its ComponentType
// match is unconstrained under contravariance), which would make navigate() to those screens
// accept anything. _ExtractParams matches the lazy call signature directly and yields {}.
// -? strips optionality from __DEV__-conditional route entries; otherwise indexed access
// over the param list (React Navigation's ParamListRoute) unions in `undefined`.
type _ExtractParams<T> = {
  [K in keyof T]-?: T[K] extends {screen: infer U}
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
