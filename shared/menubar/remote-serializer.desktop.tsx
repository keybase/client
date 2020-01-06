import * as Avatar from '../desktop/remote/sync-avatar-props.desktop'
import {State as UsersState} from '../constants/types/users'
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
  fileName: string | null
  kbfsDaemonStatus: Readonly<{
    rpcStatus: FSTypes.KbfsDaemonRpcStatus
    onlineStatus: FSTypes.KbfsDaemonOnlineStatus
  }>
  kbfsEnabled: boolean
  remoteTlfUpdates: Array<RemoteTlfUpdates>
  showingDiskSpaceBanner: boolean
} & Pick<
  ConfigState,
  | 'avatarRefreshCounter'
  | 'daemonHandshakeState'
  | 'outOfDate'
  | 'followers'
  | 'following'
  | 'httpSrvAddress'
  | 'httpSrvToken'
  | 'loggedIn'
  | 'username'
> &
  Pick<NotificationsState, 'navBadges'> &
  Pick<UsersState, 'infoMap'>

type SerializeProps = Omit<
  Props,
  'avatarRefreshCounter' | 'users' | 'followers' | 'following' | 'infoMap' | 'navBadges'
> & {
  navBadges: Array<[Tab, number]>
} & Avatar.SerializeProps

export type DeserializeProps = Omit<
  Props,
  | 'avatarRefreshCounter'
  | 'daemonHandshakeState'
  | 'followers'
  | 'following'
  | 'httpSrvAddress'
  | 'httpSrvToken'
  | 'loggedIn'
  | 'username'
  | 'infoMap'
> &
  Avatar.DeserializeProps & {
    config: Pick<ConfigState, 'daemonHandshakeState' | 'outOfDate' | 'loggedIn' | 'username'>
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
    username: '',
  },
  conversationsToSend: [],
  darkMode: false,
  diskSpaceStatus: FSTypes.DiskSpaceStatus.Ok,
  endEstimate: 0,
  fileName: null,
  kbfsDaemonStatus: {
    onlineStatus: FSTypes.KbfsDaemonOnlineStatus.Unknown,
    rpcStatus: FSTypes.KbfsDaemonRpcStatus.Unknown,
  },
  kbfsEnabled: false,
  navBadges: new Map(),
  outOfDate: undefined,
  remoteTlfUpdates: [],
  showingDiskSpaceBanner: false,
  users: {infoMap: new Map()},
}

export const serialize = (p: Props, o: Partial<Props>): SerializeProps => {
  // TODO
  const usernames = new Set<string>()
  const {avatarRefreshCounter, navBadges, conversationsToSend, followers, following, infoMap, ...toSend} = p
  return {
    ...toSend,
    ...Avatar.serialize(p, o, usernames),
    conversationsToSend: conversationsToSend.filter(c => {
      const matching = o?.conversationsToSend?.find(
        oc => oc.conversation.conversationIDKey === c.conversation.conversationIDKey
      )
      return !shallowEqual(matching, c)
    }),
    navBadges: [...navBadges.entries()],
  }
}

export const deserialize = (
  state: DeserializeProps = initialState,
  props: SerializeProps
): DeserializeProps => {
  if (!props) return state

  // const infoMap = new Map(props.userInfo)

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

  const fromAvatar = Avatar.deserialize(state, props)

  return {
    ...state,
    ...rest,
    config: {
      ...state.config,
      daemonHandshakeState,
      loggedIn,
      outOfDate,
      username,
      ...fromAvatar.config,
    },
    navBadges: new Map(navBadges),
    users: {
      ...state.users,
      ...fromAvatar.users,
    },
  }
}
