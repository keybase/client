// @flow
// File to map action type to loggable action.
// We don't want to log every part of the action, just the useful bits.

import * as I from 'immutable'
import * as RouteTreeConstants from '../constants/route-tree'
import * as ChatGen from '../actions/chat-gen'
import * as AppGen from '../actions/app-gen'
import * as ConfigGen from '../actions/config-gen'
import * as GregorGen from '../actions/gregor-gen'
import * as EngineGen from '../actions/engine-gen'
import type {TypedState} from '../constants/reducer'
import {getPath} from '../route-tree'
import * as Entity from '../constants/types/entities'

type ActionTransformer<P, A: {type: string, payload: P}> = (
  a: A,
  state: TypedState
) => ?{type: string, payload?: Object}

// If you use nullTransform it'll not be logged at all
const nullTransform: ActionTransformer<*, *> = action => {
  return null
}

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
  [ChatGen.postMessage]: (action: ChatGen.PostMessagePayload) => ({
    payload: {conversationIDKey: action.payload.conversationIDKey},
    type: action.type,
  }),
  [ChatGen.retryMessage]: (action: ChatGen.RetryMessagePayload) => ({
    payload: {
      conversationIDKey: action.payload.conversationIDKey,
      outboxIDKey: action.payload.outboxIDKey,
    },
    type: action.type,
  }),
  [ChatGen.replaceEntity]: entityTransformer,
  [ChatGen.deleteEntity]: entityTransformer,
  [ChatGen.mergeEntity]: entityTransformer,
  [ChatGen.subtractEntity]: entityTransformer,
  'entity:delete': entityTransformer,
  'entity:merge': entityTransformer,
  'entity:replace': entityTransformer,
  'entity:subtract': entityTransformer,
  _loadAvatarHelper: nullTransform,
  [ChatGen.clearRekey]: nullTransform,
  [ConfigGen.clearAvatarCache]: nullTransform,
  [ConfigGen.loadAvatars]: nullTransform,
  [ConfigGen.loadTeamAvatars]: nullTransform,
  [ConfigGen.loadedAvatars]: nullTransform,
  [ConfigGen.persistRouteState]: nullTransform,
  [EngineGen.waitingForRpc]: nullTransform,
  [GregorGen.pushOOBM]: nullTransform,
  [AppGen.changedFocus]: nullTransform,
}

const transformActionForLog: ActionTransformer<*, *> = (action, state) =>
  actionTransformMap[action.type]
    ? actionTransformMap[action.type](action, state)
    : defaultTransformer(action, state)

export default transformActionForLog
