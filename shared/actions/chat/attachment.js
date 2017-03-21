// @flow
import * as ChatTypes from '../../constants/types/flow-types-chat'
import * as Constants from '../../constants/chat'
import * as RPCTypes from '../../constants/types/flow-types'
import {call, put, select, cancel, fork, join} from 'redux-saga/effects'
import {delay} from 'redux-saga'
import {isMobile} from '../../constants/platform'
import {loadAttachment as loadAttachmentAction, updateTempMessage} from './creators'
import {navigateAppend} from '../route-tree'
import {safeTakeEvery, singleFixedChannelConfig, closeChannelMap, takeFromChannelMap, effectOnChannelMap} from '../../util/saga'
import {saveAttachment, showShareActionSheet} from '../platform.specific'
import {tmpFile, downloadFilePath, copy, exists} from '../../util/file'
import {tmpFileName, messageSelector, startNewConversation, appendMessageActionTransformer, getPostingIdentifyBehavior, clientHeader} from './shared'
import {usernameSelector} from '../../constants/selectors'

import type {SagaGenerator} from '../../constants/types/saga'

function * onShareAttachment ({payload: {message}}: Constants.ShareAttachment): SagaGenerator<any, any> {
  const {filename, messageID, conversationIDKey} = message
  if (!filename || !messageID) {
    return
  }

  const path = downloadFilePath(filename)
  yield call(onLoadAttachment, ({
    type: 'chat:loadAttachment',
    payload: {
      conversationIDKey,
      messageID,
      loadPreview: false,
      isHdPreview: false,
      filename: path,
    },
  }: Constants.LoadAttachment))
  yield call(showShareActionSheet, {url: path})
}

function * onSaveAttachmentNative ({payload: {message}}: Constants.SaveAttachment): SagaGenerator<any, any> {
  const {filename, messageID, conversationIDKey} = message
  if (!filename || !messageID) {
    return
  }

  const path = downloadFilePath(filename)
  yield call(onLoadAttachment, ({
    type: 'chat:loadAttachment',
    payload: {
      conversationIDKey,
      messageID,
      loadPreview: false,
      isHdPreview: false,
      filename: path,
    },
  }: Constants.LoadAttachment))
  yield call(saveAttachment, path)
}

// Instead of redownloading the full attachment again, we may have it cached from an earlier hdPreview
// returns cached filepath
function * _isCached (conversationIDKey, messageID): Generator<any, ?string, any> {
  try {
    const message = yield select(messageSelector, conversationIDKey, messageID)
    if (message.hdPreviewPath) {
      return message.hdPreviewPath
    }
  } catch (e) {
    console.warn('error in checking cached file', e)
    return
  }
}

