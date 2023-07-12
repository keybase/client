import * as FSTypes from '../constants/types/fs'
import type * as Tabs from '../constants/tabs'
import type * as ChatTypes from '../constants/types/chat2'
import type {DaemonHandshakeState, OutOfDate} from '../constants/types/config'
import type {UserInfo} from '../constants/types/users'
import type {Tab} from '../constants/tabs'
import {produce} from 'immer'

const emptySet = new Set<any>()

export type RemoteTlfUpdates = {
  timestamp: number
  tlf: FSTypes.Path
  updates: Array<{path: FSTypes.Path; uploading: boolean}>
  writer: string
}

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
  daemonHandshakeState: DaemonHandshakeState
  avatarRefreshCounter: Map<string, number>
  conversationsToSend: Array<Conversation>
  darkMode?: boolean
  diskSpaceStatus: FSTypes.DiskSpaceStatus
  endEstimate?: number
  files?: number
  fileName?: string
  followers: Set<string>
  following: Set<string>
  kbfsDaemonStatus: KbfsDaemonStatus
  kbfsEnabled: boolean
  loggedIn: boolean
  remoteTlfUpdates: Array<RemoteTlfUpdates>
  showingDiskSpaceBanner?: boolean
  outOfDate: OutOfDate
  totalSyncingBytes?: number
  username: string
  httpSrvAddress: string
  httpSrvToken: string
  windowShownCountNum: number
  navBadges: Map<Tabs.Tab, number>
  infoMap: Map<string, UserInfo>
}

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

export type DeserializeProps = Omit<ProxyProps, RemovedEmpties> & {
  avatarRefreshCounter: Map<string, number>
  darkMode: boolean
  daemonHandshakeState: DaemonHandshakeState
  files: number
  fileName: string
  followers: Set<string>
  following: Set<string>
  totalSyncingBytes: number
  showingDiskSpaceBanner: boolean
  httpSrvAddress: string
  httpSrvToken: string
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
  loggedIn: boolean
  outOfDate: OutOfDate
  infoMap: Map<string, UserInfo>
  username: string
  windowShownCountNum: number
}

const initialState: DeserializeProps = {
  avatarRefreshCounter: new Map(),
  chat2: {
    badgeMap: new Map(),
    draftMap: new Map(),
    metaMap: new Map(),
    mutedMap: new Map(),
    participantMap: new Map(),
    unreadMap: new Map(),
  },
  conversationsToSend: [],
  daemonHandshakeState: 'starting',
  darkMode: false,
  diskSpaceStatus: FSTypes.DiskSpaceStatus.Ok,
  endEstimate: 0,
  fileName: '',
  files: 0,
  followers: new Set(),
  following: new Set(),
  httpSrvAddress: '',
  httpSrvToken: '',
  infoMap: new Map(),
  kbfsDaemonStatus: {
    onlineStatus: FSTypes.KbfsDaemonOnlineStatus.Unknown,
    rpcStatus: FSTypes.KbfsDaemonRpcStatus.Connected,
  },
  kbfsEnabled: false,
  loggedIn: false,
  navBadges: new Map(),
  outOfDate: {
    critical: false,
    message: '',
    outOfDate: false,
    updating: false,
  },
  remoteTlfUpdates: [],
  showingDiskSpaceBanner: false,
  totalSyncingBytes: 0,
  username: '',
  windowShownCountNum: 0,
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
  }
}

export const deserialize = (
  state: DeserializeProps = initialState,
  props?: Partial<SerializeProps>
): DeserializeProps => {
  if (!props) return state
  const {avatarRefreshCounterArr, conversationsToSend, daemonHandshakeState, diskSpaceStatus} = props
  const {fileName, files, followersArr, followingArr, httpSrvAddress, httpSrvToken, infoMapArr} = props
  const {endEstimate, kbfsDaemonStatus, kbfsEnabled, loggedIn, navBadgesArr, darkMode, outOfDate} = props
  const {remoteTlfUpdates, showingDiskSpaceBanner, totalSyncingBytes, username, windowShownCountNum} = props

  return produce(state, s => {
    if (avatarRefreshCounterArr !== undefined) {
      s.avatarRefreshCounter = new Map(avatarRefreshCounterArr)
    }
    if (daemonHandshakeState !== undefined) {
      s.daemonHandshakeState = daemonHandshakeState
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
    if (loggedIn !== undefined) {
      s.loggedIn = loggedIn
    }
    if (outOfDate !== undefined) {
      s.outOfDate = outOfDate
    }
    if (username !== undefined) {
      s.username = username
    }
    if (windowShownCountNum !== undefined) {
      s.windowShownCountNum = windowShownCountNum
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
      s.infoMap = new Map(infoMapArr)
    }

    conversationsToSend?.forEach(c => {
      const {participants, conversationIDKey, hasUnread, hasBadge} = c
      const {teamname, timestamp, channelname, snippetDecorated} = c
      s.chat2.badgeMap.set(conversationIDKey, hasBadge ? 1 : 0)
      if (participants) {
        s.chat2.participantMap.set(conversationIDKey, {name: participants})
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
