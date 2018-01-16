// @flow
// File to map action type to loggable action.
// We don't want to log every part of the action, just the useful bits.

import * as I from 'immutable'
import * as RouteTreeConstants from '../constants/route-tree'
import type {TypedState} from '../constants/reducer'
import {getPath} from '../route-tree'
import * as Entity from '../constants/types/entities'

type ActionTransformer<P, A: {type: string, payload: P}> = (
  a: A,
  state: TypedState
) => {type: string, payload?: Object}

const pathActionTransformer: ActionTransformer<*, *> = (action, oldState) => {
  const prevPath = oldState.routeTree ? getPath(oldState.routeTree.routeState) : I.List()
  const path = Array.from(action.payload.path.map(p => (typeof p === 'string' ? p : p.selected)))
  const parentPath = action.payload.parentPath && Array.from(action.payload.parentPath)
  return {
    payload: {
      prevPath,
      path,
      parentPath,
    },
    type: action.type,
  }
}

const entityTransformer = (action: Entity.Actions) => ({
  payload: {keyPath: action.payload.keyPath},
  type: action.type,
})

const defaultTransformer: ActionTransformer<*, *> = ({type}) => ({type})

const actionTransformMap: {[key: string]: ActionTransformer<*, *>} = {
  [RouteTreeConstants.switchTo]: pathActionTransformer,
  [RouteTreeConstants.navigateTo]: pathActionTransformer,
  [RouteTreeConstants.navigateAppend]: pathActionTransformer,
  [RouteTreeConstants.setRouteState]: pathActionTransformer,
  [RouteTreeConstants.resetRoute]: pathActionTransformer,

  'entity:delete': entityTransformer,
  'entity:merge': entityTransformer,
  'entity:replace': entityTransformer,
  'entity:subtract': entityTransformer,
}

const transformActionForLog: ActionTransformer<*, *> = (action, state) =>
  actionTransformMap[action.type]
    ? actionTransformMap[action.type](action, state)
    : defaultTransformer(action, state)

export default transformActionForLog
