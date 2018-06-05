// @flow
// File to map action type to loggable action.
// We don't want to log every part of the action, just the useful bits.

import * as I from 'immutable'
import * as RouteTreeConstants from '../constants/route-tree'
import * as AppGen from '../actions/app-gen'
import * as Chat2Gen from '../actions/chat2-gen'
import * as ConfigGen from '../actions/config-gen'
import * as GregorGen from '../actions/gregor-gen'
import * as EngineGen from '../actions/engine-gen'
import {getPath} from '../route-tree'
import type {TypedState} from '../constants/reducer'
import * as Entity from '../constants/types/entities'

// If you use nullTransform it'll not be logged at all
const nullTransform = action => {
  return null
}

const pathActionTransformer = (action, oldState) => {
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

const defaultTransformer = ({type}) => ({type})
const fullOutput = a => a

const actionTransformMap = {
  [RouteTreeConstants.switchTo]: pathActionTransformer,
  [RouteTreeConstants.navigateTo]: pathActionTransformer,
  [RouteTreeConstants.navigateAppend]: pathActionTransformer,
  [RouteTreeConstants.setRouteState]: pathActionTransformer,
  [RouteTreeConstants.resetRoute]: pathActionTransformer,

  'entity:delete': entityTransformer,
  'entity:merge': entityTransformer,
  'entity:replace': entityTransformer,
  'entity:subtract': entityTransformer,

  _loadAvatarHelper: nullTransform,
  [ConfigGen.loadAvatars]: nullTransform,
  [ConfigGen.loadTeamAvatars]: nullTransform,
  [ConfigGen.loadedAvatars]: nullTransform,
  [ConfigGen.persistRouteState]: nullTransform,
  [EngineGen.waitingForRpc]: nullTransform,
  [GregorGen.pushOOBM]: nullTransform,
  [AppGen.changedFocus]: nullTransform,
  [Chat2Gen.updateTypers]: nullTransform,

  [Chat2Gen.setLoading]: fullOutput,
  [Chat2Gen.clearLoading]: fullOutput,
  [Chat2Gen.selectConversation]: fullOutput,
  [Chat2Gen.metaNeedsUpdating]: fullOutput,
  [Chat2Gen.updateMoreToLoad]: fullOutput,
  [Chat2Gen.setConversationOffline]: fullOutput,
  [ConfigGen.globalError]: a => {
    let err = {}
    const ge = a.payload.globalError
    if (ge) {
      err = {err: `Global Error: ${ge.message} ${ge.stack || ''}`}
    }

    return {
      payload: err,
      type: a.type,
    }
  },
  [Chat2Gen.setPendingMode]: fullOutput,
  [Chat2Gen.setPendingConversationUsers]: fullOutput,

  [Chat2Gen.messageSend]: a => ({
    payload: {conversationIDKey: a.payload.conversationIDKey},
    type: a.type,
  }),
  [Chat2Gen.messagesAdd]: a => ({
    payload: {context: a.context},
    type: a.type,
  }),
  [Chat2Gen.messagesWereDeleted]: a => ({
    payload: {conversationIDKey: a.payload.conversationIDKey},
    type: a.type,
  }),
}

const transformActionForLog = (action: any, state: TypedState) =>
  actionTransformMap[action.type]
    ? actionTransformMap[action.type](action, state)
    : defaultTransformer(action)

export default transformActionForLog
