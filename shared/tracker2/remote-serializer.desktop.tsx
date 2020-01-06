// import * as Constants from '../constants/tracker2'
// import * as Types from '../constants/types/tracker2'
import {Details, Assertion} from '../constants/types/tracker2'
import {State as ConfigState} from '../constants/types/config'
import {State as UsersState, UserInfo} from '../constants/types/users'
// import shallowEqual from 'shallowequal'

// for convenience we flatten the props we send over the wire
type ConfigHoistedProps =
  | 'avatarRefreshCounter'
  | 'following'
  | 'followers'
  | 'httpSrvAddress'
  | 'httpSrvToken'
  | 'username'
type UsersHoistedProps = 'infoMap'

export type ProxyProps = {
  darkMode: boolean
  // followThem: boolean
  // followsYou: boolean
  isYou: boolean
} & Pick<
  Details,
  | 'assertions'
  | 'bio'
  | 'blocked'
  | 'followersCount'
  | 'followingCount'
  | 'fullname'
  | 'guiID'
  | 'hidFromFollowers'
  | 'location'
  | 'reason'
  | 'state'
  | 'stellarHidden'
  | 'teamShowcase'
> &
  Pick<ConfigState, ConfigHoistedProps> &
  Pick<UsersState, UsersHoistedProps>

type SerializeProps = Omit<
  ProxyProps,
  'avatarRefreshCounter' | 'assertions' | 'infoMap' | 'following' | 'followers'
> & {
  assertions: Array<[string, Assertion]>
  avatarRefreshCounter: Array<[string, number]>
  followers: Array<string>
  following: Array<string>
  infoMap: Array<[string, UserInfo]>
}
export type DeserializeProps = Omit<ProxyProps, ConfigHoistedProps | UsersHoistedProps> & {
  config: Pick<ConfigState, ConfigHoistedProps>
  users: Pick<UsersState, UsersHoistedProps>
  teams: {teamNameToID: Map<string, string>}
  // waiting: boolean
}

const initialState: DeserializeProps = {
  assertions: new Map(),
  blocked: false,
  config: {
    avatarRefreshCounter: new Map(),
    followers: new Set(),
    following: new Set(),
    httpSrvAddress: '',
    httpSrvToken: '',
    username: '',
  },
  darkMode: false,
  // followThem: false,
  // followsYou: false,
  guiID: '',
  hidFromFollowers: false,
  isYou: false,
  reason: '',
  state: 'checking',
  stellarHidden: false,
  teams: {teamNameToID: new Map()},
  users: {infoMap: new Map()},
  // waiting: false,
}

export const serialize = (p: ProxyProps): SerializeProps => {
  const {assertions, avatarRefreshCounter, following, followers, infoMap, ...toSend} = p
  return {
    ...toSend,
    assertions: [...(assertions?.entries() ?? [])],
    avatarRefreshCounter: [...avatarRefreshCounter.entries()],
    followers: [...followers],
    following: [...following],
    infoMap: [...infoMap.entries()],
  }
}

export const deserialize = (
  state: DeserializeProps = initialState,
  props: SerializeProps
): DeserializeProps => {
  if (!props) return state

  const {
    assertions,
    avatarRefreshCounter,
    followers,
    following,
    httpSrvAddress,
    httpSrvToken,
    infoMap,
    username,
    ...rest
  } = props

  return {
    ...state,
    ...rest,
    assertions: new Map(props.assertions),
    config: {
      ...state.config,
      avatarRefreshCounter: new Map(avatarRefreshCounter),
      followers: new Set(followers),
      following: new Set(following),
      httpSrvAddress,
      httpSrvToken,
      username,
    },
    users: {infoMap: new Map(infoMap)},
  }
}
