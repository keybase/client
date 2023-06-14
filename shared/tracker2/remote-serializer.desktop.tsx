import type {Details, Assertion} from '../constants/types/tracker2'
import type {State as UsersState, UserInfo, BlockState} from '../constants/types/users'
import type {State as WaitingState} from '../constants/types/waiting'
import type {RPCError} from '../util/errors'

// for convenience we flatten the props we send over the wire
type UsersHoistedProps = 'infoMap' | 'blockMap'
type WaitingHoistedProps = 'counts' | 'errors'

export type ProxyProps = {
  avatarRefreshCounter: Map<string, number>
  followers: Set<string>
  following: Set<string>
  darkMode: boolean
  trackerUsername: string
  username: string
  httpSrvAddress: string
  httpSrvToken: string
} & Details &
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
  avatarRefreshCounterArr: Array<[string, number]>
  counts: Array<[string, number]>
  errors: Array<[string, RPCError | undefined]>
  followersArr: Array<string>
  followingArr: Array<string>
  infoMap: Array<[string, UserInfo]>
  blockMap: Array<[string, BlockState]>
}
export type DeserializeProps = {
  avatarRefreshCounter: Map<string, number>
  darkMode: boolean
  followers: Set<string>
  following: Set<string>
  users: Pick<UsersState, UsersHoistedProps>
  teams: {teamNameToID: Map<string, string>}
  tracker2: {usernameToDetails: Map<string, Details>}
  trackerUsername: string
  waiting: WaitingState
  username: string
  httpSrvAddress: string
  httpSrvToken: string
}

const initialState: DeserializeProps = {
  avatarRefreshCounter: new Map(),
  darkMode: false,
  followers: new Set(),
  following: new Set(),
  httpSrvAddress: '',
  httpSrvToken: '',
  teams: {teamNameToID: new Map()},
  tracker2: {usernameToDetails: new Map()},
  trackerUsername: '',
  username: '',
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
    avatarRefreshCounterArr: [...avatarRefreshCounter.entries()],
    blockMap: blockMap.has(trackerUsername)
      ? [[trackerUsername, blockMap.get(trackerUsername) ?? {chatBlocked: false, followBlocked: false}]]
      : [],
    counts: [...counts.entries()],
    errors: [...errors.entries()],
    followersArr: [...followers],
    followingArr: [...following],
    infoMap: [...infoMap.entries()],
    trackerUsername,
  }
}

export const deserialize = (
  state: DeserializeProps = initialState,
  props?: Partial<SerializeProps>
): DeserializeProps => {
  if (!props) return state

  const {
    assertions,
    avatarRefreshCounterArr,
    bio,
    counts,
    errors,
    followersArr,
    followersCount,
    followingArr,
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
    guiID: (guiID ?? oldDetails?.guiID) || '',
    hidFromFollowers: (hidFromFollowers ?? oldDetails?.hidFromFollowers) || false,
    location: location ?? oldDetails?.location,
    reason: reason ?? oldDetails?.reason ?? '',
    resetBrokeTrack: false,
    state: (trackerState ?? oldDetails?.state) || 'unknown',
    stellarHidden: stellarHidden ?? oldDetails?.stellarHidden,
    teamShowcase: teamShowcase ?? oldDetails?.teamShowcase,
    username: trackerUsername,
  }

  return {
    ...state,
    ...rest,
    avatarRefreshCounter: avatarRefreshCounterArr
      ? new Map(avatarRefreshCounterArr)
      : state.avatarRefreshCounter,
    followers: followersArr ? new Set(followersArr) : state.followers,
    following: followingArr ? new Set(followingArr) : state.following,
    httpSrvAddress: httpSrvAddress ?? state.httpSrvAddress,
    httpSrvToken: httpSrvToken ?? state.httpSrvToken,
    tracker2: {usernameToDetails: new Map([[trackerUsername, details]])},
    trackerUsername,
    username: username ?? state.username,
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
