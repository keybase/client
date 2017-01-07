// @flow
import AttachmentPopup from '../attachment-popup'
import HiddenString from '../../../util/hidden-string'
import React from 'react'
import Text from './text'
import {Box} from '../../../common-adapters'
import {Map} from 'immutable'
import {TextPopupMenu} from './popup'
import {messageStates} from '../../../constants/chat'

import type {MessageState, TextMessage, AttachmentMessage} from '../../../constants/chat'
import type {DumbComponentMap} from '../../../constants/types/more'

let mockKey = 1
function messageMock (messageState: MessageState, you: string, text?: ?string, senderDeviceRevokedAt?: number) {
  return {
    author: 'cecileb',
    message: new HiddenString(text || 'hello world'),
    you,
    messageState,
    deviceName: 'Macbook',
    deviceType: 'desktop',
    timestamp: 1479764890000,
    conversationIDKey: 'cid1',
    messageID: 1,
    key: mockKey++,
    senderDeviceRevokedAt,
  }
}

function textMessageMock (messageState: MessageState, you: string, text?: ?string, senderDeviceRevokedAt?: number): TextMessage {
  return {
    type: 'Text',
    ...messageMock(messageState, you, text, senderDeviceRevokedAt),
  }
}

function attachmentMessageMock (messageState: MessageState, you: string, text?: ?string, senderDeviceRevokedAt?: number): AttachmentMessage {
  return {
    type: 'Attachment',
    ...messageMock(messageState, you, text, senderDeviceRevokedAt),
    filename: 'yosemite.jpg',
    title: 'Yosemite!',
    previewType: 'Image',
    previewPath: require('../../../images/mock/yosemite-preview.jpg'),
    downloadedPath: require('../../../images/mock/yosemite.jpg'),
  }
}

const baseMock = {
  includeHeader: true,
  onRetry: () => console.log('onRetry'),
  visiblePopupMenu: false,
  onTogglePopupMenu: () => console.log('onTogglePopupMenu'),
  onEdit: () => console.log('onEdit'),
  onDelete: () => console.log('onDelete'),
  onAction: () => console.log('onAction'),
  isFirstNewMessage: false,
  isSelected: false,
  style: {},
}

const followStates = [] // TEMP generate this
const you = '' // TEMP
const followState = '' // TEMP
const followingMap = {} // TEMP
const metaDataMap = Map({}) // TEMP
const mocks = followStates.reduce((outerAcc) => (
  {
    ...outerAcc,
    ...messageStates.reduce((acc, messageState) => (
      // (followState === 'You')
      /* ? */ {...acc, [`${messageState} - ${followState}`]: {...baseMock, message: textMessageMock(messageState, you), you, followingMap, metaDataMap}}
        // : {...acc, [`sent - ${followState}`]: {...baseMock, message: messageMock(messageState, you)}}
    ), outerAcc),
  }
), {})

mocks['from revoked device'] = {...baseMock, message: textMessageMock('sent', '', null, 123456), you, followingMap, metaDataMap}

const StackedMessages = ({mock1, mock2}: any) => (
  <Box>
    <Text {...mock1} />
    <Text {...mock2} />
  </Box>
)

const textMap: DumbComponentMap<Text> = {
  component: Text,
  mocks,
}

