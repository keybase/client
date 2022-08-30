import type {Details, Assertion} from '../constants/types/tracker2'
import type {State as ConfigState} from '../constants/types/config'
import type {State as UsersState, UserInfo, BlockState} from '../constants/types/users'
import type {State as WaitingState} from '../constants/types/waiting'
import type {RPCError} from '../util/errors'

// for convenience we flatten the props we send over the wire
type ConfigHoistedProps =
  | 'avatarRefreshCounter'
  | 'following'
  | 'followers'
  | 'httpSrvAddress'
  | 'httpSrvToken'
  | 'username'
type UsersHoistedProps = 'infoMap' | 'blockMap'
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
  | 'avatarRefreshCounter'
  | 'assertions'
  | 'blockMap'
  | 'infoMap'
  | 'following'
  | 'followers'
  | 'counts'
  | 'errors'
> & {
  assertions: Array<[string, Assertion]>
  avatarRefreshCounter: Array<[string, number]>
  counts: Array<[string, number]>
  errors: Array<[string, RPCError | undefined]>
  followers: Array<string>
  following: Array<string>
  infoMap: Array<[string, UserInfo]>
  blockMap: Array<[string, BlockState]>
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
  users: {
    blockMap: new Map(),
    infoMap: new Map(),
  },
  waiting: {counts: new Map(), errors: new Map()},
}

export const serialize = (p: ProxyProps): Partial<SerializeProps> => {
  const {
    assertions,
    avatarRefreshCounter,
    following,
    followers,
    infoMap,
    blockMap,
    counts,
    errors,
    trackerUsername,
    ...toSend
  } = p
  return {
    ...toSend,
    assertions: [...(assertions?.entries() ?? [])],
    avatarRefreshCounter: [...avatarRefreshCounter.entries()],
    blockMap: blockMap.has(trackerUsername)
      ? [[trackerUsername, blockMap.get(trackerUsername) ?? {chatBlocked: false, followBlocked: false}]]
      : [],
    counts: [...counts.entries()],
    errors: [...errors.entries()],
    followers: [...followers],
    following: [...following],
    infoMap: [...infoMap.entries()],
    trackerUsername,
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
    bio,
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
    location,
    reason,
    state: trackerState,
    stellarHidden,
    teamShowcase,
    trackerUsername: _trackerUsername,
    username,
    ...rest
  } = props
  const infoMap = props.infoMap ? new Map(props.infoMap) : state.users.infoMap
  const blockMap = props.blockMap ? new Map(props.blockMap) : state.users.blockMap

  const trackerUsername = _trackerUsername ?? state.trackerUsername
  const oldDetails = state.tracker2.usernameToDetails.get(trackerUsername)
  const oldBlocked = state.users.blockMap.get(trackerUsername)?.chatBlocked ?? false

  const details: Details = {
    assertions: assertions ? new Map(assertions) : oldDetails?.assertions,
    bio: bio ?? oldDetails?.bio,
    blocked: blockMap.get(trackerUsername)?.chatBlocked ?? oldBlocked,
    followersCount: followersCount ?? oldDetails?.followersCount,
    followingCount: followingCount ?? oldDetails?.followingCount,
    fullname: fullname ?? oldDetails?.fullname,
    guiID: guiID ?? oldDetails?.guiID,
    hidFromFollowers: hidFromFollowers ?? oldDetails?.hidFromFollowers,
    location: location ?? oldDetails?.location,
    reason: reason ?? oldDetails?.reason,
    resetBrokeTrack: false,
    state: trackerState ?? oldDetails?.state,
    stellarHidden: stellarHidden ?? oldDetails?.stellarHidden,
    teamShowcase: teamShowcase ?? oldDetails?.teamShowcase,
    username: trackerUsername,
  }

  return {
    ...state,
    ...rest,
    config: {
      ...state.config,
      avatarRefreshCounter: avatarRefreshCounter
        ? new Map(avatarRefreshCounter)
        : state.config.avatarRefreshCounter,
      followers: followers ? new Set(followers) : state.config.followers,
      following: following ? new Set(following) : state.config.following,
      httpSrvAddress: httpSrvAddress ?? state.config.httpSrvAddress,
      httpSrvToken: httpSrvToken ?? state.config.httpSrvToken,
      username: username ?? state.config.username,
    },
    tracker2: {usernameToDetails: new Map([[trackerUsername, details]])},
    trackerUsername,
    users: {
      blockMap,
      infoMap,
    },
    waiting: {
      counts: counts ? new Map(counts) : state.waiting.counts,
      errors: errors ? new Map(errors) : state.waiting.errors,
    },
  }
}
