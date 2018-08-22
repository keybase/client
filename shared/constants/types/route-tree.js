// @flow
import * as I from 'immutable'
import type {RouteDefNode, RouteStateNode} from '../../route-tree'

export type _State = {
  loggedInUserNavigated: boolean,
  routeDef: ?RouteDefNode,
  routeState: ?RouteStateNode,
}
export type State = I.RecordOf<_State>
