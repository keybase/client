import * as FSTypes from '../constants/types/fs'
import type * as ChatTypes from '../constants/types/chat2'
import type {State as ConfigState} from '../constants/types/config'
import type {State as NotificationsState} from '../constants/types/notifications'
import type {State as UsersState, UserInfo} from '../constants/types/users'
import type {Tab} from '../constants/tabs'
import {produce} from 'immer'

const emptySet = new Set<any>()

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
  conversationIDKey: string
  teamType?: ChatTypes.TeamType
  tlfname?: string
  teamname?: string
  timestamp?: number
  channelname?: string
  snippetDecorated?: string
  hasBadge?: true
  hasUnread?: true
  participants?: Array<string>
}

type KbfsDaemonStatus = {
  readonly rpcStatus: FSTypes.KbfsDaemonRpcStatus
  readonly onlineStatus: FSTypes.KbfsDaemonOnlineStatus
}

export type ProxyProps = {
  conversationsToSend: Array<Conversation>
  darkMode?: boolean
  diskSpaceStatus: FSTypes.DiskSpaceStatus
  endEstimate?: number
  files?: number
  fileName?: string
  kbfsDaemonStatus: KbfsDaemonStatus
  kbfsEnabled: boolean
  remoteTlfUpdates: Array<RemoteTlfUpdates>
  showingDiskSpaceBanner?: boolean
  totalSyncingBytes?: number
} & Pick<ConfigState, ConfigHoistedProps> &
  Pick<NotificationsState, 'navBadges'> &
  Pick<UsersState, UsersHoistedProps>

type SerializeProps = Omit<
  ProxyProps,
  'avatarRefreshCounter' | 'followers' | 'following' | 'infoMap' | 'navBadges' | 'windowShownCount'
> & {
  avatarRefreshCounterArr: Array<[string, number]>
  followersArr: Array<string>
  followingArr: Array<string>
  infoMapArr: Array<[string, UserInfo]>
  navBadgesArr: Array<[Tab, number]>
  windowShownCountNum: number
}

// props we don't send at all if they're falsey
type RemovedEmpties = 'darkMode' | 'fileName' | 'files' | 'totalSyncingBytes' | 'showingDiskSpaceBanner'

export type DeserializeProps = Omit<ProxyProps, ConfigHoistedProps | UsersHoistedProps | RemovedEmpties> & {
  darkMode: boolean
  files: number
  fileName: string
  totalSyncingBytes: number
  showingDiskSpaceBanner: boolean
  chat2: {
    badgeMap: Map<string, number>
    draftMap: Map<string, number>
    metaMap: Map<
      string,
      {
        teamname?: string
        timestamp?: number
        channelname?: string
        snippetDecorated?: string
        // its not important to show rekey/reset stuff in the widget
        rekeyers?: Set<string>
        resetParticipants?: Set<string>
        wasFinalizedBy?: string
      }
    >
    participantMap: Map<string, {name: Array<string>}>
    unreadMap: Map<string, number>
    mutedMap: Map<string, number>
  }
  config: Pick<ConfigState, ConfigHoistedProps>
  users: Pick<UsersState, UsersHoistedProps>
}

const initialState: DeserializeProps = {
  chat2: {
    badgeMap: new Map(),
    draftMap: new Map(),
    metaMap: new Map(),
    mutedMap: new Map(),
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
    windowShownCount: new Map([['menu', 0]]),
  },
  conversationsToSend: [],
  darkMode: false,
  diskSpaceStatus: FSTypes.DiskSpaceStatus.Ok,
  endEstimate: 0,
  fileName: '',
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
  const {avatarRefreshCounter, followers, following, infoMap, ...toSend} = p
  return {
    ...toSend,
    avatarRefreshCounterArr: [...avatarRefreshCounter.entries()],
    followersArr: [...followers],
    followingArr: [...following],
    infoMapArr: [...infoMap.entries()],
    navBadgesArr: [...p.navBadges.entries()],
    windowShownCountNum: p.windowShownCount.get('menu') ?? 0,
  }
}

