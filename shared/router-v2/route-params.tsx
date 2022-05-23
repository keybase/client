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
import type {RootParamListProvision} from '../provision/routes'
import type {RootParamListSettings} from '../settings/routes'

// TODO partial could go away when we enforce these params are pushed correctly
type DeepPartial<Type> = {
  [Property in keyof Type]?: Partial<Type[Property]>
}

export type RootParamList = DeepPartial<
  RootParamListLogin &
    RootParamListWallets &
    RootParamListChat &
    RootParamListTeams &
    RootParamListFS &
    RootParamListPeople &
    RootParamListProfile &
    RootParamListCrypto &
    RootParamListDevices &
    RootParamListProvision &
    RootParamListSettings &
    RootParamListGit
>
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
