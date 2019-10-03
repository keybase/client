import * as Avatar from '../desktop/remote/sync-avatar-props.desktop'
import {
  serialize as conversationSerialize,
  changeAffectsWidget as conversationChangeAffectsWidget,
} from '../chat/inbox/container/remote'
import GetRowsFromTlfUpdate from '../fs/remote-container'

export const serialize: any = {
  ...Avatar.serialize,
  badgeKeys: (v: any) => [...v.keys()],
  badgeMap: (v: any, o: any) =>
    [...v.keys()].reduce((map, k) => {
      if (!o || v.get(k) !== o.get(k)) {
        map[k] = v.get(k)
      }
      return map
    }, {}),
  clearCacheTrigger: () => undefined,
  conversationIDs: (v: any) => v.map(v => v.conversation.conversationIDKey),
  conversationMap: (v: any, o: any) =>
    v.reduce((map, toSend) => {
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
    }, {}),
  daemonHandshakeState: (v: any) => v,
  darkMode: (v: any) => v,
  diskSpaceStatus: (v: any) => v,
  endEstimate: (v: any) => v,
  externalRemoteWindow: (v: any) => v,
  fileName: (v: any) => v,
  fileRows: (v: any, o: any) =>
    o && v._tlfUpdates === o._tlfUpdates && v._uploads === o._uploads
      ? null
      : v._tlfUpdates.map(t => GetRowsFromTlfUpdate(t, v._uploads)).toArray(),
  files: (v: any) => v,
  kbfsDaemonStatus: (v: any) => v,
  kbfsEnabled: (v: any) => v,
  loggedIn: (v: any) => v,
  outOfDate: (v: any) => v,
  showingDiskSpaceBanner: (v: any) => v,
  totalSyncingBytes: (v: any) => v,
  // Just send broken over, if its the same send null
  userInfo: (v, o) => {
    const toSend = v.filter(u => u.broken)
    const old = o && o.filter(u => u.broken)
    return toSend.equals(old) ? undefined : toSend
  },
  username: (v: any) => v,
  widgetBadge: (v: any) => v,
  windowComponent: (v: any) => v,
  windowOpts: (v: any) => v,
  windowParam: (v: any) => v,
  windowTitle: (v: any) => v,
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
