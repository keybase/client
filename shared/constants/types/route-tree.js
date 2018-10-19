// @flow
import * as I from 'immutable'
import * as Tabs from '../tabs'
import type {RouteDefNode, RouteStateNode} from '../../route-tree'

export type _State = {
  loggedInUserNavigated: boolean,
  previousTab: ?Tabs.Tab,
  routeDef: ?RouteDefNode,
  routeState: ?RouteStateNode,
}
export type State = I.RecordOf<_State>
