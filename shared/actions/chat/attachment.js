// @flow
import * as ChatTypes from '../../constants/types/flow-types-chat'
import * as Constants from '../../constants/chat'
import * as EngineRpc from '../engine/helper'
import * as Creators from './creators'
import * as RPCTypes from '../../constants/types/flow-types'
import * as Saga from '../../util/saga'
import * as Shared from './shared'
import {call, take, put, select, cancel, fork, join} from 'redux-saga/effects'
import {delay} from 'redux-saga'
import {putActionIfOnPath, navigateAppend} from '../route-tree'
import {saveAttachmentDialog, showShareActionSheet} from '../platform-specific'
import {tmpDir, tmpFile, downloadFilePath, copy, exists} from '../../util/file'

import type {SagaGenerator} from '../../constants/types/saga'

function* onShareAttachment({payload: {message}}: Constants.ShareAttachment): SagaGenerator<any, any> {
  const {filename, messageID, conversationIDKey} = message
  if (filename && messageID) {
    const path = yield call(_saveAttachment, conversationIDKey, messageID)
    if (path) {
      yield call(showShareActionSheet, {url: path})
    }
  }
}

function* onSaveAttachmentNative({
  payload: {message},
}: Constants.SaveAttachmentNative): SagaGenerator<any, any> {
  const {filename, messageID, conversationIDKey} = message
  if (filename && messageID) {
    const path = yield call(_saveAttachment, conversationIDKey, messageID)
    if (path) {
      yield call(saveAttachmentDialog, path)
    }
  }
}

function* onLoadAttachmentPreview({
  payload: {message},
}: Constants.LoadAttachmentPreview): SagaGenerator<any, any> {
  const {filename, messageID, conversationIDKey} = message
  if (filename && messageID) {
    yield call(onLoadAttachment, Creators.loadAttachment(conversationIDKey, messageID, true))
  }
}

function* onSaveAttachment({
  payload: {conversationIDKey, messageID},
}: Constants.SaveAttachment): SagaGenerator<any, any> {
  yield _saveAttachment(conversationIDKey, messageID)
}

function* _saveAttachment(conversationIDKey: Constants.ConversationIDKey, messageID: Constants.MessageID) {
  const existingMessage = yield select(Shared.messageSelector, conversationIDKey, messageID)
  if (!existingMessage) {
    console.log('_saveAttachment: message does not exist', conversationIDKey, messageID)
    return
  }

  if (existingMessage.savedPath) {
    console.log(
      '_saveAttachment: message already saved. bailing.',
      conversationIDKey,
      messageID,
      existingMessage.savedPath
    )
    return existingMessage.savedPath
  }

  yield put(Creators.updateMessage(conversationIDKey, {savedPath: false}, messageID))

  const startTime = Date.now()
  if (!existingMessage.downloadedPath) {
    yield put(Creators.loadAttachment(conversationIDKey, messageID, false))
    console.log('_saveAttachment: waiting for attachment to load', conversationIDKey, messageID)
    yield take(
      action =>
        action.type === 'chat:attachmentLoaded' &&
        action.payload &&
        action.payload.conversationIDKey === conversationIDKey &&
        action.payload.messageID === messageID &&
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
      yield put(Creators.downloadProgress(conversationIDKey, messageID, false, i + 1, 5))
      yield delay(150)
    }
    yield put(Creators.updateMessage(conversationIDKey, {downloadProgress: null}, messageID))
  }

  const downloadedMessage = yield select(Shared.messageSelector, conversationIDKey, messageID)
  if (!downloadedMessage.downloadedPath) {
    console.log('_saveAttachment: message failed to download!')
    return
  }

  const destPath = yield call(downloadFilePath, downloadedMessage.filename)

  try {
    yield copy(downloadedMessage.downloadedPath, destPath)
  } catch (err) {
    console.warn('_saveAttachment: copy failed:', err)
    yield put(Creators.updateMessage(conversationIDKey, {savedPath: null}, messageID))
    return
  }

  yield put(Creators.attachmentSaved(conversationIDKey, messageID, destPath))
  return destPath
}

function downloadProgressSubSaga(conversationIDKey, messageID, loadPreview) {
  return function*({bytesComplete, bytesTotal}) {
    yield put(Creators.downloadProgress(conversationIDKey, messageID, loadPreview, bytesComplete, bytesTotal))
    return EngineRpc.rpcResult()
  }
}

const loadAttachmentSagaMap = (conversationIDKey, messageID, loadPreview) => ({
  'chat.1.chatUi.chatAttachmentDownloadStart': EngineRpc.passthroughResponseSaga,
  'chat.1.chatUi.chatAttachmentDownloadProgress': downloadProgressSubSaga(
    conversationIDKey,
    messageID,
    loadPreview
  ),
  'chat.1.chatUi.chatAttachmentDownloadDone': EngineRpc.passthroughResponseSaga,
})

