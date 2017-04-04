// @flow
import * as ChatTypes from '../../constants/types/flow-types-chat'
import * as Constants from '../../constants/chat'
import * as Creators from './creators'
import * as RPCTypes from '../../constants/types/flow-types'
import * as Saga from '../../util/saga'
import * as Shared from './shared'
import {call, put, select, cancel, fork, join} from 'redux-saga/effects'
import {delay} from 'redux-saga'
import {isMobile} from '../../constants/platform'
import {putActionIfOnPath, navigateAppend} from '../route-tree'
import {saveAttachment, showShareActionSheet} from '../platform-specific'
import {tmpFile, downloadFilePath, copy, exists} from '../../util/file'
import {usernameSelector} from '../../constants/selectors'

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

// TODO load previews too
function * onLoadAttachment ({payload: {conversationIDKey, messageID, loadPreview, isHdPreview, filename}}: Constants.LoadAttachment): SagaGenerator<any, any> {
  // See if we already have this image cached
  if (loadPreview || isHdPreview) {
    const imageCached = yield call(exists, filename)
    if (imageCached) {
      yield put(Creators.attachmentLoaded(conversationIDKey, messageID, filename, loadPreview, isHdPreview))
      return
    }
  }

  // If we are loading the actual attachment,
  // let's see if we've already downloaded it as an hdPreview
  if (!loadPreview && !isHdPreview) {
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
}

const _temporaryAttachmentMessageForUpload = (convID: Constants.ConversationIDKey, username: string, title: string, filename: string, outboxID: Constants.OutboxIDKey, previewType: $PropertyType<Constants.AttachmentMessage, 'previewType'>, previewSize: $PropertyType<Constants.AttachmentMessage, 'previewSize'>): Constants.AttachmentMessage => ({
  type: 'Attachment',
  timestamp: Date.now(),
  conversationIDKey: convID,
  followState: 'You',
  author: username,
  attachmentDurationMs: null,
  previewDurationMs: null,
  senderDeviceRevokedAt: null,
  hdPreviewPath: null,
  // TODO we should be able to fill this in
  deviceName: '',
  deviceType: isMobile ? 'mobile' : 'desktop',
  filename,
  title,
  you: username,
  previewType,
  previewSize,
  previewPath: filename,
  downloadedPath: null,
  outboxID,
  progress: 0,
  messageState: 'uploading',
  key: Constants.messageKey('tempAttachment', outboxID),
})

function * onSelectAttachment ({payload: {input}}: Constants.SelectAttachment): Generator<any, any, any> {
  const {title, filename, type} = input
  let {conversationIDKey} = input

  if (Constants.isPendingConversationIDKey(conversationIDKey)) {
    // Get a real conversationIDKey
    conversationIDKey = yield call(Shared.startNewConversation, conversationIDKey)
    if (!conversationIDKey) {
      return
    }
  }

  const outboxID = `attachmentUpload-${Math.ceil(Math.random() * 1e9)}`
  const username = yield select(usernameSelector)

  yield put(Creators.appendMessages(conversationIDKey,
    false,
    [_temporaryAttachmentMessageForUpload(conversationIDKey, username, title, filename, outboxID, type)]))

  const header = yield call(Shared.clientHeader, ChatTypes.CommonMessageType.attachment, conversationIDKey)
  const param = {
    conversationID: Constants.keyToConversationID(conversationIDKey),
    clientHeader: header,
    attachment: {filename},
    title,
    metadata: null,
    identifyBehavior: yield call(Shared.getPostingIdentifyBehavior, conversationIDKey),
  }

  const channelConfig = Saga.singleFixedChannelConfig([
    'chat.1.chatUi.chatAttachmentUploadStart',
    'chat.1.chatUi.chatAttachmentPreviewUploadStart',
    'chat.1.chatUi.chatAttachmentUploadProgress',
    'chat.1.chatUi.chatAttachmentUploadDone',
    'chat.1.chatUi.chatAttachmentPreviewUploadDone',
    'finished',
  ])

  const channelMap = ((yield call(ChatTypes.localPostFileAttachmentLocalRpcChannelMap, channelConfig, {param})): any)

  const uploadStart = yield Saga.takeFromChannelMap(channelMap, 'chat.1.chatUi.chatAttachmentUploadStart')
  uploadStart.response.result()

  const finishedTask = yield fork(function * () {
    const finished = yield Saga.takeFromChannelMap(channelMap, 'finished')
    if (finished.error) {
      yield put(Creators.updateTempMessage(conversationIDKey, {messageState: 'failed'}, outboxID))
    }
    return finished
  })

  const progressTask = yield Saga.effectOnChannelMap(c => Saga.safeTakeEvery(c, function * ({response}) {
    const {bytesComplete, bytesTotal} = response.param
    yield put(Creators.uploadProgress(conversationIDKey, outboxID, bytesComplete, bytesTotal))
    response.result()
  }), channelMap, 'chat.1.chatUi.chatAttachmentUploadProgress')

  const previewTask = yield fork(function * () {
    const previewUploadStart = yield Saga.takeFromChannelMap(channelMap, 'chat.1.chatUi.chatAttachmentPreviewUploadStart')
    previewUploadStart.response.result()

    const metadata = previewUploadStart.params && previewUploadStart.params.metadata
    const previewSize = metadata && Constants.parseMetadataPreviewSize(metadata) || null

    yield put(Creators.appendMessages(conversationIDKey,
      false,
      [_temporaryAttachmentMessageForUpload(conversationIDKey, username, title, filename, outboxID, type, previewSize)]
    ))

    const previewUploadDone = yield Saga.takeFromChannelMap(channelMap, 'chat.1.chatUi.chatAttachmentPreviewUploadDone')
    previewUploadDone.response.result()
  })

  const uploadDone = yield Saga.takeFromChannelMap(channelMap, 'chat.1.chatUi.chatAttachmentUploadDone')
  uploadDone.response.result()

  const finished = yield join(finishedTask)
  yield cancel(progressTask)
  yield cancel(previewTask)
  Saga.closeChannelMap(channelMap)

  if (!finished.error) {
    const {params: {messageID}} = finished
    const existingMessage = yield select(Shared.messageSelector, conversationIDKey, messageID)
    // We already received a message for this attachment
    if (existingMessage) {
      yield put(Creators.deleteTempMessage(conversationIDKey, outboxID))
    } else {
      yield put(Creators.updateTempMessage(
        conversationIDKey,
        {type: 'Attachment', messageState: 'sent', messageID, key: Constants.messageKey('messageID', messageID)},
        outboxID,
      ))
    }

    yield put(Creators.markSeenMessage(conversationIDKey, messageID))
  }
}

function * onOpenAttachmentPopup (action: Constants.OpenAttachmentPopup): SagaGenerator<any, any> {
  const {message, currentPath} = action.payload
  const messageID = message.messageID
  if (!messageID) {
    throw new Error('Cannot open attachment popup for message missing ID')
  }

  yield put(putActionIfOnPath(currentPath, navigateAppend([{props: {messageID, conversationIDKey: message.conversationIDKey}, selected: 'attachment'}])))
  if (!message.hdPreviewPath && message.filename) {
    yield put(Creators.loadAttachment(message.conversationIDKey, messageID, tmpFile(Shared.tmpFileName(true, message.conversationIDKey, message.messageID, message.filename)), false, true))
  }
}

export {
  onLoadAttachment,
  onOpenAttachmentPopup,
  onSaveAttachmentNative,
  onShareAttachment,
  onSelectAttachment,
}
