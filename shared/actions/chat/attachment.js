// @flow
import * as ChatTypes from '../../constants/types/flow-types-chat'
import * as Constants from '../../constants/chat'
import * as Creators from './creators'
import * as RPCTypes from '../../constants/types/flow-types'
import * as Saga from '../../util/saga'
import * as Shared from './shared'
import {call, put, select, cancel, fork, join} from 'redux-saga/effects'
import {delay} from 'redux-saga'
import {putActionIfOnPath, navigateAppend} from '../route-tree'
import {saveAttachment, showShareActionSheet} from '../platform-specific'
import {tmpDir, tmpFile, downloadFilePath, copy, exists} from '../../util/file'

import type {SagaGenerator} from '../../constants/types/saga'

function * onShareAttachment ({payload: {message}}: Constants.ShareAttachment): SagaGenerator<any, any> {
  const {filename, messageID, conversationIDKey} = message
  if (filename && messageID) {
    const path = downloadFilePath(filename)
    yield call(onLoadAttachment, Creators.loadAttachment(conversationIDKey, messageID, path, false, false))
    yield call(showShareActionSheet, {url: path})
  }
}

function * onSaveAttachmentNative ({payload: {message}}: Constants.SaveAttachment): SagaGenerator<any, any> {
  const {filename, messageID, conversationIDKey} = message
  if (filename && messageID) {
    const path = downloadFilePath(filename)
    yield call(onLoadAttachment, Creators.loadAttachment(conversationIDKey, messageID, path, false, false))
    yield call(saveAttachment, path)
  }
}

function * onLoadAttachmentPreview ({payload: {message}}: Constants.LoadAttachmentPreview): SagaGenerator<any, any> {
  const {filename, messageID, conversationIDKey} = message
  if (filename && messageID) {
    const path = tmpFile(Shared.tmpFileName(false, conversationIDKey, messageID, filename))
    yield call(onLoadAttachment, Creators.loadAttachment(conversationIDKey, messageID, path, true, false))
  }
}

// Instead of redownloading the full attachment again, we may have it cached from an earlier hdPreview
// returns cached filepath
function * _isCached (conversationIDKey, messageID): Generator<any, ?string, any> {
  try {
    const message = yield select(Shared.messageSelector, conversationIDKey, messageID)
    if (message.hdPreviewPath) {
      const fileExists = yield call(exists, message.hdPreviewPath)
      return fileExists ? message.hdPreviewPath : null
    }
  } catch (e) {
    console.warn('error in checking cached file', e)
  }
}

function * onLoadAttachment ({payload: {conversationIDKey, messageID, loadPreview, isHdPreview, filename}}: Constants.LoadAttachment): SagaGenerator<any, any> {
  const existingMessage = yield select(Shared.messageSelector, conversationIDKey, messageID)
  const existingMessageState = existingMessage && existingMessage.messageState

  // See if we already have this image cached
  if (loadPreview || isHdPreview) {
    if (existingMessage && (loadPreview && existingMessage.previewPath || isHdPreview && existingMessage.hdPreviewPath)) {
      return
    }

    const imageCached = yield call(exists, filename)
    if (imageCached) {
      yield put(Creators.attachmentLoaded(conversationIDKey, messageID, filename, loadPreview, isHdPreview))
      return
    }
  }

  // If we are loading the actual attachment,
  // let's see if we've already downloaded it as an hdPreview
  if (!loadPreview && !isHdPreview) {
    if (existingMessageState === 'downloading') {
      return
    }

    const cachedPath = yield call(_isCached, conversationIDKey, messageID)

    if (cachedPath) {
      try {
        copy(cachedPath, filename)

        // for visual feedback, we'll briefly display a progress bar
        for (let i = 0; i < 5; i++) {
          yield put(Creators.downloadProgress(conversationIDKey, messageID, false, i + 1, 5))
          yield delay(5)
        }

        yield put(Creators.attachmentLoaded(conversationIDKey, messageID, filename, loadPreview, isHdPreview))
        return
      } catch (e) {
        console.warn('copy failed:', e)
      }
    }
  }

  // set message state to downloading or downloading-preview
  yield put(Creators.downloadProgress(conversationIDKey, messageID, loadPreview || isHdPreview))

  const param = {
    conversationID: Constants.keyToConversationID(conversationIDKey),
    messageID,
    filename,
    preview: loadPreview,
    identifyBehavior: RPCTypes.TlfKeysTLFIdentifyBehavior.chatGui,
  }

  const channelConfig = Saga.singleFixedChannelConfig([
    'chat.1.chatUi.chatAttachmentDownloadStart',
    'chat.1.chatUi.chatAttachmentDownloadProgress',
    'chat.1.chatUi.chatAttachmentDownloadDone',
  ])

  try {
    const channelMap = ((yield call(ChatTypes.localDownloadFileAttachmentLocalRpcChannelMap, channelConfig, {param})): any)

    const progressTask = yield Saga.effectOnChannelMap(c => Saga.safeTakeEvery(c, function * ({response}) {
      const {bytesComplete, bytesTotal} = response.param
      yield put(Creators.downloadProgress(conversationIDKey, messageID, loadPreview || isHdPreview, bytesComplete, bytesTotal))
      response.result()
    }), channelMap, 'chat.1.chatUi.chatAttachmentDownloadProgress')

    const start = yield Saga.takeFromChannelMap(channelMap, 'chat.1.chatUi.chatAttachmentDownloadStart')
    start.response.result()

    const done = yield Saga.takeFromChannelMap(channelMap, 'chat.1.chatUi.chatAttachmentDownloadDone')
    done.response.result()

    yield cancel(progressTask)
    Saga.closeChannelMap(channelMap)

    yield put(Creators.attachmentLoaded(conversationIDKey, messageID, filename, loadPreview, isHdPreview))
  } catch (err) {
    yield put(Creators.attachmentLoaded(conversationIDKey, messageID, null, loadPreview, isHdPreview))
  }
}