// TODO load previews too
function * onLoadAttachment ({payload: {conversationIDKey, messageID, loadPreview, isHdPreview, filename}}: Constants.LoadAttachment): SagaGenerator<any, any> {
  // See if we already have this image cached
  if (loadPreview || isHdPreview) {
    const imageCached = yield call(exists, filename)
    if (imageCached) {
      const action: Constants.AttachmentLoaded = {
        type: 'chat:attachmentLoaded',
        payload: {conversationIDKey, messageID, path: filename, isPreview: loadPreview, isHdPreview: isHdPreview},
      }
      yield put(action)
      return
    }
  }

  // If we are loading the actual attachment,
  // let's see if we've already downloaded it as an hdPreview
  if (!loadPreview && !isHdPreview) {
    const cachedPath = yield call(_isCached, conversationIDKey, messageID)

    if (cachedPath) {
      copy(cachedPath, filename)

      // for visual feedback, we'll briefly display a progress bar
      for (let i = 0; i < 5; i++) {
        const fakeProgressAction: Constants.DownloadProgress = {
          type: 'chat:downloadProgress',
          payload: {conversationIDKey, messageID, isPreview: false, bytesComplete: i + 1, bytesTotal: 5},
        }
        yield put(fakeProgressAction)
        yield delay(5)
      }

      const action: Constants.AttachmentLoaded = {
        type: 'chat:attachmentLoaded',
        payload: {conversationIDKey, messageID, path: filename, isPreview: loadPreview, isHdPreview: isHdPreview},
      }
      yield put(action)
      return
    }
  }

  const param = {
    conversationID: Constants.keyToConversationID(conversationIDKey),
    messageID,
    filename,
    preview: loadPreview,
    identifyBehavior: RPCTypes.TlfKeysTLFIdentifyBehavior.chatGui,
  }

  const channelConfig = singleFixedChannelConfig([
    'chat.1.chatUi.chatAttachmentDownloadStart',
    'chat.1.chatUi.chatAttachmentDownloadProgress',
    'chat.1.chatUi.chatAttachmentDownloadDone',
  ])

  const channelMap = ((yield call(ChatTypes.localDownloadFileAttachmentLocalRpcChannelMap, channelConfig, {param})): any)

  const progressTask = yield effectOnChannelMap(c => safeTakeEvery(c, function * ({response}) {
    const {bytesComplete, bytesTotal} = response.param
    const action: Constants.DownloadProgress = {
      type: 'chat:downloadProgress',
      payload: {conversationIDKey, messageID, isPreview: loadPreview || isHdPreview, bytesTotal, bytesComplete},
    }
    yield put(action)
    response.result()
  }), channelMap, 'chat.1.chatUi.chatAttachmentDownloadProgress')

  {
    const {response} = yield takeFromChannelMap(channelMap, 'chat.1.chatUi.chatAttachmentDownloadStart')
    response.result()
  }

  {
    const {response} = yield takeFromChannelMap(channelMap, 'chat.1.chatUi.chatAttachmentDownloadDone')
    response.result()
  }

  yield cancel(progressTask)
  closeChannelMap(channelMap)

  const action: Constants.AttachmentLoaded = {
    type: 'chat:attachmentLoaded',
    payload: {conversationIDKey, messageID, path: filename, isPreview: loadPreview, isHdPreview: isHdPreview},
  }
  yield put(action)
}

