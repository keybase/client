import type * as Tabs from '../constants/tabs'
import * as T from '../constants/types'
import type {Tab} from '../constants/tabs'
import {produce} from 'immer'

const emptySet = new Set<any>()

export type RemoteTlfUpdates = {
  timestamp: number
  tlf: T.FS.Path
  updates: Array<{path: T.FS.Path; uploading: boolean}>
  writer: string
}

type Conversation = {
  conversationIDKey: string
  teamType?: T.Chat.TeamType
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
  readonly rpcStatus: T.FS.KbfsDaemonRpcStatus
  readonly onlineStatus: T.FS.KbfsDaemonOnlineStatus
}

export type ProxyProps = {
  daemonHandshakeState: T.Config.DaemonHandshakeState
  avatarRefreshCounter: Map<string, number>
  conversationsToSend: Array<Conversation>
  darkMode?: boolean
  diskSpaceStatus: T.FS.DiskSpaceStatus
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
  outOfDate: T.Config.OutOfDate
  totalSyncingBytes?: number
  username: string
  httpSrvAddress: string
  httpSrvToken: string
  windowShownCountNum: number
  navBadges: Map<Tabs.Tab, number>
  infoMap: Map<string, T.Users.UserInfo>
}

type SerializeProps = Omit<
  ProxyProps,
  'avatarRefreshCounter' | 'followers' | 'following' | 'infoMap' | 'navBadges' | 'windowShownCount'
> & {
  avatarRefreshCounterArr: Array<[string, number]>
  followersArr: Array<string>
  followingArr: Array<string>
  infoMapArr: Array<[string, T.Users.UserInfo]>
  navBadgesArr: Array<[Tab, number]>
  windowShownCountNum: number
}

// props we don't send at all if they're falsey
type RemovedEmpties = 'darkMode' | 'fileName' | 'files' | 'totalSyncingBytes' | 'showingDiskSpaceBanner'

export type DeserializeProps = Omit<ProxyProps, RemovedEmpties> & {
  avatarRefreshCounter: Map<string, number>
  darkMode: boolean
  daemonHandshakeState: T.Config.DaemonHandshakeState
  files: number
  fileName: string
  followers: Set<string>
  following: Set<string>
  totalSyncingBytes: number
  showingDiskSpaceBanner: boolean
  httpSrvAddress: string
  httpSrvToken: string
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
  badgeMap: Map<string, number>
  unreadMap: Map<string, number>
  loggedIn: boolean
  outOfDate: T.Config.OutOfDate
  infoMap: Map<string, T.Users.UserInfo>
  username: string
  windowShownCountNum: number
}

const initialState: DeserializeProps = {
  avatarRefreshCounter: new Map(),
  badgeMap: new Map(),
  conversationsToSend: [],
  daemonHandshakeState: 'starting',
  darkMode: false,
  diskSpaceStatus: T.FS.DiskSpaceStatus.Ok,
  endEstimate: 0,
  fileName: '',
  files: 0,
  followers: new Set(),
  following: new Set(),
  httpSrvAddress: '',
  httpSrvToken: '',
  infoMap: new Map(),
  kbfsDaemonStatus: {
    onlineStatus: T.FS.KbfsDaemonOnlineStatus.Unknown,
    rpcStatus: T.FS.KbfsDaemonRpcStatus.Connected,
  },
  kbfsEnabled: false,
  loggedIn: false,
  metaMap: new Map(),
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
  unreadMap: new Map(),
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
      const {conversationIDKey, hasUnread, hasBadge} = c
      const {teamname, timestamp, channelname, snippetDecorated} = c
      s.badgeMap.set(conversationIDKey, hasBadge ? 1 : 0)
      s.unreadMap.set(conversationIDKey, hasUnread ? 1 : 0)
      const meta = s.metaMap.get(conversationIDKey) ?? {
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

      s.metaMap.set(conversationIDKey, meta)
    })
  })
}
