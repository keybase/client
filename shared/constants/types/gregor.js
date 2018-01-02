// @flow
import * as RPCTypesGregor from './rpc-gregor-gen'
import * as RPCTypes from './rpc-gen'

export type NonNullGregorItem = {
  md: RPCTypesGregor.Metadata,
  item: RPCTypesGregor.Item,
}

export type MsgMap = {[key: string]: ?NonNullGregorItem}

export type State = {
  reachability: RPCTypes.Reachability,
  seenMsgs: MsgMap,
}