function* onLoadAttachment({
  payload: {conversationIDKey, messageID, loadPreview},
}: Constants.LoadAttachment): SagaGenerator<any, any> {
  const existingMessage = yield select(Shared.messageSelector, conversationIDKey, messageID)
  if (!existingMessage) {
    console.log('onLoadAttachment: message does not exist', conversationIDKey, messageID)
    return
  }

  if (loadPreview) {
    if (existingMessage.previewPath || existingMessage.previewProgress !== null) {
      // Already downloaded / downloading preview
      console.log(
        'onLoadAttachment: preview already downloaded/downloading. bailing.',
        conversationIDKey,
        messageID,
        existingMessage.previewPath,
        existingMessage.previewProgress
      )
      return
    }
  } else {
    if (existingMessage.downloadedPath || existingMessage.downloadProgress !== null) {
      // Already downloaded / downloading attachment
      console.log(
        'onLoadAttachment: attachment already downloaded/downloading. bailing.',
        conversationIDKey,
        messageID,
        existingMessage.downloadedPath,
        existingMessage.downloadProgress
      )
      return
    }
  }

  const destPath = tmpFile(Shared.tmpFileName(loadPreview, conversationIDKey, messageID))
  const imageCached = yield call(exists, destPath)
  if (imageCached) {
    yield put(Creators.attachmentLoaded(conversationIDKey, messageID, destPath, loadPreview))
    return
  }

  // set initial progress value
  yield put(Creators.downloadProgress(conversationIDKey, messageID, loadPreview))

  const param = {
    conversationID: Constants.keyToConversationID(conversationIDKey),
    messageID,
    filename: destPath,
    preview: loadPreview,
    identifyBehavior: RPCTypes.TlfKeysTLFIdentifyBehavior.chatGui,
  }

  const downloadFileRpc = new EngineRpc.EngineRpcCall(
    loadAttachmentSagaMap(conversationIDKey, messageID, loadPreview),
    ChatTypes.localDownloadFileAttachmentLocalRpcChannelMap,
    `localDownloadFileAttachmentLocal-${conversationIDKey}-${messageID}`
  )

  try {
    const result = yield call([downloadFileRpc, downloadFileRpc.run], {param})
    if (EngineRpc.isFinished(result)) {
      yield put(Creators.attachmentLoaded(conversationIDKey, messageID, destPath, loadPreview))
    } else {
      console.warn('downloadFileRpc bailed early')
      yield put(Creators.attachmentLoaded(conversationIDKey, messageID, null, loadPreview))
    }
  } catch (err) {
    yield put(Creators.attachmentLoaded(conversationIDKey, messageID, null, loadPreview))
  }
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
  yield put(Creators.setAttachmentPlaceholderPreview(Constants.outboxIDToKey(outboxID), preview.filename))
  outboxIDResp.response.result()

  const uploadStart = yield Saga.takeFromChannelMap(channelMap, 'chat.1.chatUi.chatAttachmentUploadStart')
  const messageID = uploadStart.params.placeholderMsgID
  uploadStart.response.result()

  const finishedTask = yield fork(function*() {
    const finished = yield Saga.takeFromChannelMap(channelMap, 'finished')
    if (finished.error) {
      yield put(Creators.updateMessage(conversationIDKey, {messageState: 'failed'}, messageID))
    }
    return finished
  })

  const progressTask = yield Saga.effectOnChannelMap(
    c =>
      Saga.safeTakeEvery(c, function*({response}) {
        const {bytesComplete, bytesTotal} = response.param
        yield put(Creators.uploadProgress(conversationIDKey, messageID, bytesComplete, bytesTotal))
        response.result()
      }),
    channelMap,
    'chat.1.chatUi.chatAttachmentUploadProgress'
  )

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

  yield join(finishedTask)
  yield cancel(progressTask)
  Saga.closeChannelMap(channelMap)

  // The message is updated when uploading finishes via an incoming attachmentuploaded message.

  return messageID
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
      navigateAppend([
        {props: {messageID, conversationIDKey: message.conversationIDKey}, selected: 'attachment'},
      ])
    )
  )
  if (!message.hdPreviewPath && message.filename && message.messageID) {
    yield put(Creators.loadAttachment(message.conversationIDKey, messageID, false))
  }
}

export {
  onLoadAttachment,
  onLoadAttachmentPreview,
  onOpenAttachmentPopup,
  onSaveAttachment,
  onSaveAttachmentNative,
  onShareAttachment,
  onSelectAttachment,
}
