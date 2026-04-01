import type {RouteProp} from '@react-navigation/native'
import type {StaticParamList} from '@react-navigation/core'
import type {NativeStackNavigationProp} from '@react-navigation/native-stack'
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

type _SyntheticConfig = {readonly config: {readonly screens: _AllScreens}}
type AppRouteParamList = StaticParamList<_SyntheticConfig>

type KeybaseRootParamList = AppRouteParamList &
  Tabs & {loading: undefined; loggedOut: undefined; loggedIn: undefined}
export type RootParamList = KeybaseRootParamList

declare global {
  namespace ReactNavigation {
    interface RootParamList extends KeybaseRootParamList {}
  }
}

export type RouteKeys = keyof RootParamList
type Distribute<U> = U extends RouteKeys
  ? RootParamList[U] extends undefined
    ? U
    : {name: U; params: RootParamList[U]}
  : never
export type NavigateAppendType = Distribute<RouteKeys>
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