function * onSelectAttachment ({payload: {input}}: Constants.SelectAttachment): Generator<any, any, any> {
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

  const channelMap = ((yield call(ChatTypes.localPostFileAttachmentLocalRpcChannelMap, channelConfig, {param})): any)

  const outboxIDResp = yield Saga.takeFromChannelMap(channelMap, 'chat.1.chatUi.chatAttachmentUploadOutboxID')
  const {outboxID} = outboxIDResp.params
  yield put(Creators.setAttachmentPlaceholderPreview(Constants.outboxIDToKey(outboxID), preview.filename))
  outboxIDResp.response.result()

  const uploadStart = yield Saga.takeFromChannelMap(channelMap, 'chat.1.chatUi.chatAttachmentUploadStart')
  const messageID = uploadStart.params.placeholderMsgID
  uploadStart.response.result()

  const finishedTask = yield fork(function * () {
    const finished = yield Saga.takeFromChannelMap(channelMap, 'finished')
    if (finished.error) {
      yield put(Creators.updateMessage(conversationIDKey, {messageState: 'failed'}, messageID))
    }
    return finished
  })

  const progressTask = yield Saga.effectOnChannelMap(c => Saga.safeTakeEvery(c, function * ({response}) {
    const {bytesComplete, bytesTotal} = response.param
    yield put(Creators.uploadProgress(conversationIDKey, messageID, bytesComplete, bytesTotal))
    response.result()
  }), channelMap, 'chat.1.chatUi.chatAttachmentUploadProgress')

  const previewUploadStart = yield Saga.takeFromChannelMap(channelMap, 'chat.1.chatUi.chatAttachmentPreviewUploadStart')
  previewUploadStart.response.result()
  const previewUploadDone = yield Saga.takeFromChannelMap(channelMap, 'chat.1.chatUi.chatAttachmentPreviewUploadDone')
  previewUploadDone.response.result()
  const uploadDone = yield Saga.takeFromChannelMap(channelMap, 'chat.1.chatUi.chatAttachmentUploadDone')
  uploadDone.response.result()

  yield join(finishedTask)
  yield cancel(progressTask)
  Saga.closeChannelMap(channelMap)

  return messageID
}

function * onOpenAttachmentPopup (action: Constants.OpenAttachmentPopup): SagaGenerator<any, any> {
  const {message, currentPath} = action.payload
  const messageID = message.messageID
  if (!messageID) {
    throw new Error('Cannot open attachment popup for message missing ID')
  }

  yield put(putActionIfOnPath(currentPath, navigateAppend([{props: {messageID, conversationIDKey: message.conversationIDKey}, selected: 'attachment'}])))
  if (!message.hdPreviewPath && message.filename && message.messageID) {
    yield put(Creators.loadAttachment(message.conversationIDKey, messageID, tmpFile(Shared.tmpFileName(true, message.conversationIDKey, message.messageID, message.filename)), false, true))
  }
}

export {
  onLoadAttachment,
  onLoadAttachmentPreview,
  onOpenAttachmentPopup,
  onSaveAttachmentNative,
  onShareAttachment,
  onSelectAttachment,
}
