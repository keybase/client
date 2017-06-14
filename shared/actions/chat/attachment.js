// @flow
import * as ChatTypes from '../../constants/types/flow-types-chat'
import * as Constants from '../../constants/chat'
import * as EngineRpc from '../engine/helper'
import * as Creators from './creators'
import * as RPCTypes from '../../constants/types/flow-types'
import * as Saga from '../../util/saga'
import * as Shared from './shared'
import {call, take, put, select, cancel, fork, join, spawn, race} from 'redux-saga/effects'
import {delay} from 'redux-saga'
import {putActionIfOnPath, navigateAppend} from '../route-tree'
import {saveAttachmentDialog, showShareActionSheet} from '../platform-specific'
import {tmpDir, tmpFile, downloadFilePath, copy, exists} from '../../util/file'
import {isMobile} from '../../constants/platform'
import {usernameSelector} from '../../constants/selectors'

import type {SagaGenerator} from '../../constants/types/saga'

function* onShareAttachment({payload: {messageKey}}: Constants.ShareAttachment): SagaGenerator<any, any> {
  const path = yield call(_saveAttachment, messageKey)
  if (path) {
    yield call(showShareActionSheet, {url: path})
  }
}

function* onSaveAttachmentNative({
  payload: {messageKey},
}: Constants.SaveAttachmentNative): SagaGenerator<any, any> {
  const path = yield call(_saveAttachment, messageKey)
  if (path) {
    yield call(saveAttachmentDialog, path)
  }
}

function* onLoadAttachmentPreview({
  payload: {messageKey},
}: Constants.LoadAttachmentPreview): SagaGenerator<any, any> {
  yield put(Creators.loadAttachment(messageKey, true))
}

function* onSaveAttachment({payload: {messageKey}}: Constants.SaveAttachment): SagaGenerator<any, any> {
  yield call(_saveAttachment, messageKey)
}

function* _saveAttachment(messageKey: Constants.MessageKey) {
  const localMessageState = yield select(Constants.getLocalMessageStateFromMessageKey, messageKey)
  if (localMessageState.savedPath) {
    console.log('_saveAttachment: message already saved. bailing.', messageKey, localMessageState.savedPath)
    return localMessageState.savedPath
  }

  yield put(Creators.attachmentSaveStart(messageKey))

  const startTime = Date.now()
  if (!localMessageState.downloadedPath) {
    yield put(Creators.loadAttachment(messageKey, false))
    console.log('_saveAttachment: waiting for attachment to load', messageKey)
    yield take(
      action =>
        action.type === 'chat:attachmentLoaded' &&
        action.payload &&
        action.payload.messageKey === messageKey &&
        action.payload.isPreview === false
    )
  }
  const endTime = Date.now()

  // Instead of an instant download transition when already cached, we show a
  // brief fake progress bar.  We do this based on duration because the wait
  // above could be fast for multiple reasons: it could load instantly because
  // already cached on disk, or we could be near the end of an already-started
  // download.
  if (endTime - startTime < 500) {
    for (let i = 0; i < 5; i++) {
      yield put(Creators.downloadProgress(messageKey, false, (i + 1) / 5))
      yield delay(150)
    }
    yield put(Creators.downloadProgress(messageKey, false, null))
  }

  const {downloadedPath} = yield select(Constants.getLocalMessageStateFromMessageKey, messageKey)
  if (!downloadedPath) {
    console.log('_saveAttachment: message failed to download!')
    return
  }

  const {filename} = yield select(Constants.getMessageFromMessageKey, messageKey)
  const destPath = yield call(downloadFilePath, filename)

  try {
    yield copy(downloadedPath, destPath)
  } catch (err) {
    console.warn('_saveAttachment: copy failed:', err)
    yield put(Creators.attachmentSaveFailed(messageKey))
    return
  }

  yield put(Creators.attachmentSaved(messageKey, destPath))
  return destPath
}

