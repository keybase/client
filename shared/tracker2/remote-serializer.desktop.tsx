import * as T from '@/constants/types'
import type {RPCError} from '@/util/errors'
import {produce} from 'immer'

// for convenience we flatten the props we send over the wire
type WaitingHoistedProps = 'counts' | 'errors'

export type ProxyProps = {
  avatarRefreshCounter: ReadonlyMap<string, number>
  followers: ReadonlySet<string>
  following: ReadonlySet<string>
  darkMode: boolean
  trackerUsername: string
  username: string
  httpSrvAddress: string
  httpSrvToken: string
  infoMap: ReadonlyMap<string, T.Users.UserInfo>
  blockMap: ReadonlyMap<string, T.Users.BlockState>
} & T.Tracker.Details &
  Pick<T.Waiting.State, WaitingHoistedProps>

export type SerializeProps = Omit<
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
  assertionsArr: Array<[string, T.Tracker.Assertion]>
  avatarRefreshCounterArr: Array<[string, number]>
  countsArr: Array<[string, number]>
  errorsArr: Array<[string, RPCError | undefined]>
  followersArr: Array<string>
  followingArr: Array<string>
  infoMapArr: Array<[string, T.Users.UserInfo]>
  blockMapArr: Array<[string, T.Users.BlockState]>

  avatarRefreshCounter?: never
  assertions?: never
  blockMap?: never
  infoMap?: never
  following?: never
  followers?: never
  counts?: never
  errors?: never
}
export type DeserializeProps = {
  avatarRefreshCounter: Map<string, number>
  darkMode: boolean
  followers: Set<string>
  following: Set<string>
  infoMap: Map<string, T.Users.UserInfo>
  blockMap: Map<string, T.Users.BlockState>
  teams: {teamNameToID: Map<string, string>}
  tracker2: {usernameToDetails: Map<string, T.Tracker.Details>}
  trackerUsername: string
  waiting: T.Waiting.State
  username: string
  httpSrvAddress: string
  httpSrvToken: string
}

const initialState: DeserializeProps = {
  avatarRefreshCounter: new Map(),
  blockMap: new Map(),
  darkMode: false,
  followers: new Set(),
  following: new Set(),
  httpSrvAddress: '',
  httpSrvToken: '',
  infoMap: new Map(),
  teams: {teamNameToID: new Map()},
  tracker2: {usernameToDetails: new Map()},
  trackerUsername: '',
  username: '',
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
    assertionsArr: [...(assertions?.entries() ?? [])],
    avatarRefreshCounterArr: [...avatarRefreshCounter.entries()],
    blockMapArr: blockMap.has(trackerUsername)
      ? [[trackerUsername, blockMap.get(trackerUsername) ?? {chatBlocked: false, followBlocked: false}]]
      : [],
    countsArr: [...counts.entries()],
    errorsArr: [...errors.entries()],
    followersArr: [...followers],
    followingArr: [...following],
    infoMapArr: [...infoMap.entries()],
    trackerUsername,
  }
}

export const deserialize = (
  state: DeserializeProps = initialState,
  props?: Partial<SerializeProps>
): DeserializeProps => {
  if (!props) return state

  const {bio, darkMode, followingCount, followersCount, fullname} = props
  const {guiID, hidFromFollowers, httpSrvAddress, httpSrvToken, location} = props
  const {reason, stellarHidden, teamShowcase} = props
  const {trackerUsername: _trackerUsername, username} = props
  const {assertionsArr, avatarRefreshCounterArr, countsArr, errorsArr} = props
  const {followersArr, followingArr, infoMapArr, blockMapArr, state: trackerState} = props
  const trackerUsername = _trackerUsername ?? state.trackerUsername

  return produce(state, s => {
    s.trackerUsername = trackerUsername
    s.darkMode = darkMode ?? s.darkMode
    if (avatarRefreshCounterArr !== undefined) {
      s.avatarRefreshCounter = new Map(avatarRefreshCounterArr)
    }
    if (blockMapArr !== undefined) {
      s.blockMap = new Map(blockMapArr)
    }
    if (followersArr !== undefined) {
      s.followers = new Set(followersArr)
    }
    if (followingArr !== undefined) {
      s.following = new Set(followingArr)
    }
    if (httpSrvAddress !== undefined) {
      s.httpSrvAddress = httpSrvAddress
    }
    if (httpSrvToken !== undefined) {
      s.httpSrvToken = httpSrvToken
    }
    if (infoMapArr !== undefined) {
      s.infoMap = new Map(infoMapArr)
    }
    if (username !== undefined) {
      s.username = username
    }
    if (countsArr !== undefined) {
      s.waiting.counts = new Map(countsArr)
    }
    if (errorsArr !== undefined) {
      s.waiting.errors = new Map(errorsArr)
    }
    if (blockMapArr !== undefined) {
      s.blockMap = new Map(blockMapArr)
    }

    const details = T.castDraft(
      s.tracker2.usernameToDetails.get(trackerUsername) ?? ({} as T.Tracker.Details)
    )
    details.username = trackerUsername
    details.resetBrokeTrack = false
    details.blocked = s.blockMap.get(trackerUsername)?.chatBlocked ?? details.blocked
    if (assertionsArr) {
      details.assertions = T.castDraft(new Map(assertionsArr))
    }
    if (bio) {
      details.bio = bio
    }
    if (followersCount) {
      details.followersCount = followersCount
    }
    if (followingCount) {
      details.followingCount = followingCount
    }
    if (fullname) {
      details.fullname = fullname
    }
    if (guiID) {
      details.guiID = guiID
    }
    if (hidFromFollowers) {
      details.hidFromFollowers = hidFromFollowers
    }
    if (location) {
      details.location = location
    }
    if (reason) {
      details.reason = reason
    }
    if (trackerState) {
      details.state = trackerState
    }
    if (stellarHidden) {
      details.stellarHidden = stellarHidden
    }
    if (teamShowcase) {
      details.teamShowcase = T.castDraft(teamShowcase)
    }
    s.tracker2.usernameToDetails.set(trackerUsername, T.castDraft(details))
  })
}
