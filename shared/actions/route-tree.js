// @flow
import * as I from 'immutable'
import * as Saga from '../util/saga'
import * as RouteTreeGen from './route-tree-gen'
import {_getNavigator} from '../constants/router2'
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

const dispatchNav2Action = (state, {payload: {action}}) => {
  const navigator = _getNavigator()
  if (navigator) {
    navigator.dispatch(action)
  }
}

function* routeSaga(): any {
  yield* Saga.chainAction(RouteTreeGen.putActionIfOnPath, putActionIfOnPath)
  yield* Saga.chainAction(RouteTreeGen.dispatchNav2Action, dispatchNav2Action)
}

export default routeSaga