function downloadProgressSubSaga(messageKey, loadPreview) {
  return function*({bytesComplete, bytesTotal}) {
    yield put(Creators.downloadProgress(messageKey, loadPreview, bytesComplete / bytesTotal))
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
  const localMessageState = yield select(Constants.getLocalMessageStateFromMessageKey, messageKey)

  if (loadPreview) {
    if (localMessageState.previewPath || localMessageState.previewProgress !== null) {
      // Already downloaded / downloading preview
      console.log(
        'onLoadAttachment: preview already downloaded/downloading. bailing.',
        messageKey,
        localMessageState.previewPath,
        localMessageState.previewProgress
      )
      return
    }
  } else {
    if (localMessageState.downloadedPath || localMessageState.downloadProgress !== null) {
      // Already downloaded / downloading attachment
      console.log(
        'onLoadAttachment: attachment already downloaded/downloading. bailing.',
        messageKey,
        localMessageState.downloadedPath,
        localMessageState.downloadProgress
      )
      return
    }
  }

  const {conversationIDKey, messageID} = Constants.splitMessageIDKey(messageKey)
  const destPath = tmpFile(Shared.tmpFileName(loadPreview, conversationIDKey, messageID))
  const imageCached = yield call(exists, destPath)
  if (imageCached) {
    yield put(Creators.attachmentLoaded(messageKey, destPath, loadPreview))
    return
  }

  // Set initial progress value
  yield put.resolve(Creators.downloadProgress(messageKey, loadPreview, 0))

  // Perform the download in a fork so that the next loadAttachment action can be handled.
  yield spawn(function*() {
    const param = {
      conversationID: Constants.keyToConversationID(conversationIDKey),
      messageID,
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
      const result = yield call(downloadFileRpc.run)
      if (EngineRpc.isFinished(result)) {
        yield put(Creators.attachmentLoaded(messageKey, destPath, loadPreview))
      } else {
        console.warn('downloadFileRpc bailed early')
        yield put(Creators.attachmentLoaded(messageKey, null, loadPreview))
      }
    } catch (err) {
      console.warn('attachment failed to load:', err)
      yield put(Creators.attachmentLoaded(messageKey, null, loadPreview))
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
  const author = yield select(usernameSelector)
  const hasPendingFailure = yield select(Shared.pendingFailureSelector, outboxIDKey)
  const message: Constants.AttachmentMessage = {
    author,
    conversationIDKey,
    deviceName: '',
    deviceType: isMobile ? 'mobile' : 'desktop',
    failureDescription: hasPendingFailure,
    key: Constants.messageKey(conversationIDKey, 'outboxIDAttachment', outboxIDKey),
    messageState: hasPendingFailure ? 'failed' : 'pending',
    outboxID: outboxIDKey,
    senderDeviceRevokedAt: null,
    timestamp: Date.now(),
    type: 'Attachment',
    you: author,
    ...Constants.getAttachmentInfo(preview),
    title,
    uploadPath,
  }

  const selectedConversation = yield select(Constants.getSelectedConversation)
  const appFocused = yield select(Shared.focusedSelector)

  yield put(
    Creators.appendMessages(conversationIDKey, conversationIDKey === selectedConversation, appFocused, [
      message,
    ])
  )
  yield put(Creators.attachmentLoaded(message.key, preview.filename, true))
  if (hasPendingFailure) {
    yield put(Creators.removePendingFailure(outboxIDKey))
  }

  return message
}

function* onSelectAttachment({payload: {input}}: Constants.SelectAttachment): Generator<any, any, any> {
  const {title, filename} = input
  let {conversationIDKey} = input

  if (Constants.isPendingConversationIDKey(conversationIDKey)) {
    // Get a real conversationIDKey
    conversationIDKey = yield call(Shared.startNewConversation, conversationIDKey)
    if (!conversationIDKey) {
      return
    }
  }

  const preview = yield call(ChatTypes.localMakePreviewRpcPromise, {
    param: {
      attachment: {filename},
      outputDir: tmpDir(),
    },
  })

  const header = yield call(Shared.clientHeader, ChatTypes.CommonMessageType.attachment, conversationIDKey)
  const param = {
    conversationID: Constants.keyToConversationID(conversationIDKey),
    clientHeader: header,
    attachment: {filename},
    preview,
    title,
    metadata: null,
    identifyBehavior: yield call(Shared.getPostingIdentifyBehavior, conversationIDKey),
  }

  const channelConfig = Saga.singleFixedChannelConfig([
    'chat.1.chatUi.chatAttachmentUploadOutboxID',
    'chat.1.chatUi.chatAttachmentUploadStart',
    'chat.1.chatUi.chatAttachmentPreviewUploadStart',
    'chat.1.chatUi.chatAttachmentUploadProgress',
    'chat.1.chatUi.chatAttachmentUploadDone',
    'chat.1.chatUi.chatAttachmentPreviewUploadDone',
    'finished',
  ])

  const channelMap = (yield call(ChatTypes.localPostFileAttachmentLocalRpcChannelMapOld, channelConfig, {
    param,
  }): any)
  const outboxIDResp = yield Saga.takeFromChannelMap(channelMap, 'chat.1.chatUi.chatAttachmentUploadOutboxID')
  const {outboxID} = outboxIDResp.params
  const outboxIDKey = Constants.outboxIDToKey(outboxID)
  const placeholderMessage = yield call(
    _appendAttachmentPlaceholder,
    conversationIDKey,
    outboxIDKey,
    preview,
    title,
    filename
  )
  outboxIDResp.response.result()

  const progressTask = yield fork(function*() {
    // When we receive the attachment placeholder message from the server, the
    // local message key basis will change from the outboxID to the messageID.
    // We need to watch for this so that the uploadProgress gets set on the
    // right message key.
    let curKey = placeholderMessage.key
    while (true) {
      const {progress, keyChanged, finished} = yield race({
        progress: Saga.takeFromChannelMap(channelMap, 'chat.1.chatUi.chatAttachmentUploadProgress'),
        finished: Saga.takeFromChannelMap(channelMap, 'finished'),
        keyChanged: take(
          action => action.type === 'chat:outboxMessageBecameReal' && action.payload.oldMessageKey === curKey
        ),
      })
      if (keyChanged) {
        curKey = keyChanged.payload.newMessageKey
      } else if (progress) {
        const {bytesComplete, bytesTotal} = progress.params
        yield put(Creators.uploadProgress(curKey, bytesComplete / bytesTotal))
      } else if (finished) {
        if (finished.error) {
          yield put(
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
        yield put(Creators.uploadProgress(curKey, null))
        yield cancel()
      }
    }
  })

  const uploadStart = yield Saga.takeFromChannelMap(channelMap, 'chat.1.chatUi.chatAttachmentUploadStart')
  uploadStart.response.result()

  const previewUploadStart = yield Saga.takeFromChannelMap(
    channelMap,
    'chat.1.chatUi.chatAttachmentPreviewUploadStart'
  )
  previewUploadStart.response.result()
  const previewUploadDone = yield Saga.takeFromChannelMap(
    channelMap,
    'chat.1.chatUi.chatAttachmentPreviewUploadDone'
  )
  previewUploadDone.response.result()
  const uploadDone = yield Saga.takeFromChannelMap(channelMap, 'chat.1.chatUi.chatAttachmentUploadDone')
  uploadDone.response.result()

  yield join(progressTask)
  Saga.closeChannelMap(channelMap)
  // The message is updated when uploading finishes via an incoming attachmentuploaded message.
}

function* onRetryAttachment({
  payload: {input, oldOutboxID},
}: Constants.RetryAttachment): Generator<any, any, any> {
  yield put(Creators.removeOutboxMessage(input.conversationIDKey, oldOutboxID))
  yield call(onSelectAttachment, {payload: {input}})
}

function* onOpenAttachmentPopup(action: Constants.OpenAttachmentPopup): SagaGenerator<any, any> {
  const {message, currentPath} = action.payload
  const messageID = message.messageID
  if (!messageID) {
    throw new Error('Cannot open attachment popup for message missing ID')
  }

  yield put(
    putActionIfOnPath(
      currentPath,
      navigateAppend([{props: {messageKey: message.key}, selected: 'attachment'}])
    )
  )
  if (!message.hdPreviewPath && message.filename && message.messageID) {
    yield put(Creators.loadAttachment(message.key, false))
  }
}

export {
  onLoadAttachment,
  onLoadAttachmentPreview,
  onOpenAttachmentPopup,
  onRetryAttachment,
  onSaveAttachment,
  onSaveAttachmentNative,
  onShareAttachment,
  onSelectAttachment,
}
