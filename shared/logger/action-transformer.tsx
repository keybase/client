// File to map action type to loggable action.
// We don't want to log every part of the action, just the useful bits.

import * as RouteTreeGen from '../actions/route-tree-gen'
import * as Chat2Gen from '../actions/chat2-gen'
import * as ConfigGen from '../actions/config-gen'
import * as GregorGen from '../actions/gregor-gen'
import * as EngineGen from '../actions/engine-gen-gen'
import * as WaitingGen from '../actions/waiting-gen'
import * as EntitiesGen from '../actions/entities-gen'
import {TypedState} from '../constants/reducer'

// If you use nullTransform it'll not be logged at all
const nullTransform = () => null

const entityTransformer = (
  action:
    | EntitiesGen.DeleteEntityPayload
    | EntitiesGen.MergeEntityPayload
    | EntitiesGen.ReplaceEntityPayload
    | EntitiesGen.SubtractEntityPayload
) => ({
  payload: {keyPath: action.payload.keyPath},
  type: action.type,
})

const defaultTransformer = ({type}) => ({type})
const fullOutput = a => a

const actionTransformMap = {
  [RouteTreeGen.switchTab]: fullOutput,
  [RouteTreeGen.switchLoggedIn]: fullOutput,
  [RouteTreeGen.navigateAppend]: action => ({
    payload: {
      fromKey: action.payload.fromKey,
      path: Array.from(action.payload.path.map(p => (typeof p === 'string' ? p : p.selected))),
      replace: action.payload.replace,
    },
    type: action.type,
  }),

  [EntitiesGen.deleteEntity]: entityTransformer,
  [EntitiesGen.mergeEntity]: entityTransformer,
  [EntitiesGen.replaceEntity]: entityTransformer,
  [EntitiesGen.subtractEntity]: entityTransformer,

  _loadAvatarHelper: nullTransform,
  [ConfigGen.daemonHandshakeWait]: fullOutput,
  [GregorGen.pushOOBM]: nullTransform,
  [ConfigGen.changedFocus]: nullTransform,
  [EngineGen.chat1NotifyChatChatTypingUpdate]: nullTransform,

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
  [GregorGen.updateReachable]: fullOutput,

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

  [WaitingGen.incrementWaiting]: fullOutput,
  [WaitingGen.decrementWaiting]: fullOutput,
  [WaitingGen.batchChangeWaiting]: fullOutput,
  [WaitingGen.clearWaiting]: fullOutput,
}

const transformActionForLog = (action: any, state: TypedState) =>
  actionTransformMap[action.type]
    ? actionTransformMap[action.type](action, state)
    : defaultTransformer(action)

export default transformActionForLog
