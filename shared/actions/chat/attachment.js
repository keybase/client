// @flow
import * as ChatTypes from '../../constants/types/flow-types-chat'
import * as Constants from '../../constants/chat'
import * as EngineRpc from '../engine/helper'
import * as Creators from './creators'
import * as RPCTypes from '../../constants/types/flow-types'
import * as Saga from '../../util/saga'
import * as Shared from './shared'
import {putActionIfOnPath, navigateAppend} from '../route-tree'
import {saveAttachmentDialog, showShareActionSheet} from '../platform-specific'
import {tmpDir, tmpFile, downloadFilePath, copy, exists, stat} from '../../util/file'
import {isMobile} from '../../constants/platform'
import {usernameSelector} from '../../constants/selectors'
import {type TypedState} from '../../constants/reducer'
import {type SagaGenerator} from '../../constants/types/saga'

function* onShareAttachment({payload: {messageKey}}: Constants.ShareAttachment): SagaGenerator<any, any> {
  const path = yield Saga.call(onSaveAttachment, Creators.saveAttachment(messageKey))
  if (path) {
    yield Saga.call(showShareActionSheet, {url: path})
  }
}

function* onSaveAttachmentNative({
  payload: {messageKey},
}: Constants.SaveAttachmentNative): SagaGenerator<any, any> {
  const path = yield Saga.call(onSaveAttachment, Creators.saveAttachment(messageKey))
  if (path) {
    yield Saga.call(saveAttachmentDialog, path)
  }
}

function* onLoadAttachmentPreview({
  payload: {messageKey},
}: Constants.LoadAttachmentPreview): SagaGenerator<any, any> {
  yield Saga.put(Creators.loadAttachment(messageKey, true))
}

function* onSaveAttachment({payload: {messageKey}}: Constants.SaveAttachment): SagaGenerator<any, any> {
  const {savedPath, downloadedPath} = yield Saga.select((s: TypedState) => ({
    savedPath: Constants.getAttachmentSavedPath(s, messageKey),
    downloadedPath: Constants.getAttachmentDownloadedPath(s, messageKey),
  }))
  if (savedPath) {
    console.log('_saveAttachment: message already saved. bailing.', messageKey, savedPath)
    return savedPath
  }

  yield Saga.put(Creators.attachmentSaveStart(messageKey))

  const startTime = Date.now()
  if (!downloadedPath) {
    yield Saga.put(Creators.loadAttachment(messageKey, false))
    console.log('_saveAttachment: waiting for attachment to load', messageKey)
    yield Saga.take(
      action =>
        action.type === 'chat:attachmentLoaded' &&
        action.payload &&
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
        yield Saga.put(Creators.downloadProgress(messageKey, false, (i + 1) / 5))
        yield Saga.delay(150)
      }
      yield Saga.put(Creators.downloadProgress(messageKey, false, null))
    }
  }

  const nextDownloadedPath = yield Saga.select(Constants.getAttachmentDownloadedPath, messageKey)
  if (!nextDownloadedPath) {
    console.warn('_saveAttachment: message failed to download!')
    return
  }

  const {filename} = yield Saga.select(Constants.getMessageFromMessageKey, messageKey)
  const destPath = yield Saga.call(downloadFilePath, filename)

  try {
    yield copy(nextDownloadedPath, destPath)
  } catch (err) {
    console.warn('_saveAttachment: copy failed:', err)
    yield Saga.put(Creators.attachmentSaveFailed(messageKey))
    return
  }

  yield Saga.put(Creators.attachmentSaved(messageKey, destPath))
  return destPath
}

function downloadProgressSubSaga(messageKey, loadPreview) {
  return function*({bytesComplete, bytesTotal}) {
    yield Saga.put(Creators.downloadProgress(messageKey, loadPreview, bytesComplete / bytesTotal))
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
}: Constants.LoadAttachment): SagaGenerator<any, any> {
  // Check if we should download the attachment. Only one instance of this saga
  // should executes at any time, so that these checks don't interleave with
  // updating initial progress on the download.
  const {previewPath, previewProgress, downloadedPath, downloadProgress} = yield Saga.select(
    Constants.getLocalMessageStateFromMessageKey,
    messageKey
  )

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
        yield Saga.put(Creators.attachmentLoaded(messageKey, destPath, loadPreview))
        return
      }
    } catch (err) {
      console.warn('unexpected error statting file:', destPath, err)
    }
  }

  // Set initial progress value
  yield Saga.put.resolve(Creators.downloadProgress(messageKey, loadPreview, 0))

  // Perform the download in a fork so that the next loadAttachment action can be handled.
  yield Saga.spawn(function*() {
    const param = {
      conversationID: Constants.keyToConversationID(conversationIDKey),
      messageID: Constants.parseMessageID(messageID).msgID,
      filename: destPath,
      preview: loadPreview,
      identifyBehavior: RPCTypes.TlfKeysTLFIdentifyBehavior.chatGui,
    }

    const downloadFileRpc = new EngineRpc.EngineRpcCall(
      loadAttachmentSagaMap(messageKey, loadPreview),
      ChatTypes.localDownloadFileAttachmentLocalRpcChannelMap,
      `localDownloadFileAttachmentLocal-${conversationIDKey}-${messageID}`,
      {param}
    )

    try {
      const result = yield Saga.call(downloadFileRpc.run)
      if (EngineRpc.isFinished(result)) {
        yield Saga.put(Creators.attachmentLoaded(messageKey, destPath, loadPreview))
      } else {
        console.warn('downloadFileRpc bailed early')
        yield Saga.put(Creators.attachmentLoaded(messageKey, null, loadPreview))
      }
    } catch (err) {
      console.warn('attachment failed to load:', err)
      yield Saga.put(Creators.attachmentLoaded(messageKey, null, loadPreview))
    }
  })
}