const stackedMessagesMap = {
  component: StackedMessages,
  mocks: {
    'Stacked - two messages': {
      mock1: {...baseMock, message: textMessageMock('sent', 'You'), includeHeader: true, visiblePopupMenu: true, you, followingMap, metaDataMap},
      mock2: {...baseMock, message: textMessageMock('sent', 'You'), includeHeader: false, you, followingMap, metaDataMap},
    },
    'Stacked - one sent, one pending': {
      mock1: {...baseMock, message: textMessageMock('sent', 'You'), includeHeader: true, you, followingMap, metaDataMap},
      mock2: {...baseMock, message: textMessageMock('pending', 'You'), includeHeader: false, you, followingMap, metaDataMap},
    },
    'Stacked - one sent, one failed': {
      mock1: {...baseMock, message: textMessageMock('sent', 'You', 'Thanks!'), includeHeader: true, you, followingMap, metaDataMap},
      mock2: {...baseMock, message: textMessageMock('failed', 'You', 'Sorry my network connection is super bad…'), includeHeader: false, you, followingMap, metaDataMap},
    },
    'Stacked - someone else. two sent': {
      mock1: {...baseMock, message: textMessageMock('sent', 'Following'), includeHeader: true, you, followingMap, metaDataMap},
      mock2: {...baseMock, message: textMessageMock('sent', 'Following'), includeHeader: false, you, followingMap, metaDataMap},
    },
  },
}

const baseTextPopupMenuMock = {
  onEditMessage: () => console.log('onEditMessage'),
  onDeleteMessage: () => console.log('onDeleteMessage'),
  onHidden: () => console.log('onHidden'),
  parentProps: {
    style: {
      position: 'relative',
      margin: 20,
      height: 300,
      width: 196,
    },
  },
}

const textPopupMenuMap: DumbComponentMap<TextPopupMenu> = {
  component: TextPopupMenu,
  mocks: {
    'Following - Valid': {...baseTextPopupMenuMock, message: textMessageMock('sent', ''), you, followingMap, metaDataMap},
    'Following - Revoked': {...baseTextPopupMenuMock, message: textMessageMock('sent', '', null, 123456), you, followingMap, metaDataMap},
    'You - Valid': {...baseTextPopupMenuMock, message: textMessageMock('sent', ''), you, followingMap, metaDataMap},
    'You - Revoked': {...baseTextPopupMenuMock, message: textMessageMock('sent', '', null, 123456), you, followingMap, metaDataMap},
  },
}

function baseAttachmentPopupMock (message) {
  return {
    message,
    you,
    detailsPopupShowing: false,
    isZoomed: false,
    onCloseDetailsPopup: () => console.log('onCloseDetailsPopup'),
    onClose: () => console.log('onClose'),
    onDownload: () => console.log('onDownload'),
    onDeleteMessage: () => console.log('onDeleteMessage'),
    onOpenDetailsPopup: () => console.log('onOpenDetailsPopup'),
    onToggleZoom: () => console.log('onToggleZoom'),
    parentProps: {
      style: {
        position: 'relative',
        height: 578,
        width: 800,
      },
    },
  }
}

const attachmentPopupMap: DumbComponentMap<AttachmentPopup> = {
  component: AttachmentPopup,
  mocks: {
    'You': {
      ...baseAttachmentPopupMock(attachmentMessageMock('sent', 'You')),
    },
    'You - Wide Image': {
      ...baseAttachmentPopupMock({
        ...attachmentMessageMock('sent', 'You'),
        title: 'Pacific',
        downloadedPath: require('../../../images/mock/coast-wide.jpg'),
      }),
    },
    'You - Small Image': {
      ...baseAttachmentPopupMock({
        ...attachmentMessageMock('sent', 'You'),
        title: 'Washington',
        downloadedPath: require('../../../images/mock/washington-small.jpg'),
      }),
    },
    'You - Zoomed': {
      ...baseAttachmentPopupMock(attachmentMessageMock('sent', 'You')),
      isZoomed: true,
    },
    'You - Popup Showing': {
      ...baseAttachmentPopupMock(attachmentMessageMock('sent', 'You')),
      detailsPopupShowing: true,
    },
    'Following - Popup Showing': {
      ...baseAttachmentPopupMock(attachmentMessageMock('sent', 'Following')),
      detailsPopupShowing: true,
    },
  },
}

export default {
  'Text Message': textMap,
  'Stacked Text Message': stackedMessagesMap,
  'Popup': textPopupMenuMap,
  'Attachment Popup': attachmentPopupMap,
}
