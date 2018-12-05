// @flow
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
  clearCacheTrigger: v => undefined,
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
  endEstimate: v => v,
  externalRemoteWindow: v => v,
  fileName: v => v,
  fileRows: (v, o) =>
    o && v._tlfUpdates === o._tlfUpdates && v._uploads === o._uploads
      ? null
      : v._tlfUpdates.map(t => GetRowsFromTlfUpdate(t, v._uploads)).toArray(),
  files: v => v,
  loggedIn: v => v,
  outOfDate: v => v,
  totalSyncingBytes: v => v,
  userInfo: v => v,
  username: v => v,
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

  const newState = {
    ...state,
    ...props,
    badgeInfo,
    badgeMap,
    conversationMap,
    conversations: (props.conversationIDs || state.conversationIDs).map(id => conversationMap[id]),
    fileRows: props.fileRows || state.fileRows,
  }
  return Avatar.deserialize(newState, props)
}
