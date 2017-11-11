// @flow
import * as RPCTypesGregor from '../constants/types/flow-types-gregor'
import * as RPCTypes from '../constants/types/flow-types'

export type NonNullGregorItem = {
  md: RPCTypesGregor.Metadata,
  item: RPCTypesGregor.Item,
}

export type MsgMap = {[key: string]: ?NonNullGregorItem}

export type State = {
  reachability: RPCTypes.Reachability,
  seenMsgs: MsgMap,
}

const initialState: State = {
  reachability: {reachable: RPCTypes.reachabilityReachable.unknown},
  seenMsgs: {},
}

export {initialState}
