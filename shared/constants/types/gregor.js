// @flow
import * as RPCTypesGregor from './flow-types-gregor'
import * as RPCTypes from './flow-types'

export type NonNullGregorItem = {
  md: RPCTypesGregor.Metadata,
  item: RPCTypesGregor.Item,
}

export type MsgMap = {[key: string]: ?NonNullGregorItem}

export type State = {
  reachability: RPCTypes.Reachability,
  seenMsgs: MsgMap,
}
