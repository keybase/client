import {Details, Assertion} from '../constants/types/tracker2'
import {State as ConfigState} from '../constants/types/config'
import {State as UsersState, UserInfo} from '../constants/types/users'
import {State as WaitingState} from '../constants/types/waiting'
import {RPCError} from '../util/errors'

// for convenience we flatten the props we send over the wire
type ConfigHoistedProps =
  | 'avatarRefreshCounter'
  | 'following'
  | 'followers'
  | 'httpSrvAddress'
  | 'httpSrvToken'
  | 'username'
type UsersHoistedProps = 'infoMap'
type WaitingHoistedProps = 'counts' | 'errors'

export type ProxyProps = {
  darkMode: boolean
  trackerUsername: string
} & Details &
  Pick<ConfigState, ConfigHoistedProps> &
  Pick<UsersState, UsersHoistedProps> &
  Pick<WaitingState, WaitingHoistedProps>

type SerializeProps = Omit<
  ProxyProps,
  'avatarRefreshCounter' | 'assertions' | 'infoMap' | 'following' | 'followers' | 'counts' | 'errors'
> & {
  assertions: Array<[string, Assertion]>
  avatarRefreshCounter: Array<[string, number]>
  counts: Array<[string, number]>
  errors: Array<[string, RPCError | undefined]>
  followers: Array<string>
  following: Array<string>
  infoMap: Array<[string, UserInfo]>
}
export type DeserializeProps = {
  darkMode: boolean
  config: Pick<ConfigState, ConfigHoistedProps>
  users: Pick<UsersState, UsersHoistedProps>
  teams: {teamNameToID: Map<string, string>}
  tracker2: {usernameToDetails: Map<string, Details>}
  trackerUsername: string
  waiting: WaitingState
}

const initialState: DeserializeProps = {
  config: {
    avatarRefreshCounter: new Map(),
    followers: new Set(),
    following: new Set(),
    httpSrvAddress: '',
    httpSrvToken: '',
    username: '',
  },
  darkMode: false,
  teams: {teamNameToID: new Map()},
  tracker2: {usernameToDetails: new Map()},
  trackerUsername: '',
  users: {infoMap: new Map()},
  waiting: {counts: new Map(), errors: new Map()},
}

export const serialize = (p: ProxyProps): [Partial<SerializeProps>, Partial<SerializeProps>] => {
  const {assertions, avatarRefreshCounter, following, followers, infoMap, counts, errors, ...toSend} = p
  return [
    {
      ...toSend,
      assertions: [...(assertions?.entries() ?? [])],
      avatarRefreshCounter: [...avatarRefreshCounter.entries()],
      counts: [...counts.entries()],
      errors: [...errors.entries()],
      followers: [...followers],
      following: [...following],
      infoMap: [...infoMap.entries()],
    },
    {},
  ]
}

export const deserialize = (s: DeserializeProps = initialState, props: SerializeProps): DeserializeProps => {
  if (!props) return s

  const {
    assertions,
    avatarRefreshCounter,
    bio,
    blocked,
    counts,
    errors,
    followers,
    followersCount,
    following,
    followingCount,
    fullname,
    guiID,
    hidFromFollowers,
    httpSrvAddress,
    httpSrvToken,
    infoMap,
    location,
    reason,
    showTracker,
    state,
    stellarHidden,
    teamShowcase,
    trackerUsername,
    username,
    ...rest
  } = props

  const details: Details = {
    assertions: new Map(assertions),
    bio,
    blocked,
    followersCount,
    followingCount,
    fullname,
    guiID,
    hidFromFollowers,
    location,
    reason,
    showTracker: true,
    state,
    stellarHidden,
    teamShowcase,
    username: trackerUsername,
  }

  return {
    ...s,
    ...rest,
    config: {
      ...s.config,
      avatarRefreshCounter: new Map(avatarRefreshCounter),
      followers: new Set(followers),
      following: new Set(following),
      httpSrvAddress,
      httpSrvToken,
      username,
    },
    users: {infoMap: new Map(infoMap)},
    tracker2: {usernameToDetails: new Map([[trackerUsername, details]])},
    trackerUsername,
    waiting: {
      counts: new Map(counts),
      errors: new Map(errors),
    },
  }
}
