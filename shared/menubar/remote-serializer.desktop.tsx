import * as Avatar from '../desktop/remote/sync-avatar-props.desktop'
import {
  serialize as conversationSerialize,
  changeAffectsWidget as conversationChangeAffectsWidget,
} from '../chat/inbox/container/remote'
import GetRowsFromTlfUpdate from '../fs/remote-container'

export const serialize: any = {
  ...Avatar.serialize,
  badgeKeys: v => v.keySeq().toArray(),
  badgeMap: (v, o) =>
    v
      .keySeq()
      .toArray()
      .reduce((map, k) => {
        if (!o || v.get(k) !== o.get(k)) {
          map[k] = v.get(k)
        }
        return map
      }, {}),
  clearCacheTrigger: () => undefined,
  conversationIDs: v => v.map(v => v.conversation.conversationIDKey),
  conversationMap: (v, o) =>
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
  daemonHandshakeState: v => v,
  diskSpaceStatus: v => v,
  endEstimate: v => v,
  externalRemoteWindow: v => v,
  fileName: v => v,
  fileRows: (v, o) =>
    o && v._tlfUpdates === o._tlfUpdates && v._uploads === o._uploads
      ? null
      : v._tlfUpdates.map(t => GetRowsFromTlfUpdate(t, v._uploads)).toArray(),
  files: v => v,
  kbfsDaemonStatus: v => v,
  kbfsEnabled: v => v,
  loggedIn: v => v,
  outOfDate: v => v,
  showingDiskSpaceBanner: v => v,
  totalSyncingBytes: v => v,
  // Just send broken over, if its the same send null
  userInfo: (v, o) => {
    const toSend = v.filter(u => u.broken)
    const old = o && o.filter(u => u.broken)
    return toSend.equals(old) ? undefined : toSend
  },
  username: v => v,
  widgetBadge: v => v,
  windowComponent: v => v,
  windowOpts: v => v,
  windowParam: v => v,
  windowTitle: v => v,
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
