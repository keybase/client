import * as Avatar from '../desktop/remote/sync-avatar-props.desktop'
import * as UsersTypes from '../constants/types/users'
import * as ChatTypes from '../constants/types/chat2'
import * as ConfigTypes from '../constants/types/config'
import * as NotificationTypes from '../constants/types/notifications'
import * as FSTypes from '../constants/types/fs'
import {Tab} from '../constants/tabs'
import {
  serialize as conversationSerialize,
  changeAffectsWidget as conversationChangeAffectsWidget,
} from '../chat/inbox/container/remote'
import GetRowsFromTlfUpdate from '../fs/remote-container'
import shallowEqual from 'shallowequal'

type ConvMap = Array<{hasBadge: boolean; hasUnread: boolean; conversation: ChatTypes.ConversationMeta}>
type FileRows = {_tlfUpdates: FSTypes.UserTlfUpdates; _uploads: FSTypes.Uploads}

export const serialize: any = {
  ...Avatar.serialize,
  badgeKeys: (v: Map<Tab, number>) => [...v.keys()],
  badgeMap: (v: Map<Tab, number>, o: Map<Tab, number>) =>
    [...v.keys()].reduce((map, k) => {
      if (!o || v.get(k) !== o.get(k)) {
        map[k] = v.get(k)
      }
      return map
    }, {}),
  clearCacheTrigger: () => undefined,
  conversationIDs: (v: ConvMap, o?: ConvMap) => {
    const newKeys = v.map(v => v.conversation.conversationIDKey)
    const oldKeys = (o ?? []).map(v => v.conversation.conversationIDKey)
    return shallowEqual(newKeys, oldKeys) ? undefined : newKeys
  },
  conversationMap: (v: ConvMap, o: ConvMap) => {
    const obj = v.reduce((map, toSend) => {
      const oldConv =
        o &&
        o.find(oldElem => oldElem.conversation.conversationIDKey === toSend.conversation.conversationIDKey)
      return oldConv &&
        oldConv.hasBadge === toSend.hasBadge &&
        oldConv.hasUnread === toSend.hasUnread &&
        !conversationChangeAffectsWidget(oldConv.conversation, toSend.conversation)
        ? map
        : {
            ...map,
            [toSend.conversation.conversationIDKey]: conversationSerialize(toSend),
          }
    }, {})
    if (Object.keys(obj).length) {
      return obj
    }
    return undefined
  },
  daemonHandshakeState: (v: ConfigTypes.DaemonHandshakeState) => v,
  darkMode: (v: boolean) => v,
  diskSpaceStatus: (v: FSTypes.DiskSpaceStatus) => v,
  endEstimate: (v: number) => v,
  externalRemoteWindow: (v: Electron.BrowserWindow | null) => v,
  fileName: (v: FSTypes.Path) => v,
  fileRows: (v: FileRows, o: FileRows) =>
    o && v._tlfUpdates === o._tlfUpdates && v._uploads === o._uploads
      ? undefined
      : v._tlfUpdates.map(t => GetRowsFromTlfUpdate(t, v._uploads)),
  files: (v: number) => v,
  kbfsDaemonStatus: (v: FSTypes.KbfsDaemonStatus) => v,
  kbfsEnabled: (v: boolean) => v,
  loggedIn: (v: boolean) => v,
  outOfDate: (v: boolean) => v,
  showingDiskSpaceBanner: (v: boolean) => v,
  totalSyncingBytes: (v: number) => v,
  // Just send broken over, if its the same send null
  userInfo: (v: Map<string, UsersTypes.UserInfo>, o: Map<string, UsersTypes.UserInfo>) => {
    const toSend = [...v.entries()].filter(e => e[1].broken)
    const old = o && [...o.entries()].filter(e => e[1].broken)
    return shallowEqual(toSend, old) ? undefined : toSend
  },
  username: (v: string) => v,
  usernames: (v: Array<string>) => v,
  widgetBadge: (v: NotificationTypes.BadgeType) => v,
  windowComponent: (v: string) => v,
  windowOpts: (v: Object) => v,
  windowParam: (v: string) => v,
  windowTitle: (v: string) => v,
}

const initialState = {
  badgeInfo: {},
  badgeKeys: [],
  badgeMap: {},
  config: {},
  conversationIDs: [],
  conversationMap: {},
  fileRows: [],
}
export const deserialize = (state: any = initialState, props: any) => {
  if (!props) return state
  // We always add to the map
  const badgeMap = {
    ...state.badgeMap,
    ...(props.badgeMap || {}),
  }

  const badgeInfo = (props.badgeKeys || state.badgeKeys).reduce((map, k) => {
    map[k] = badgeMap[k]
    return map
  }, {})

  const conversationMap = {
    ...state.conversationMap,
    ...props.conversationMap,
  }

  // if we send null keep the old value
  const userInfo = props.userInfo || state.userInfo

  const newState = {
    ...state,
    ...props,
    badgeInfo,
    badgeMap,
    conversationMap,
    conversations: (props.conversationIDs || state.conversationIDs).map(id => conversationMap[id]),
    fileRows: props.fileRows || state.fileRows,
    userInfo,
  }

  return Avatar.deserialize(newState, props)
}
