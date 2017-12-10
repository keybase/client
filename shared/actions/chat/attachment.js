// @flow
import * as RPCChatTypes from '../../constants/types/flow-types-chat'
import * as Types from '../../constants/types/chat'
import * as Constants from '../../constants/chat'
import * as ChatGen from '../chat-gen'
import * as I from 'immutable'
import * as EngineRpc from '../../constants/engine'
import * as RPCTypes from '../../constants/types/flow-types'
import * as Saga from '../../util/saga'
import * as EntityCreators from '../entities'
import * as Shared from './shared'
import {enableActionLogging} from '../../local-debug'
import {putActionIfOnPath, navigateAppend} from '../route-tree'
import {saveAttachmentDialog, showShareActionSheet} from '../platform-specific'
import {tmpDir, tmpFile, downloadFilePath, copy, exists, stat} from '../../util/file'
import {isMobile} from '../../constants/platform'
import {usernameSelector} from '../../constants/selectors'
import {type TypedState} from '../../constants/reducer'
import {type SagaGenerator} from '../../constants/types/saga'

function* onShareAttachment({
  payload: {messageKey},
}: ChatGen.ShareAttachmentPayload): SagaGenerator<any, any> {
  const path = yield Saga.call(onSaveAttachment, ChatGen.createSaveAttachment({messageKey}))
  if (path) {
    yield Saga.call(showShareActionSheet, {url: path})
  }
}

function* onSaveAttachmentNative({
  payload: {messageKey},
}: ChatGen.SaveAttachmentNativePayload): SagaGenerator<any, any> {
  const path = yield Saga.call(onSaveAttachment, ChatGen.createSaveAttachment({messageKey}))
  if (path) {
    yield Saga.call(saveAttachmentDialog, path)
  }
}

function onLoadAttachmentPreview({payload: {messageKey}}: ChatGen.LoadAttachmentPreviewPayload) {
  return Saga.put(ChatGen.createLoadAttachment({messageKey, loadPreview: true}))
}

function* onSaveAttachment({
  payload: {messageKey},
}: ChatGen.SaveAttachmentPayload): Generator<any, ?string, any> {
  const state: TypedState = yield Saga.select()
  const savedPath = Constants.getAttachmentSavedPath(state, messageKey)
  const downloadedPath = Constants.getAttachmentDownloadedPath(state, messageKey)

  if (savedPath) {
    console.log('_saveAttachment: message already saved. bailing.', messageKey, savedPath)
    return savedPath
  }

  yield Saga.put(ChatGen.createAttachmentSaveStart({messageKey}))

  const startTime = Date.now()
  if (!downloadedPath) {
    yield Saga.put(ChatGen.createLoadAttachment({messageKey, loadPreview: false}))
    console.log('_saveAttachment: waiting for attachment to load', messageKey)
    yield Saga.take(
      action =>
        action.type === ChatGen.attachmentLoaded &&
        action.payload.messageKey === messageKey &&
        action.payload.isPreview === false
    )
  }
  const endTime = Date.now()

  if (!isMobile) {
    // Instead of an instant download transition when already cached, we show a
    // brief fake progress bar.  We do this based on duration because the wait
    // above could be fast for multiple reasons: it could load instantly because
    // already cached on disk, or we could be near the end of an already-started
    // download.
    if (endTime - startTime < 500) {
      for (let i = 0; i < 5; i++) {
        yield Saga.put(ChatGen.createDownloadProgress({messageKey, isPreview: false, progress: (i + 1) / 5}))
        yield Saga.delay(150)
      }
      yield Saga.put(ChatGen.createDownloadProgress({messageKey, isPreview: false, progress: null}))
    }
  }

  const state2: TypedState = yield Saga.select()
  const nextDownloadedPath = Constants.getAttachmentDownloadedPath(state2, messageKey)
  if (!nextDownloadedPath) {
    console.warn('_saveAttachment: message failed to download!')
    return null
  }

  const message = Constants.getMessageFromMessageKey(state2, messageKey)
  if (!message || !message.filename) {
    console.warn("can't find message")
    return null
  }
  // $FlowIssue
  const filename: string = message.filename
  const destPath = yield Saga.call(downloadFilePath, filename)

  try {
    yield copy(nextDownloadedPath, destPath)
  } catch (err) {
    console.warn('_saveAttachment: copy failed:', err)
    yield Saga.put(ChatGen.createAttachmentSaveFailed({messageKey}))
    return null
  }

  yield Saga.put(ChatGen.createAttachmentSaved({messageKey, path: destPath}))
  return destPath
}

