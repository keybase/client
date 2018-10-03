// @flow
import * as Avatar from '../desktop/remote/sync-avatar-props.desktop'
import {serialize as conversationSerialize} from '../chat/inbox/container/remote'
import GetRowsFromTlfUpdate from '../fs/remote-container'

export const serialize = {
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
  broken: v => v,
  clearCacheTrigger: v => undefined,
  conversationIDs: v => v.map(v => v.conversationIDKey),
  conversationMap: (v, o) =>
    v.reduce((map, toSend) => {
      if (!o || o.indexOf(toSend) === -1) {
        map[toSend.conversationIDKey] = conversationSerialize(toSend)
      }
      return map
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
  totalSyncingBytes: v => v,
  outOfDate: v => v,
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
