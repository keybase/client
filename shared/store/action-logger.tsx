import * as RouteTreeGen from '../actions/route-tree-gen'
import * as Chat2Gen from '../actions/chat2-gen'
import * as PushGen from '../actions/push-gen'
import * as ConfigGen from '../actions/config-gen'
import * as GregorGen from '../actions/gregor-gen'
import * as EngineGen from '../actions/engine-gen-gen'
import * as WaitingGen from '../actions/waiting-gen'
import type {TypedDispatch, TypedActions} from '../util/container'
import {debugFullLogs} from '../local-debug'
import logger from '../logger'

const TEMP_FULL_ACTION_OUTPUT = __DEV__ && debugFullLogs
if (TEMP_FULL_ACTION_OUTPUT) {
  for (let i = 0; i < 10; ++i) {
    console.error('TEMP_FULL_ACTION_OUTPUT enabled in action logger!')
  }
}

export const actionLogger = () => (next: TypedDispatch) => (action: TypedActions) => {
  try {
    const output = TEMP_FULL_ACTION_OUTPUT ? action.payload : transformActionForLog(action)
    if (output) {
      const log1 = [`type: ${action.type}: `, output]
      logger.action(...log1)
    }
  } catch (e) {
    logger.action(`Error logging action: ${action.type || 'unknown type'}`)
  }

  return next(action)
}

// We don't want to log every part of the action, just the useful bits.
const transformActionForLog = (action: TypedActions) => {
  switch (action.type) {
    // full output
    case RouteTreeGen.switchTab: // fallthrough
    case RouteTreeGen.switchLoggedIn: // fallthrough
    case ConfigGen.daemonHandshakeWait: // fallthrough
    case Chat2Gen.selectedConversation: // fallthrough
    case Chat2Gen.navigateToThread: // fallthrough
    case Chat2Gen.metaNeedsUpdating: // fallthrough
    case Chat2Gen.updateMoreToLoad: // fallthrough
    case Chat2Gen.setConversationOffline: // fallthrough
    case GregorGen.updateReachable: // fallthrough
    case WaitingGen.incrementWaiting: // fallthrough
    case WaitingGen.decrementWaiting: // fallthrough
    case WaitingGen.batchChangeWaiting: // fallthrough
    case WaitingGen.clearWaiting: // fallthrough
      return action

    // no output
    case GregorGen.pushOOBM: // fallthrough
    case ConfigGen.changedFocus: // fallthrough
    case EngineGen.chat1NotifyChatChatTypingUpdate: // fallthrough
      return null

    // custom
    case RouteTreeGen.navigateAppend: {
      const {fromKey, replace, path} = action.payload
      const cleanPath = Array.from(path.map(p => (typeof p === 'string' ? p : p.selected)))
      return {payload: {fromKey, path: cleanPath, replace}}
    }
    case PushGen.notification: {
      const {notification} = action.payload
      // @ts-ignore don't try and narrow, if it exists we want it
      const {conversationIDKey, type: ntype, userInteraction} = notification
      return {payload: {conversationIDKey, ntype, userInteraction}}
    }
    case ConfigGen.globalError: {
      const {type, payload} = action
      let {globalError} = payload
      let err = {}
      if (globalError) {
        err = {err: `Global Error: ${globalError.message} ${globalError.stack || ''}`}
      }
      return {payload: err, type}
    }
    case Chat2Gen.messagesWereDeleted: // fallthrough
    case Chat2Gen.messageSend: {
      const {conversationIDKey} = action.payload
      return {payload: {conversationIDKey}}
    }
    case Chat2Gen.messagesAdd: {
      const {context} = action.payload
      return {payload: {context}}
    }
    default: {
      return null
    }
  }
}

export default transformActionForLog