function downloadProgressSubSaga(messageKey, loadPreview) {
  return function*({bytesComplete, bytesTotal}) {
    yield Saga.put(
      ChatGen.createDownloadProgress({
        messageKey,
        isPreview: loadPreview,
        progress: bytesComplete / bytesTotal,
      })
    )
    return EngineRpc.rpcResult()
  }
}

const loadAttachmentSagaMap = (messageKey, loadPreview) => ({
  'chat.1.chatUi.chatAttachmentDownloadStart': EngineRpc.passthroughResponseSaga,
  'chat.1.chatUi.chatAttachmentDownloadProgress': downloadProgressSubSaga(messageKey, loadPreview),
  'chat.1.chatUi.chatAttachmentDownloadDone': EngineRpc.passthroughResponseSaga,
})

function* onLoadAttachment({
  payload: {messageKey, loadPreview},
}: ChatGen.LoadAttachmentPayload): SagaGenerator<any, any> {
  // Check if we should download the attachment. Only one instance of this saga
  // should executes at any time, so that these checks don't interleave with
  // updating initial progress on the download.
  const state: TypedState = yield Saga.select()
  const {
    previewPath,
    previewProgress,
    downloadedPath,
    downloadProgress,
  } = Constants.getLocalMessageStateFromMessageKey(state, messageKey)

  if (loadPreview) {
    if (previewPath || previewProgress !== null) {
      // Already downloaded / downloading preview
      console.log(
        'onLoadAttachment: preview already downloaded/downloading. bailing.',
        messageKey,
        previewPath,
        previewProgress
      )
      return
    }
  } else {
    if (downloadedPath || downloadProgress !== null) {
      // Already downloaded / downloading attachment
      console.log(
        'onLoadAttachment: attachment already downloaded/downloading. bailing.',
        messageKey,
        downloadedPath,
        downloadProgress
      )
      return
    }
  }

  const {conversationIDKey, messageID} = Constants.splitMessageIDKey(messageKey)
  const destPath = tmpFile(Shared.tmpFileName(loadPreview, conversationIDKey, messageID))
  const fileExists = yield Saga.call(exists, destPath)
  if (fileExists) {
    try {
      const fileStat = yield Saga.call(stat, destPath)
      if (fileStat.size === 0) {
        console.warn('attachment file had size 0. overwriting:', destPath)
        // Fall through to download attachment
      } else {
        yield Saga.put(ChatGen.createAttachmentLoaded({messageKey, path: destPath, isPreview: loadPreview}))
        return
      }
    } catch (err) {
      console.warn('unexpected error statting file:', destPath, err)
    }
  }

  // Set initial progress value
  yield Saga.put.resolve(ChatGen.createDownloadProgress({messageKey, isPreview: loadPreview, progress: 0}))

  // Perform the download in a fork so that the next loadAttachment action can be handled.
  yield Saga.spawn(function*(): Generator<any, void, any> {
    const param = {
      conversationID: Constants.keyToConversationID(conversationIDKey),
      messageID: Constants.parseMessageID(messageID).msgID,
      filename: destPath,
      preview: loadPreview,
      identifyBehavior: RPCTypes.tlfKeysTLFIdentifyBehavior.chatGui,
    }

    const downloadFileRpc = new EngineRpc.EngineRpcCall(
      loadAttachmentSagaMap(messageKey, loadPreview),
      RPCChatTypes.localDownloadFileAttachmentLocalRpcChannelMap,
      `localDownloadFileAttachmentLocal-${conversationIDKey}-${messageID}`,
      param
    )

    try {
      const result = yield Saga.call(downloadFileRpc.run)
      if (EngineRpc.isFinished(result)) {
        yield Saga.put(ChatGen.createAttachmentLoaded({messageKey, path: destPath, isPreview: loadPreview}))
      } else {
        console.warn('downloadFileRpc bailed early')
        yield Saga.put(ChatGen.createAttachmentLoaded({messageKey, path: null, isPreview: loadPreview}))
      }
    } catch (err) {
      console.warn('attachment failed to load:', err)
      yield Saga.put(ChatGen.createAttachmentLoaded({messageKey, path: null, isPreview: loadPreview}))
    }
  })
}

