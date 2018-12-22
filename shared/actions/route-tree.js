// @flow
import * as I from 'immutable'
import * as Saga from '../util/saga'
import * as RouteTreeGen from './route-tree-gen'
import {getPath} from '../route-tree'

import type {Path} from '../route-tree'
import type {TypedState} from '../constants/reducer'

function pathSelector(state: TypedState, parentPath?: Path): I.List<string> {
  return getPath(state.routeTree.routeState, parentPath)
}

const putActionIfOnPath = (state, {payload: {otherAction, expectedPath, parentPath}}) => {
  const currentPath = pathSelector(state, parentPath)
  if (I.is(I.List(expectedPath), currentPath)) {
    return otherAction
  }
}

function* routeSaga(): any {
  yield* Saga.chainAction(RouteTreeGen.putActionIfOnPath, putActionIfOnPath)
}

export default routeSaga
