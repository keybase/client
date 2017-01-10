// @flow
import AttachmentPopup from '../attachment-popup'
import HiddenString from '../../../util/hidden-string'
import React from 'react'
import Text from './text'
import {Box} from '../../../common-adapters'
import {Map} from 'immutable'
import {TextPopupMenu} from './popup'
import {messageStates, MetaDataRecord, clampAttachmentPreviewSize} from '../../../constants/chat'

import type {MessageState, TextMessage, AttachmentMessage} from '../../../constants/chat'
import type {DumbComponentMap} from '../../../constants/types/more'

let mockKey = 1
function messageMock (messageState: MessageState, author: string, you: string, text?: ?string, senderDeviceRevokedAt?: number) {
  return {
    author,
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

function textMessageMock (messageState: MessageState, author: string, you: string, text?: ?string, senderDeviceRevokedAt?: number): TextMessage {
  return {
    type: 'Text',
    ...messageMock(messageState, author, you, text, senderDeviceRevokedAt),
  }
}

function attachmentMessageMock (messageState: MessageState, author: string, you: string, text?: ?string, senderDeviceRevokedAt?: number): AttachmentMessage {
  return {
    type: 'Attachment',
    ...messageMock(messageState, author, you, text, senderDeviceRevokedAt),
    filename: 'yosemite.jpg',
    title: 'Yosemite!',
    previewType: 'Image',
    previewPath: require('../../../images/mock/yosemite-preview.jpg'),
    downloadedPath: require('../../../images/mock/yosemite.jpg'),
    previewSize: clampAttachmentPreviewSize({width: 375, height: 320}),
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

const followStates = ['You', 'Following', 'Broken', 'NotFollowing']
const followingMap = {
  other: true,
}
const metaDataMap = Map({
  cecileb: new MetaDataRecord({fullname: 'Cecile Bee', brokenTracker: false}),
})

const mocks = followStates.reduce((outerAcc, followState) => (
  {
    ...outerAcc,
    ...messageStates.reduce((acc, messageState) => {
      switch (followState) {
        case 'You':
          return {
            ...acc,
            [`${messageState} - ${followState}`]: {...baseMock, message: textMessageMock(messageState, 'cecileb', 'cecileb'), you: 'cecileb', followingMap: {}, metaDataMap},
          }
        case 'Following':
          return {
            ...acc,
            [`${messageState} - ${followState}`]: {...baseMock, message: textMessageMock(messageState, 'other', 'cecileb'), you: 'cecileb', followingMap, metaDataMap},
          }
        case 'Broken':
          return {
            ...acc,
            [`${messageState} - ${followState}`]: {
              ...baseMock,
              message: textMessageMock(messageState, 'other', 'cecileb'),
              you: 'cecileb',
              followingMap,
              metaDataMap: Map({other: new MetaDataRecord({fullname: 'other person', brokenTracker: true})}),
            },
          }
        case 'NotFollowing':
          return {
            ...acc,
            [`${messageState} - ${followState}`]: {...baseMock, message: textMessageMock(messageState, 'other', 'cecileb'), you: 'cecileb', followingMap: {}, metaDataMap},
          }
      }
    }, outerAcc),
  }
), {})

mocks['from revoked device'] = {...baseMock, message: textMessageMock('sent', 'cecileb', 'other', null, 123456), you: 'other', followingMap, metaDataMap}

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
      mock1: {...baseMock, message: textMessageMock('sent', 'cecileb', 'cecileb'), includeHeader: true, visiblePopupMenu: true, you: 'cecileb', followingMap, metaDataMap},
      mock2: {...baseMock, message: textMessageMock('sent', 'cecileb', 'cecileb'), includeHeader: false, you: 'cecileb', followingMap, metaDataMap},
    },
    'Stacked - one sent, one pending': {
      mock1: {...baseMock, message: textMessageMock('sent', 'cecileb', 'cecileb'), includeHeader: true, you: 'cecileb', followingMap, metaDataMap},
      mock2: {...baseMock, message: textMessageMock('pending', 'cecileb', 'cecileb'), includeHeader: false, you: 'cecileb', followingMap, metaDataMap},
    },
    'Stacked - one sent, one failed': {
      mock1: {...baseMock, message: textMessageMock('sent', 'cecileb', 'cecileb', 'Thanks!'), includeHeader: true, you: 'cecileb', followingMap, metaDataMap},
      mock2: {...baseMock, message: textMessageMock('failed', 'cecileb', 'cecileb', 'Sorry my network connection is super bad…'), includeHeader: false, you: 'cecileb', followingMap, metaDataMap},
    },
    'Stacked - someone else. two sent': {
      mock1: {...baseMock, message: textMessageMock('sent', 'cecileb', 'other'), includeHeader: true, you: 'other', followingMap: {cecileb: true}, metaDataMap},
      mock2: {...baseMock, message: textMessageMock('sent', 'cecileb', 'other'), includeHeader: false, you: 'other', followingMap: {cecileb: true}, metaDataMap},
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
    'Following - Valid': {...baseTextPopupMenuMock, message: textMessageMock('sent', 'ceceilb', 'other'), you: 'other', followingMap, metaDataMap},
    'Following - Revoked': {...baseTextPopupMenuMock, message: textMessageMock('sent', 'ceceilb', 'other', null, 123456), you: 'other', followingMap, metaDataMap},
    'You - Valid': {...baseTextPopupMenuMock, message: textMessageMock('sent', 'cecileb', 'cecileb'), you: 'cecileb', followingMap, metaDataMap},
    'You - Revoked': {...baseTextPopupMenuMock, message: textMessageMock('sent', 'ceceilb', 'ceceilb', null, 123456), you: 'cecileb', followingMap, metaDataMap},
  },
}

function baseAttachmentPopupMock (message) {
  return {
    message,
    you: message.you,
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
      ...baseAttachmentPopupMock(attachmentMessageMock('sent', 'cecileb')),
    },
    'You - Wide Image': {
      ...baseAttachmentPopupMock({
        ...attachmentMessageMock('sent', 'cecileb'),
        title: 'Pacific',
        downloadedPath: require('../../../images/mock/coast-wide.jpg'),
      }),
    },
    'You - Small Image': {
      ...baseAttachmentPopupMock({
        ...attachmentMessageMock('sent', 'cecileb'),
        title: 'Washington',
        downloadedPath: require('../../../images/mock/washington-small.jpg'),
      }),
    },
    'You - Zoomed': {
      ...baseAttachmentPopupMock(attachmentMessageMock('sent', 'cecileb')),
      isZoomed: true,
    },
    'You - Popup Showing': {
      ...baseAttachmentPopupMock(attachmentMessageMock('sent', 'cecileb')),
      detailsPopupShowing: true,
    },
    'Following - Popup Showing': {
      ...baseAttachmentPopupMock(attachmentMessageMock('sent', 'oconnor663')),
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