function* _appendAttachmentPlaceholder(
  conversationIDKey: Types.ConversationIDKey,
  outboxIDKey: Types.OutboxIDKey,
  preview: RPCChatTypes.MakePreviewRes,
  title: string,
  uploadPath: string
): Generator<any, ?Types.AttachmentMessage, any> {
  const state: TypedState = yield Saga.select()
  const author = usernameSelector(state)
  if (!author) {
    console.log('No logged in user append attach placeholder?')
    return
  }
  const lastOrd = Constants.lastOrdinal(state, conversationIDKey)
  const message: Types.AttachmentMessage = {
    author,
    conversationIDKey,
    deviceName: '',
    deviceType: isMobile ? 'mobile' : 'desktop',
    failureDescription: '',
    key: Constants.messageKey(conversationIDKey, 'outboxIDAttachment', outboxIDKey),
    messageState: 'pending',
    rawMessageID: -1,
    outboxID: outboxIDKey,
    senderDeviceRevokedAt: null,
    timestamp: Date.now(),
    type: 'Attachment',
    you: author,
    ...Constants.getAttachmentInfo(preview),
    title,
    uploadPath,
    ordinal: Constants.nextFractionalOrdinal(lastOrd), // Add an ordinal here to keep in correct order
  }

  const selectedConversation = Constants.getSelectedConversation(state)
  const appFocused = Shared.focusedSelector(state)

  yield Saga.put(
    ChatGen.createAppendMessages({
      conversationIDKey,
      isSelected: conversationIDKey === selectedConversation,
      isAppFocused: appFocused,
      messages: [message],
      svcShouldDisplayNotification: false,
    })
  )
  yield Saga.put(
    ChatGen.createAttachmentLoaded({messageKey: message.key, path: preview.filename, isPreview: true})
  )
  return message
}

function uploadProgressSubSaga(getCurKey: () => ?Types.MessageKey) {
  return function*({bytesComplete, bytesTotal}) {
    const curKey = yield Saga.call(getCurKey)
    if (curKey) {
      yield Saga.put(ChatGen.createUploadProgress({messageKey: curKey, progress: bytesComplete / bytesTotal}))
    }
    return EngineRpc.rpcResult()
  }
}

function uploadOutboxIDSubSaga(
  conversationIDKey: Types.ConversationIDKey,
  preview: RPCChatTypes.MakePreviewRes,
  title: string,
  filename: string,
  setCurKey: (key: Types.MessageKey) => void,
  setOutboxId: Function
) {
  return function*({outboxID}) {
    const outboxIDKey = Constants.outboxIDToKey(outboxID)
    const placeholderMessage = yield Saga.call(
      _appendAttachmentPlaceholder,
      conversationIDKey,
      outboxIDKey,
      preview,
      title,
      filename
    )
    if (!placeholderMessage) {
      return EngineRpc.rpcError()
    }
    yield Saga.call(setCurKey, placeholderMessage.key)
    yield Saga.call(setOutboxId, outboxIDKey)
    return EngineRpc.rpcResult()
  }
}

// Hacky since curKey can change on us
const postAttachmentSagaMap = (
  conversationIDKey: Types.ConversationIDKey,
  preview: RPCChatTypes.MakePreviewRes,
  title: string,
  filename: string,
  getCurKey: () => ?Types.MessageKey,
  setCurKey: (key: Types.MessageKey) => void,
  setOutboxId: Function
) => ({
  'chat.1.chatUi.chatAttachmentUploadOutboxID': uploadOutboxIDSubSaga(
    conversationIDKey,
    preview,
    title,
    filename,
    setCurKey,
    setOutboxId
  ),
  'chat.1.chatUi.chatAttachmentUploadStart': EngineRpc.passthroughResponseSaga,
  'chat.1.chatUi.chatAttachmentPreviewUploadStart': EngineRpc.passthroughResponseSaga,
  'chat.1.chatUi.chatAttachmentUploadProgress': uploadProgressSubSaga(getCurKey),
  'chat.1.chatUi.chatAttachmentUploadDone': EngineRpc.passthroughResponseSaga,
  'chat.1.chatUi.chatAttachmentPreviewUploadDone': EngineRpc.passthroughResponseSaga,
})

