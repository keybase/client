// import * as Avatar from '../desktop/remote/sync-avatar-props.desktop'
import {State as UsersState, UserInfo} from '../constants/types/users'
import {State as ConfigState} from '../constants/types/config'
import * as ChatTypes from '../constants/types/chat2'
// import * as ChatTypes from '../constants/types/chat2'
import {State as NotificationsState} from '../constants/types/notifications'
import * as FSTypes from '../constants/types/fs'
import {Tab} from '../constants/tabs'
// import {
// serialize as conversationSerialize,
// // hangeAffectsWidget as conversationChangeAffectsWidget,
// } from '../chat/inbox/container/remote'
// import GetRowsFromTlfUpdate from '../fs/remote-container'
import shallowEqual from 'shallowequal'

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

export type Props = {
  conversationsToSend: Array<{
    conversation: ChatTypes.ConversationMeta
    hasBadge: boolean
    hasUnread: boolean
    participantInfo: ChatTypes.ParticipantInfo
  }>
  darkMode: boolean
  diskSpaceStatus: FSTypes.DiskSpaceStatus
  endEstimate: number
  files: number
  fileName: string | null
  kbfsDaemonStatus: Readonly<{
    rpcStatus: FSTypes.KbfsDaemonRpcStatus
    onlineStatus: FSTypes.KbfsDaemonOnlineStatus
  }>
  kbfsEnabled: boolean
  remoteTlfUpdates: Array<RemoteTlfUpdates>
  showingDiskSpaceBanner: boolean
  totalSyncingBytes: number
} & Pick<ConfigState, ConfigHoistedProps> &
  Pick<NotificationsState, 'navBadges'> &
  Pick<UsersState, UsersHoistedProps>

type SerializeProps = Omit<
  Props,
  'avatarRefreshCounter' | 'followers' | 'following' | 'infoMap' | 'navBadges'
> & {
  avatarRefreshCounter: Array<[string, number]>
  followers: Array<string>
  following: Array<string>
  infoMap: Array<[string, UserInfo]>
  navBadges: Array<[Tab, number]>
}

export type DeserializeProps = Omit<Props, ConfigHoistedProps | UsersHoistedProps> & {
  config: Pick<ConfigState, ConfigHoistedProps>
} & {
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
    rpcStatus: FSTypes.KbfsDaemonRpcStatus.Unknown,
  },
  kbfsEnabled: false,
  navBadges: new Map(),
  remoteTlfUpdates: [],
  showingDiskSpaceBanner: false,
  totalSyncingBytes: 0,
  users: {infoMap: new Map()},
}

export const serialize = (p: Props, o: Partial<Props>): SerializeProps => {
  const {avatarRefreshCounter, navBadges, conversationsToSend, followers, following, infoMap, ...toSend} = p
  return {
    ...toSend,
    avatarRefreshCounter: [...avatarRefreshCounter.entries()],
    conversationsToSend: conversationsToSend.filter(c => {
      const matching = o?.conversationsToSend?.find(
        oc => oc.conversation.conversationIDKey === c.conversation.conversationIDKey
      )
      return !shallowEqual(matching, c)
    }),
    followers: [...followers],
    following: [...following],
    infoMap: [...infoMap.entries()],
    navBadges: [...navBadges.entries()],
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
      avatarRefreshCounter: new Map(avatarRefreshCounter),
      daemonHandshakeState,
      followers: new Set(followers),
      following: new Set(following),
      httpSrvAddress,
      httpSrvToken,
      loggedIn,
      outOfDate,
      username,
    },
    navBadges: new Map(navBadges),
    users: {
      infoMap: new Map(infoMap),
    },
  }
}
