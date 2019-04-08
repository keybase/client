import * as I from 'immutable'
import { RouteDefNode, RouteStateNode } from '../../route-tree';

export type _State = {
  loggedInUserNavigated: boolean,
  previousTab: string | null,
  routeDef: RouteDefNode | null,
  routeState: RouteStateNode | null
};
export type State = I.RecordOf<_State>;