function* onSelectAttachment({payload: {input}}: ChatGen.SelectAttachmentPayload): Generator<any, any, any> {
  const {title, filename} = input
  let {conversationIDKey} = input
  let newConvoTlfName

  if (Constants.isPendingConversationIDKey(conversationIDKey)) {
    // Get a real conversationIDKey
    ;[conversationIDKey, newConvoTlfName] = yield Saga.call(Shared.startNewConversation, conversationIDKey)
    if (!conversationIDKey) {
      return
    }
  }

  const preview = yield Saga.call(RPCChatTypes.localMakePreviewRpcPromise, {
    attachment: {filename},
    outputDir: tmpDir(),
  })

  const state: TypedState = yield Saga.select()
  const inboxConvo = Constants.getInbox(state, conversationIDKey)
  if (!inboxConvo) {
    console.log("Can't find inbox for select attachment")
    return
  }
  const param = {
    conversationID: Constants.keyToConversationID(conversationIDKey),
    tlfName: inboxConvo ? inboxConvo.name : newConvoTlfName,
    visibility: inboxConvo.visibility,
    attachment: {filename},
    preview,
    title,
    metadata: null,
    identifyBehavior: yield Saga.call(Shared.getPostingIdentifyBehavior, conversationIDKey),
  }

  // TODO This is really hacky, should get reworked
  let curKey: ?Types.MessageKey = null
  let outboxID = null

  // When we receive the attachment placeholder message from the server, the
  // local message key basis will change from the outboxID to the messageID.
  // We need to watch for this so that the uploadProgress gets set on the
  // right message key.
  const getCurKey = (): ?Types.MessageKey => curKey
  const getOutboxIdKey = (): ?Types.OutboxIDKey => outboxID

  const setCurKey = nextCurKey => {
    curKey = nextCurKey
  }
  const setOutboxIdKey = nextOutboxID => (outboxID = nextOutboxID)

  const postAttachment = new EngineRpc.EngineRpcCall(
    postAttachmentSagaMap(conversationIDKey, preview, title, filename, getCurKey, setCurKey, setOutboxIdKey),
    RPCChatTypes.localPostFileAttachmentLocalRpcChannelMap,
    `localPostFileAttachmentLocal-${conversationIDKey}-${title}-${filename}`,
    param
  )

  const keyChangedTask = yield Saga.safeTakeEvery(
    action => action.type === ChatGen.outboxMessageBecameReal && action.payload.oldMessageKey === getCurKey(),
    function*(action) {
      yield Saga.call(setCurKey, action.payload.newMessageKey)
    }
  )

  try {
    const result = yield Saga.call(postAttachment.run)
    if (EngineRpc.isFinished(result)) {
      if (result.error) {
        const outboxIDKey = yield Saga.call(getOutboxIdKey)
        yield Saga.put(
          ChatGen.createUpdateTempMessage({
            conversationIDKey,
            message: {
              messageState: 'failed',
              failureDescription: 'upload unsuccessful',
            },
            outboxIDKey,
          })
        )
      }
      const curKey = yield Saga.call(getCurKey)
      yield Saga.put(ChatGen.createUploadProgress({messageKey: curKey, progress: null}))
    } else {
      console.warn('Upload Attachment Failed')
    }
  } finally {
    yield Saga.cancel(keyChangedTask)
  }
}

function onRetryAttachment({payload: {message}}: ChatGen.RetryAttachmentPayload) {
  const {conversationIDKey, uploadPath, title, previewType, outboxID} = message
  if (!uploadPath || !title || !previewType) {
    throw new Error('attempted to retry attachment without upload path')
  }
  if (!outboxID) {
    throw new Error('attempted to retry attachment without outboxID')
  }

  const input = {
    conversationIDKey,
    filename: uploadPath,
    title,
    type: previewType || 'Other',
  }

  return Saga.sequentially([
    Saga.put(ChatGen.createRemoveOutboxMessage({conversationIDKey: input.conversationIDKey, outboxID})),
    Saga.call(onSelectAttachment, {payload: {input}, type: ChatGen.selectAttachment, error: false}),
  ])
}

function onOpenAttachmentPopup(action: ChatGen.OpenAttachmentPopupPayload) {
  const {message, currentPath} = action.payload
  const messageID = message.messageID
  if (!messageID) {
    throw new Error('Cannot open attachment popup for message missing ID')
  }

  const actions = []
  actions.push(
    Saga.put(
      putActionIfOnPath(
        currentPath,
        navigateAppend([{props: {messageKey: message.key}, selected: 'attachment'}])
      )
    )
  )
  if (!message.hdPreviewPath && message.filename && message.messageID) {
    actions.push(Saga.put(ChatGen.createLoadAttachment({messageKey: message.key, loadPreview: false})))
  }

  return Saga.all(actions)
}

function attachmentLoaded(action: ChatGen.AttachmentLoadedPayload) {
  const {payload: {messageKey, path, isPreview}} = action
  if (isPreview) {
    return Saga.all([
      Saga.put(EntityCreators.replaceEntity(['attachmentPreviewPath'], I.Map({[messageKey]: path}))),
      Saga.put(EntityCreators.replaceEntity(['attachmentPreviewProgress'], I.Map({[messageKey]: null}))),
    ])
  }
  return Saga.all([
    Saga.put(EntityCreators.replaceEntity(['attachmentDownloadedPath'], I.Map({[messageKey]: path}))),
    Saga.put(EntityCreators.replaceEntity(['attachmentDownloadProgress'], I.Map({[messageKey]: null}))),
  ])
}

