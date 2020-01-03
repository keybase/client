import * as Avatar from '../desktop/remote/sync-avatar-props.desktop'
import * as UsersTypes from '../constants/types/users'
// import * as ChatTypes from '../constants/types/chat2'
// import * as ConfigTypes from '../constants/types/config'
// import * as NotificationTypes from '../constants/types/notifications'
import * as FSTypes from '../constants/types/fs'
import {Tab} from '../constants/tabs'
// import {
// serialize as conversationSerialize,
// // hangeAffectsWidget as conversationChangeAffectsWidget,
// } from '../chat/inbox/container/remote'
// import GetRowsFromTlfUpdate from '../fs/remote-container'
import shallowEqual from 'shallowequal'
import {Props} from './remote-proxy.desktop'

// type ConvMap = Array<{
// hasBadge: boolean
// hasUnread: boolean
// conversation: ChatTypes.ConversationMeta
// participantInfo: ChatTypes.ParticipantInfo
// }>

const initialState: Props = {
  badgeInfo: new Map(),
  config: {
    avatarRefreshCounter: new Map(),
    followers: new Set(),
    following: new Set(),
    httpSrvAddress: '',
    httpSrvToken: '',
  },
  conversationsToSend: [],
  daemonHandshakeState: 'starting',
  darkMode: false,
  diskSpaceStatus: FSTypes.DiskSpaceStatus.Ok,
  endEstimate: 0,
  fileName: null,
  kbfsDaemonStatus: {
    onlineStatus: FSTypes.KbfsDaemonOnlineStatus.Unknown,
    rpcStatus: FSTypes.KbfsDaemonRpcStatus.Unknown,
  },
  kbfsEnabled: false,
  loggedIn: false,
  outOfDate: undefined,
  remoteTlfUpdates: [],
  showingDiskSpaceBanner: false,
  username: '',
  usernames: [],
  users: {infoMap: new Map<string, UsersTypes.UserInfo>()},
}

type SerializeProps = Omit<Props, 'badgeInfo' | 'users'> & {
  badgeInfo: Array<[Tab, number]>
  userInfo: Array<[string, UsersTypes.UserInfo]>
}

export const serialize = (p: Props, o: Partial<Props>): SerializeProps => {
  return {
    ...p,
    // ...Avatar.serialize,
    badgeInfo: [...p.badgeInfo.entries()],
    conversationsToSend: p.conversationsToSend.filter(c => {
      const matching = o?.conversationsToSend?.find(
        oc => oc.conversation.conversationIDKey === c.conversation.conversationIDKey
      )
      return !shallowEqual(matching, c)
    }),
    userInfo: [...p.users.infoMap.entries()].filter(([u]) => p.usernames.includes(u)),
  }
}

export const deserialize = (state: Props = initialState, props: SerializeProps): Props => {
  if (!props) return state

  const badgeInfo = new Map(props.badgeInfo)
  const infoMap = new Map(props.userInfo)

  const newState = {
    ...state,
    ...props,
    badgeInfo,
    users: {infoMap},
  }

  return Avatar.deserialize(newState, props)
}
