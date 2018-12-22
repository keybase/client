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

function* _putActionIfOnPath({payload: {otherAction, expectedPath, parentPath}}) {
  const state = yield* Saga.selectState()
  const currentPath = pathSelector(state, parentPath)
  if (I.is(I.List(expectedPath), currentPath)) {
    yield Saga.put(otherAction)
  }
}

function* routeSaga(): any {
  yield Saga.safeTakeEvery(RouteTreeGen.putActionIfOnPath, _putActionIfOnPath)
}

export default routeSaga