export const deserialize = (
  state: DeserializeProps = initialState,
  props: Partial<SerializeProps>
): DeserializeProps => {
  if (!props) return state
  const {avatarRefreshCounterArr, conversationsToSend, daemonHandshakeState, diskSpaceStatus} = props
  const {fileName, files, followersArr, followingArr, httpSrvAddress, httpSrvToken, infoMapArr} = props
  const {endEstimate, kbfsDaemonStatus, kbfsEnabled, loggedIn, navBadgesArr, darkMode, outOfDate} = props
  const {remoteTlfUpdates, showingDiskSpaceBanner, totalSyncingBytes, username, windowShownCountNum} = props

  return produce(state, s => {
    if (avatarRefreshCounterArr !== undefined) {
      s.config.avatarRefreshCounter = new Map(avatarRefreshCounterArr)
    }
    if (daemonHandshakeState !== undefined) {
      s.config.daemonHandshakeState = daemonHandshakeState
    }
    if (followersArr !== undefined) {
      s.config.followers = new Set(followersArr)
    }
    if (followingArr !== undefined) {
      s.config.following = new Set(followingArr)
    }
    if (httpSrvAddress !== undefined) {
      s.config.httpSrvAddress = httpSrvAddress
    }
    if (httpSrvToken !== undefined) {
      s.config.httpSrvToken = httpSrvToken
    }
    if (loggedIn !== undefined) {
      s.config.loggedIn = loggedIn
    }
    if (outOfDate !== undefined) {
      s.config.outOfDate = outOfDate
    }
    if (username !== undefined) {
      s.config.username = username
    }
    if (windowShownCountNum !== undefined) {
      s.config.windowShownCount.set('menu', windowShownCountNum)
    }
    if (conversationsToSend !== undefined) {
      s.conversationsToSend = conversationsToSend
    }
    if (darkMode !== undefined) {
      s.darkMode = darkMode
    }
    if (diskSpaceStatus !== undefined) {
      s.diskSpaceStatus = diskSpaceStatus
    }
    if (endEstimate !== undefined) {
      s.endEstimate = endEstimate
    }
    if (fileName !== undefined) {
      s.fileName = fileName
    }
    if (files !== undefined) {
      s.files = files
    }
    if (kbfsDaemonStatus !== undefined) {
      s.kbfsDaemonStatus = kbfsDaemonStatus
    }
    if (kbfsEnabled !== undefined) {
      s.kbfsEnabled = kbfsEnabled
    }
    if (navBadgesArr !== undefined) {
      s.navBadges = new Map(navBadgesArr)
    }
    if (remoteTlfUpdates !== undefined) {
      s.remoteTlfUpdates = remoteTlfUpdates
    }
    if (showingDiskSpaceBanner !== undefined) {
      s.showingDiskSpaceBanner = showingDiskSpaceBanner
    }
    if (totalSyncingBytes !== undefined) {
      s.totalSyncingBytes = totalSyncingBytes
    }
    if (infoMapArr !== undefined) {
      s.users.infoMap = new Map(infoMapArr)
    }

    conversationsToSend?.forEach(c => {
      const {participants, conversationIDKey, hasUnread, hasBadge} = c
      const {teamname, timestamp, channelname, snippetDecorated} = c
      s.chat2.badgeMap.set(conversationIDKey, hasBadge ? 1 : 0)
      if (participants) {
        s.chat2.participantMap.set(conversationIDKey, {name: participants ?? []})
      }
      s.chat2.unreadMap.set(conversationIDKey, hasUnread ? 1 : 0)
      const meta = s.chat2.metaMap.get(conversationIDKey) ?? {
        channelname: undefined,
        rekeyers: undefined,
        resetParticipants: undefined,
        snippetDecorated: undefined,
        teamname: undefined,
        timestamp: undefined,
        wasFinalizedBy: undefined,
      }
      meta.teamname = teamname
      meta.timestamp = timestamp
      meta.channelname = channelname
      meta.snippetDecorated = snippetDecorated

      // its not important to show rekey/reset stuff in the widget
      meta.rekeyers = emptySet
      meta.resetParticipants = emptySet
      meta.wasFinalizedBy = ''

      s.chat2.metaMap.set(conversationIDKey, meta)
    })
  })
}
