// @flow strict
import * as RPCTypes from './rpc-gen'
import type {Folder} from './folders'
import type {FriendshipUserInfo} from './profile'
import type {PlatformsExpandedType} from './more'

// Simple state of the overall proof result
export type SimpleProofState = 'normal' | 'warning' | 'error' | 'checking' | 'revoked'
export type SimpleProofMeta = 'upgraded' | 'new' | 'unreachable' | 'pending' | 'deleted' | 'none' | 'ignored'
export type Proof = {
  id: string,
  type: PlatformsExpandedType,
  mTime: RPCTypes.Time,
  meta: ?SimpleProofMeta,
  humanUrl: ?string,
  profileUrl: ?string,
  name: string,
  state: SimpleProofState,
  isTracked: boolean,
}

export type OverviewProofState = {
  allOk: boolean,
  anyWarnings: boolean,
  anyError: boolean,
  anyPending: boolean,
  anyDeletedProofs: boolean,
  anyUnreachableProofs: boolean,
  anyUpgradedProofs: boolean,
  anyNewProofs: boolean,
  anyChanged: boolean,
}

export type APIFriendshipUserInfo = {
  uid: string,
  username: string,
  fullName: string,
  thumbnail: string,
  isFollowee: boolean,
  isFollower: boolean,
}

export type UserInfo = {
  fullname: string,
  followersCount: number,
  followingCount: number,
  followsYou: boolean,
  bio: string,
  uid: string,
  avatar: ?string,
  location: string,
  showcasedTeams: Array<RPCTypes.UserTeamShowcase>,
}

export type TrackerState = {
  type: 'tracker',
  error: ?string,
  eldestKidChanged: boolean,
  currentlyFollowing: boolean,
  lastAction: ?('followed' | 'refollowed' | 'unfollowed' | 'error'),
  serverActive: boolean,
  trackerState: SimpleProofState,
  username: string,
  shouldFollow: ?boolean,
  reason: ?string,
  trackersLoaded: ?boolean,
  trackers: Array<FriendshipUserInfo>,
  tracking: Array<FriendshipUserInfo>,
  waiting: boolean,
  userInfo: UserInfo,
  proofs: Array<Proof>,
  closed: boolean,
  hidden: boolean,
  trackToken: ?string,
  needTrackTokenDismiss: boolean,
  tlfs: Array<Folder>,
  selectedTeam: string,
  stellarFederationAddress: ?string,
}

export type NonUserState = {
  type: 'nonUser',
  error: ?string,
  closed: boolean,
  hidden: boolean,
  name: string,
  reason: string,
  isPrivate: boolean,
  inviteLink: ?string,
}

export type State = {
  cachedIdentifies: {[key: string]: number}, // good until unix timestamp
  pendingIdentifies: {[key: string]: boolean},
  serverStarted: boolean,
  userTrackers: {[key: string]: TrackerState},
  nonUserTrackers: {[key: string]: NonUserState},
}
