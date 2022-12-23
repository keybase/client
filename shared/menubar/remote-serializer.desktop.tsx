import * as FSTypes from '../constants/types/fs'
import type * as ChatTypes from '../constants/types/chat2'
import type {State as ConfigState} from '../constants/types/config'
import type {State as NotificationsState} from '../constants/types/notifications'
import type {State as UsersState, UserInfo} from '../constants/types/users'
import type {Tab} from '../constants/tabs'

const emptySet = new Set()
const emptyMap = new Map()

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
  | 'windowShownCount'

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
  | 'avatarRefreshCounter'
  | 'followers'
  | 'following'
  | 'infoMap'
  | 'navBadges'
  | 'conversationsToSend'
  | 'windowShownCount'
> & {
  avatarRefreshCounter: Array<[string, number]>
  conversationsToSend: Array<Conversation>
  followers: Array<string>
  following: Array<string>
  infoMap: Array<[string, UserInfo]>
  navBadges: Array<[Tab, number]>
  windowShownCount: number
}

export type DeserializeProps = Omit<ProxyProps, ConfigHoistedProps | UsersHoistedProps> & {
  chat2: {
    badgeMap: Map<string, number>
    draftMap: Map<string, number>
    metaMap: Map<string, any>
    participantMap: Map<string, any>
    unreadMap: Map<string, number>
  }
  config: Pick<ConfigState, ConfigHoistedProps>
  users: Pick<UsersState, UsersHoistedProps>
}

const initialState: DeserializeProps = {
  chat2: {
    badgeMap: new Map(),
    draftMap: emptyMap,
    metaMap: new Map(),
    participantMap: new Map(),
    unreadMap: new Map(),
  },
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
    windowShownCount: new Map(),
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
  // TODO don't send whole conversations
  const {avatarRefreshCounter, conversationsToSend, followers, following, infoMap, ...toSend} = p
  return {
    ...toSend,
    avatarRefreshCounter: [...avatarRefreshCounter.entries()],
    conversationsToSend,
    followers: [...followers],
    following: [...following],
    infoMap: [...infoMap.entries()],
    navBadges: [...p.navBadges.entries()],
    windowShownCount: p.windowShownCount.get('menu') ?? 0,
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
    windowShownCount,
    ...rest
  } = props

  const badgeMap = state.chat2.badgeMap ?? new Map<string, number>()
  const unreadMap = state.chat2.unreadMap ?? new Map<string, number>()
  const metaMap = state.chat2.metaMap ?? new Map<string, any>()
  const participantMap = state.chat2.participantMap ?? new Map<string, any>()
  const draftMap = emptyMap
  rest.conversationsToSend?.forEach(c => {
    const {participantInfo, conversation, hasUnread} = c
    const {conversationIDKey} = conversation
    badgeMap.set(conversationIDKey, c.hasBadge ? 1 : 0)
    participantMap.set(conversationIDKey, participantInfo)
    unreadMap.set(conversationIDKey, hasUnread ? 1 : 0)
    const meta = metaMap.get(conversationIDKey) ?? {}
    meta.teamname = conversation.teamname
    meta.timestamp = conversation.timestamp
    meta.channelname = conversation.channelname
    meta.snippetDecorated = conversation.snippetDecorated

    // its not important to show rekey/reset stuff in the widget
    meta.rekeyers = emptySet
    meta.resetParticipants = emptySet

    metaMap.set(conversationIDKey, meta)
  })

  return {
    ...state,
    ...rest,
    chat2: {
      badgeMap,
      draftMap,
      metaMap,
      participantMap,
      unreadMap,
    },
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
      windowShownCount: new Map<string, number>([['menu', windowShownCount]]),
    },
    navBadges: navBadges ? new Map(navBadges) : state.navBadges,
    users: {infoMap: infoMap ? new Map(infoMap) : state.users.infoMap},
  }
}
