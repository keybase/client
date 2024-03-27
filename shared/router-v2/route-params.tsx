import type {RouteProp} from '@react-navigation/native'
import type {RootParamListGit} from '../git/routes'
import type {RootParamListPeople} from '../people/routes'
import type {RootParamListProfile} from '../profile/routes'
import type {RootParamListFS} from '@/fs/routes'
import type {RootParamListTeams} from '../teams/routes'
import type {RootParamListChat} from '../chat/routes'
import type {RootParamListWallets} from '../wallets/routes'
import type {RootParamListDevices} from '../devices/routes'
import type {RootParamListCrypto} from '../crypto/routes'
import type {RootParamListLogin} from '../login/routes'
import type {RootParamListSettings} from '../settings/routes'
import type {RootParamListSignup} from '../signup/routes'
import type {RootParamListIncomingShare} from '../incoming-share/routes'

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

export type RootParamList = RootParamListIncomingShare &
  RootParamListSignup &
  RootParamListLogin &
  RootParamListWallets &
  RootParamListChat &
  RootParamListTeams &
  RootParamListFS &
  RootParamListPeople &
  RootParamListProfile &
  RootParamListCrypto &
  RootParamListDevices &
  RootParamListSettings &
  RootParamListGit &
  Tabs & {loggedIn: undefined}

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
      ? {selected: U; props: RootParamList[U]} | U
      : {selected: U; props: RootParamList[U]}
  : never
export type NavigateAppendType = Distribute<RouteKeys>

export type RootRouteProps<RouteName extends keyof RootParamList> = RouteProp<RootParamList, RouteName>

// most roots have no params but chat can get it set after the fact in some flows
export type RouteProps2<RouteName extends keyof RootParamList> = {
  route: RouteName extends TabRoots
    ? Partial<RouteProp<RootParamList, RouteName>>
    : RouteProp<RootParamList, RouteName>
  navigation: {
    pop: () => void
  }
}

export function getRouteParamsFromRoute<T extends keyof RootParamList>(
  route: unknown
): RootParamList[T] | undefined {
  return (route as {params?: RootParamList[T]} | undefined)?.params
}