const _temporaryAttachmentMessageForUpload = (convID: Constants.ConversationIDKey, username: string, title: string, filename: string, outboxID: Constants.OutboxIDKey, previewType: $PropertyType<Constants.AttachmentMessage, 'previewType'>, previewSize: $PropertyType<Constants.AttachmentMessage, 'previewSize'>) => ({
  type: 'Attachment',
  timestamp: Date.now(),
  conversationIDKey: convID,
  followState: 'You',
  author: username,
  // TODO we should be able to fill this in
  deviceName: '',
  deviceType: isMobile ? 'mobile' : 'desktop',
  filename,
  title,
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
    conversationIDKey = yield call(startNewConversation, conversationIDKey)
    if (!conversationIDKey) {
      return
    }
  }

  const outboxID = `attachmentUpload-${Math.ceil(Math.random() * 1e9)}`
  const username = yield select(usernameSelector)

  yield put({
    logTransformer: appendMessageActionTransformer,
    payload: {
      conversationIDKey,
      messages: [_temporaryAttachmentMessageForUpload(
        conversationIDKey,
        username,
        title,
        filename,
        outboxID,
        type,
      )],
    },
    type: 'chat:appendMessages',
  })

  const header = yield call(clientHeader, ChatTypes.CommonMessageType.attachment, conversationIDKey)
  const attachment = {
    filename,
  }
  const param = {
    conversationID: Constants.keyToConversationID(conversationIDKey),
    clientHeader: header,
    attachment,
    title,
    metadata: null,
    identifyBehavior: yield call(getPostingIdentifyBehavior, conversationIDKey),
  }

  const channelConfig = singleFixedChannelConfig([
    'chat.1.chatUi.chatAttachmentUploadStart',
    'chat.1.chatUi.chatAttachmentPreviewUploadStart',
    'chat.1.chatUi.chatAttachmentUploadProgress',
    'chat.1.chatUi.chatAttachmentUploadDone',
    'chat.1.chatUi.chatAttachmentPreviewUploadDone',
    'finished',
  ])

  const channelMap = ((yield call(ChatTypes.localPostFileAttachmentLocalRpcChannelMap, channelConfig, {param})): any)

  const uploadStart = yield takeFromChannelMap(channelMap, 'chat.1.chatUi.chatAttachmentUploadStart')
  uploadStart.response.result()

  const finishedTask = yield fork(function * () {
    const finished = yield takeFromChannelMap(channelMap, 'finished')
    if (finished.error) {
      yield put(updateTempMessage(
        conversationIDKey,
        {messageState: 'failed'},
        outboxID
      ))
    }
    return finished
  })

  const progressTask = yield effectOnChannelMap(c => safeTakeEvery(c, function * ({response}) {
    const {bytesComplete, bytesTotal} = response.param
    const action: Constants.UploadProgress = {
      type: 'chat:uploadProgress',
      payload: {bytesTotal, bytesComplete, conversationIDKey, outboxID},
    }
    yield put(action)
    response.result()
  }), channelMap, 'chat.1.chatUi.chatAttachmentUploadProgress')

  const previewTask = yield fork(function * () {
    const previewUploadStart = yield takeFromChannelMap(channelMap, 'chat.1.chatUi.chatAttachmentPreviewUploadStart')
    previewUploadStart.response.result()

    const metadata = previewUploadStart.params && previewUploadStart.params.metadata
    const previewSize = metadata && Constants.parseMetadataPreviewSize(metadata) || null

    yield put({
      logTransformer: appendMessageActionTransformer,
      payload: {
        conversationIDKey,
        messages: [_temporaryAttachmentMessageForUpload(
          conversationIDKey,
          username,
          title,
          filename,
          outboxID,
          type,
          previewSize,
        )],
      },
      type: 'chat:appendMessages',
    })

    const previewUploadDone = yield takeFromChannelMap(channelMap, 'chat.1.chatUi.chatAttachmentPreviewUploadDone')
    previewUploadDone.response.result()
  })

  const uploadDone = yield takeFromChannelMap(channelMap, 'chat.1.chatUi.chatAttachmentUploadDone')
  uploadDone.response.result()

  const finished = yield join(finishedTask)
  yield cancel(progressTask)
  yield cancel(previewTask)
  closeChannelMap(channelMap)

  if (!finished.error) {
    const {params: {messageID}} = finished
    const existingMessage = yield select(messageSelector, conversationIDKey, messageID)
    // We already received a message for this attachment
    if (existingMessage) {
      yield put(({
        type: 'chat:deleteTempMessage',
        payload: {
          conversationIDKey,
          outboxID,
        },
      }: Constants.DeleteTempMessage))
    } else {
      yield put(updateTempMessage(
        conversationIDKey,
        {type: 'Attachment', messageState: 'sent', messageID, key: Constants.messageKey('messageID', messageID)},
        outboxID,
      ))
    }

    yield put(({
      type: 'chat:markSeenMessage',
      payload: {
        conversationIDKey,
        messageID: messageID,
      },
    }: Constants.MarkSeenMessage))
  }
}

function * onOpenAttachmentPopup (action: Constants.OpenAttachmentPopup): SagaGenerator<any, any> {
  const {message} = action.payload
  const messageID = message.messageID
  if (!messageID) {
    throw new Error('Cannot open attachment popup for message missing ID')
  }

  yield put(navigateAppend([{props: {messageID, conversationIDKey: message.conversationIDKey}, selected: 'attachment'}]))
  if (!message.hdPreviewPath && message.filename) {
    yield put(loadAttachmentAction(message.conversationIDKey, messageID, false, true, tmpFile(tmpFileName(true, message.conversationIDKey, message.messageID, message.filename))))
  }
}

export {
  onLoadAttachment,
  onOpenAttachmentPopup,
  onSaveAttachmentNative,
  onShareAttachment,
  onSelectAttachment,
}
