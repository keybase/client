import {StackNavigationProp} from '@react-navigation/stack'
import {RouteProp} from '@react-navigation/native'

import {ParamList as ChatParamList, ModalParamList as ChatModalParamList} from '../chat/route-types'
import {ParamList as CryptoParamList} from '../crypto/route-types'
import {ParamList as FSParamList} from '../fs/route-types'
import {ParamList as GitParamList} from '../git/route-types'
import {ParamList as LoginParamList} from '../login/route-types'
import {ParamList as PeopleParamList} from '../people/route-types'
import {ParamList as ProfileParamList} from '../profile/route-types'
import {ParamList as SettingsParamList} from '../settings/route-types'
import {ParamList as SignupParamList} from '../signup/route-types'
import {ParamList as TeamsParamList} from '../teams/route-types'
import {ParamList as WalletsParamList} from '../wallets/route-types'

export type ParamList = ChatParamList &
  CryptoParamList &
  FSParamList &
  GitParamList &
  LoginParamList &
  PeopleParamList &
  ProfileParamList &
  SettingsParamList &
  SignupParamList &
  TeamsParamList &
  WalletsParamList

// TODO
export type ModalParamList = {
  Tabs: undefined
} & ChatModalParamList

export type ScreenProps<NAME extends keyof ParamList> = {
  navigation: StackNavigationProp<ParamList, NAME>
  route: RouteProp<ParamList, NAME>
}

export type ModalScreenProps<NAME extends keyof ModalParamList> = {
  navigation: StackNavigationProp<ModalParamList, NAME>
  route: RouteProp<ModalParamList, NAME>
}
