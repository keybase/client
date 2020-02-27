import * as ChatTypes from '../constants/types/chat2'
import * as FSTypes from '../constants/types/fs'
import {State as ConfigState} from '../constants/types/config'
import {State as NotificationsState} from '../constants/types/notifications'
import {State as UsersState, UserInfo} from '../constants/types/users'
import {Tab} from '../constants/tabs'

export type RemoteTlfUpdates = {
  timestamp: number
  tlf: FSTypes.Path
  updates: Array<{path: FSTypes.Path; uploading: boolean}>
  writer: string
}

// for convenience we flatten the props we send over the wire
type ConfigHoistedProps =
  | 'avatarRefreshCounter'
  | 'daemonHandshakeState'
  | 'outOfDate'
  | 'followers'
  | 'following'
  | 'httpSrvAddress'
  | 'httpSrvToken'
  | 'loggedIn'
  | 'username'

type UsersHoistedProps = 'infoMap'

type Conversation = {
  conversation: ChatTypes.ConversationMeta
  hasBadge: boolean
  hasUnread: boolean
  participantInfo: ChatTypes.ParticipantInfo
}

type KbfsDaemonStatus = {
  readonly rpcStatus: FSTypes.KbfsDaemonRpcStatus
  readonly onlineStatus: FSTypes.KbfsDaemonOnlineStatus
}

export type ProxyProps = {
  conversationsToSend: Array<Conversation>
  darkMode: boolean
  diskSpaceStatus: FSTypes.DiskSpaceStatus
  endEstimate: number
  files: number
  fileName: string | null
  kbfsDaemonStatus: KbfsDaemonStatus
  kbfsEnabled: boolean
  remoteTlfUpdates: Array<RemoteTlfUpdates>
  showingDiskSpaceBanner: boolean
  totalSyncingBytes: number
} & Pick<ConfigState, ConfigHoistedProps> &
  Pick<NotificationsState, 'navBadges'> &
  Pick<UsersState, UsersHoistedProps>

type SerializeProps = Omit<
  ProxyProps,
  'avatarRefreshCounter' | 'followers' | 'following' | 'infoMap' | 'navBadges' | 'conversationsToSend'
> & {
  avatarRefreshCounter: Array<[string, number]>
  conversationsToSend: Array<Conversation>
  followers: Array<string>
  following: Array<string>
  infoMap: Array<[string, UserInfo]>
  navBadges: Array<[Tab, number]>
}

export type DeserializeProps = Omit<ProxyProps, ConfigHoistedProps | UsersHoistedProps> & {
  config: Pick<ConfigState, ConfigHoistedProps>
  users: Pick<UsersState, UsersHoistedProps>
}

const initialState: DeserializeProps = {
  config: {
    avatarRefreshCounter: new Map(),
    daemonHandshakeState: 'starting',
    followers: new Set(),
    following: new Set(),
    httpSrvAddress: '',
    httpSrvToken: '',
    loggedIn: false,
    outOfDate: undefined,
    username: '',
  },
  conversationsToSend: [],
  darkMode: false,
  diskSpaceStatus: FSTypes.DiskSpaceStatus.Ok,
  endEstimate: 0,
  fileName: null,
  files: 0,
  kbfsDaemonStatus: {
    onlineStatus: FSTypes.KbfsDaemonOnlineStatus.Unknown,
    rpcStatus: FSTypes.KbfsDaemonRpcStatus.Connected,
  },
  kbfsEnabled: false,
  navBadges: new Map(),
  remoteTlfUpdates: [],
  showingDiskSpaceBanner: false,
  totalSyncingBytes: 0,
  users: {infoMap: new Map()},
}

export const serialize = (p: ProxyProps): Partial<SerializeProps> => {
  const {avatarRefreshCounter, conversationsToSend, followers, following, infoMap, ...toSend} = p
  return {
    ...toSend,
    avatarRefreshCounter: [...avatarRefreshCounter.entries()],
    conversationsToSend,
    followers: [...followers],
    following: [...following],
    infoMap: [...infoMap.entries()],
    navBadges: [...p.navBadges.entries()],
  }
}

export const deserialize = (
  state: DeserializeProps = initialState,
  props: SerializeProps
): DeserializeProps => {
  if (!props) return state

  const {
    avatarRefreshCounter,
    daemonHandshakeState,
    followers,
    following,
    httpSrvAddress,
    httpSrvToken,
    infoMap,
    loggedIn,
    navBadges,
    outOfDate,
    username,
    ...rest
  } = props

  return {
    ...state,
    ...rest,
    config: {
      ...state.config,
      avatarRefreshCounter: avatarRefreshCounter
        ? new Map(avatarRefreshCounter)
        : state.config.avatarRefreshCounter,
      daemonHandshakeState: daemonHandshakeState ?? state.config.daemonHandshakeState,
      followers: followers ? new Set(followers) : state.config.followers,
      following: following ? new Set(following) : state.config.following,
      httpSrvAddress: httpSrvAddress ?? state.config.httpSrvAddress,
      httpSrvToken: httpSrvToken ?? state.config.httpSrvToken,
      loggedIn: loggedIn ?? state.config.loggedIn,
      outOfDate: outOfDate ?? state.config.outOfDate,
      username: username ?? state.config.username,
    },
    navBadges: navBadges ? new Map(navBadges) : state.navBadges,
    users: {infoMap: infoMap ? new Map(infoMap) : state.users.infoMap},
  }
}
