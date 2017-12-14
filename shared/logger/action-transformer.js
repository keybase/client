// @flow
// File to map action type to loggable action.
// We don't want to log every part of the action, just the useful bits.

import * as I from 'immutable'
import * as RouteTreeConstants from '../constants/route-tree'
import * as ChatGen from '../actions/chat-gen'
import type {TypedState} from '../constants/reducer'
import {getPath} from '../route-tree'

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

const safeServerMessageMap = (m: any) => ({
  key: m.key,
  messageID: m.messageID,
  messageState: m.messageState,
  outboxID: m.outboxID,
  type: m.type,
})

const defaultTransformer: ActionTransformer<*, *> = ({type}) => ({type})

const actionTransformMap: {[key: string]: ActionTransformer<*, *>} = {
  [RouteTreeConstants.switchTo]: pathActionTransformer,
  [RouteTreeConstants.navigateTo]: pathActionTransformer,
  [RouteTreeConstants.navigateAppend]: pathActionTransformer,
  [RouteTreeConstants.setRouteState]: pathActionTransformer,
  [RouteTreeConstants.resetRoute]: pathActionTransformer,

  [ChatGen.loadAttachmentPreview]: (action: ChatGen.LoadAttachmentPreviewPayload) => ({
    payload: {
      messageKey: action.payload.messageKey,
    },
    type: action.type,
  }),
  [ChatGen.attachmentLoaded]: (action: ChatGen.AttachmentLoadedPayload) => ({
    payload: {
      messageKey: action.payload.messageKey,
      isPreview: action.payload.isPreview,
    },
    type: action.type,
  }),

  [ChatGen.downloadProgress]: (action: ChatGen.DownloadProgressPayload) => ({
    payload: {
      messageKey: action.payload.messageKey,
      isPreview: action.payload.messageKey,
      progress: action.payload.progress === 0 ? 'zero' : action.payload.progress === 1 ? 'one' : 'partial',
    },
    type: action.type,
  }),

  [ChatGen.appendMessages]: (action: ChatGen.AppendMessagesPayload) => ({
    payload: {
      conversationIDKey: action.payload.conversationIDKey,
      messages: action.payload.messages.map(safeServerMessageMap),
      svcShouldDisplayNotification: action.payload.svcShouldDisplayNotification,
    },
    type: action.type,
  }),
  [ChatGen.prependMessages]: (action: ChatGen.PrependMessagesPayload) => ({
    payload: {
      conversationIDKey: action.payload.conversationIDKey,
      messages: action.payload.messages.map(safeServerMessageMap),
      moreToLoad: action.payload.moreToLoad,
    },
    type: action.type,
  }),

  [ChatGen.updateTempMessage]: (action: ChatGen.UpdateTempMessagePayload) => ({
    payload: {conversationIDKey: action.payload.conversationIDKey, outboxIDKey: action.payload.outboxIDKey},
    type: action.type,
  }),
}

const transformActionForLog: ActionTransformer<*, *> = (action, state) =>
  actionTransformMap[action.type]
    ? actionTransformMap[action.type](action, state)
    : defaultTransformer(action, state)

export default transformActionForLog
