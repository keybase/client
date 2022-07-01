import type {RouteProp} from '@react-navigation/native'
import type {RootParamListGit} from '../git/routes'
import type {RootParamListPeople} from '../people/routes'
import type {RootParamListProfile} from '../profile/routes'
import type {RootParamListFS} from '../fs/routes'
import type {RootParamListTeams} from '../teams/routes'
import type {RootParamListChat} from '../chat/routes'
import type {RootParamListWallets} from '../wallets/routes'
import type {RootParamListDevices} from '../devices/routes'
import type {RootParamListCrypto} from '../crypto/routes'
import type {RootParamListLogin} from '../login/routes'
import type {RootParamListSettings} from '../settings/routes'
import type {RootParamListSignup} from '../signup/routes'
import type {RootParamListIncomingShare} from '../incoming-share/routes'

// TODO partial could go away when we enforce these params are pushed correctly
type DeepPartial<Type> = {
  [Property in keyof Type]?: Partial<Type[Property]>
}

export type RootParamList = DeepPartial<
  RootParamListIncomingShare &
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
    RootParamListGit & {
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
>

type RouteKeys = keyof RootParamList
type Distribute<U> = U extends RouteKeys ? {selected: U; props: RootParamList[U]} : never
export type NavigateAppendType = ReadonlyArray<RouteKeys | Distribute<RouteKeys>>

export type RootRouteProps<RouteName extends keyof RootParamList> = RouteProp<RootParamList, RouteName>

export type RouteProps<RouteName extends keyof RootParamList> = {
  route: RouteProp<RootParamList, RouteName>
  navigation: {
    pop: () => void
  }
}

export function getRouteParams<T extends keyof RootParamList>(ownProps: any): RootParamList[T] | undefined {
  return ownProps?.route?.params as RootParamList[T]
}

export function getRouteParamsFromRoute<T extends keyof RootParamList>(
  route: any
): RootParamList[T] | undefined {
  return route?.params as RootParamList[T]
}