function* _appendAttachmentPlaceholder(
  conversationIDKey: Constants.ConversationIDKey,
  outboxIDKey: Constants.OutboxIDKey,
  preview: ChatTypes.MakePreviewRes,
  title: string,
  uploadPath: string
) {
  const author = yield Saga.select(usernameSelector)
  const message: Constants.AttachmentMessage = {
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
  }

  const selectedConversation = yield Saga.select(Constants.getSelectedConversation)
  const appFocused = yield Saga.select(Shared.focusedSelector)

  yield Saga.put(
    Creators.appendMessages(
      conversationIDKey,
      conversationIDKey === selectedConversation,
      appFocused,
      [message],
      false
    )
  )
  yield Saga.put(Creators.attachmentLoaded(message.key, preview.filename, true))
  return message
}

function uploadProgressSubSaga(getCurKey: () => ?Constants.MessageKey) {
  return function*({bytesComplete, bytesTotal}) {
    const curKey = yield Saga.call(getCurKey)
    if (curKey) {
      yield Saga.put(Creators.uploadProgress(curKey, bytesComplete / bytesTotal))
    }
    return EngineRpc.rpcResult()
  }
}

function uploadOutboxIDSubSaga(
  conversationIDKey: Constants.ConversationIDKey,
  preview: boolean,
  title: string,
  filename: string,
  setCurKey: (key: Constants.MessageKey) => void,
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
    yield Saga.call(setCurKey, placeholderMessage.key)
    yield Saga.call(setOutboxId, outboxIDKey)
    return EngineRpc.rpcResult()
  }
}

// Hacky since curKey can change on us
const postAttachmentSagaMap = (
  conversationIDKey: Constants.ConversationIDKey,
  preview: boolean,
  title: string,
  filename: string,
  getCurKey: () => ?Constants.MessageKey,
  setCurKey: (key: Constants.MessageKey) => void,
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

function* onSelectAttachment({payload: {input}}: Constants.SelectAttachment): Generator<any, any, any> {
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

  const preview = yield Saga.call(ChatTypes.localMakePreviewRpcPromise, {
    param: {
      attachment: {filename},
      outputDir: tmpDir(),
    },
  })

  const inboxConvo = yield Saga.select(Constants.getInbox, conversationIDKey)
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
  let curKey: ?Constants.MessageKey = null
  let outboxID = null

  // When we receive the attachment placeholder message from the server, the
  // local message key basis will change from the outboxID to the messageID.
  // We need to watch for this so that the uploadProgress gets set on the
  // right message key.
  const getCurKey = () => curKey
  const getOutboxIdKey = () => outboxID

  const setCurKey = nextCurKey => {
    curKey = nextCurKey
  }
  const setOutboxIdKey = nextOutboxID => (outboxID = nextOutboxID)

  const postAttachment = new EngineRpc.EngineRpcCall(
    postAttachmentSagaMap(conversationIDKey, preview, title, filename, getCurKey, setCurKey, setOutboxIdKey),
    ChatTypes.localPostFileAttachmentLocalRpcChannelMap,
    `localPostFileAttachmentLocal-${conversationIDKey}-${title}-${filename}`,
    {param}
  )

  const keyChangedTask = yield Saga.safeTakeEvery(
    action => action.type === 'chat:outboxMessageBecameReal' && action.payload.oldMessageKey === getCurKey(),
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
          Creators.updateTempMessage(
            conversationIDKey,
            {
              messageState: 'failed',
              failureDescription: 'upload unsuccessful',
            },
            outboxIDKey
          )
        )
      }
      const curKey = yield Saga.call(getCurKey)
      yield Saga.put(Creators.uploadProgress(curKey, null))
    } else {
      console.warn('Upload Attachment Failed')
    }
  } finally {
    yield Saga.cancel(keyChangedTask)
  }
}

function* onRetryAttachment({
  payload: {input, oldOutboxID},
}: Constants.RetryAttachment): Generator<any, any, any> {
  yield Saga.put(Creators.removeOutboxMessage(input.conversationIDKey, oldOutboxID))
  yield Saga.call(onSelectAttachment, {payload: {input}})
}

function* onOpenAttachmentPopup(action: Constants.OpenAttachmentPopup): SagaGenerator<any, any> {
  const {message, currentPath} = action.payload
  const messageID = message.messageID
  if (!messageID) {
    throw new Error('Cannot open attachment popup for message missing ID')
  }

  yield Saga.put(
    putActionIfOnPath(
      currentPath,
      navigateAppend([{props: {messageKey: message.key}, selected: 'attachment'}])
    )
  )
  if (!message.hdPreviewPath && message.filename && message.messageID) {
    yield Saga.put(Creators.loadAttachment(message.key, false))
  }
}

function* registerSagas(): SagaGenerator<any, any> {
  yield Saga.safeTakeSerially('chat:loadAttachment', onLoadAttachment)
  yield Saga.safeTakeEvery('chat:openAttachmentPopup', onOpenAttachmentPopup)
  yield Saga.safeTakeEvery('chat:loadAttachmentPreview', onLoadAttachmentPreview)
  yield Saga.safeTakeEvery('chat:retryAttachment', onRetryAttachment)
  yield Saga.safeTakeEvery('chat:saveAttachment', onSaveAttachment)
  yield Saga.safeTakeEvery('chat:saveAttachmentNative', onSaveAttachmentNative)
  yield Saga.safeTakeEvery('chat:selectAttachment', onSelectAttachment)
  yield Saga.safeTakeEvery('chat:shareAttachment', onShareAttachment)
}

export {registerSagas}