function updateProgress(action: ChatGen.DownloadProgressPayload | ChatGen.UploadProgressPayload) {
  const {type, payload: {progress, messageKey}} = action
  if (type === ChatGen.downloadProgress) {
    if (action.payload.isPreview) {
      return Saga.put(
        EntityCreators.replaceEntity(['attachmentPreviewProgress'], I.Map({[messageKey]: progress}))
      )
    }
    return Saga.put(
      EntityCreators.replaceEntity(['attachmentDownloadProgress'], I.Map({[messageKey]: progress}))
    )
  }
  return Saga.put(EntityCreators.replaceEntity(['attachmentUploadProgress'], I.Map({[messageKey]: progress})))
}

function updateAttachmentSavePath(
  action:
    | ChatGen.AttachmentSaveStartPayload
    | ChatGen.AttachmentSaveFailedPayload
    | ChatGen.AttachmentSavedPayload
) {
  const {messageKey} = action.payload
  switch (action.type) {
    case ChatGen.attachmentSaveFailed:
    case ChatGen.attachmentSaveStart:
      return Saga.put(EntityCreators.replaceEntity(['attachmentSavedPath'], I.Map({[messageKey]: null})))
    case ChatGen.attachmentSaved:
      const {path} = action.payload
      return Saga.put(EntityCreators.replaceEntity(['attachmentSavedPath'], I.Map({[messageKey]: path})))
  }
}

function _logLoadAttachmentPreview(action: ChatGen.LoadAttachmentPreviewPayload) {
  const toPrint = {
    payload: {
      messageKey: action.payload.messageKey,
    },
    type: action.type,
  }
  console.log('Load Attachment Preview', JSON.stringify(toPrint, null, 2))
}

function _logAttachmentLoaded(action: ChatGen.AttachmentLoadedPayload) {
  const toPrint = {
    payload: {
      messageKey: action.payload.messageKey,
      isPreview: action.payload.isPreview,
    },
    type: action.type,
  }
  console.log('Load Attachment Loaded', JSON.stringify(toPrint, null, 2))
}

function _logDownloadProgress(action: ChatGen.DownloadProgressPayload) {
  const toPrint = {
    payload: {
      messageKey: action.payload.messageKey,
      isPreview: action.payload.messageKey,
      progress: action.payload.progress === 0 ? 'zero' : action.payload.progress === 1 ? 'one' : 'partial',
    },
    type: action.type,
  }

  console.log('Download Progress', JSON.stringify(toPrint, null, 2))
}

function* registerSagas(): SagaGenerator<any, any> {
  yield Saga.safeTakeSerially(ChatGen.loadAttachment, onLoadAttachment)
  yield Saga.safeTakeEveryPure(ChatGen.openAttachmentPopup, onOpenAttachmentPopup)
  yield Saga.safeTakeEveryPure(ChatGen.loadAttachmentPreview, onLoadAttachmentPreview)
  yield Saga.safeTakeEveryPure(ChatGen.retryAttachment, onRetryAttachment)
  yield Saga.safeTakeEvery(ChatGen.saveAttachment, onSaveAttachment)
  yield Saga.safeTakeEvery(ChatGen.saveAttachmentNative, onSaveAttachmentNative)
  yield Saga.safeTakeEvery(ChatGen.selectAttachment, onSelectAttachment)
  yield Saga.safeTakeEvery(ChatGen.shareAttachment, onShareAttachment)
  yield Saga.safeTakeEveryPure(ChatGen.attachmentLoaded, attachmentLoaded)
  yield Saga.safeTakeEveryPure([ChatGen.downloadProgress, ChatGen.uploadProgress], updateProgress)
  yield Saga.safeTakeEveryPure(
    [ChatGen.attachmentSaveStart, ChatGen.attachmentSaveFailed, ChatGen.attachmentSaved],
    updateAttachmentSavePath
  )

  if (enableActionLogging) {
    yield Saga.safeTakeEveryPure(ChatGen.loadAttachmentPreview, _logLoadAttachmentPreview)
    yield Saga.safeTakeEveryPure(ChatGen.attachmentLoaded, _logAttachmentLoaded)
    yield Saga.safeTakeEveryPure(ChatGen.downloadProgress, _logDownloadProgress)
  }
}

export {registerSagas}
