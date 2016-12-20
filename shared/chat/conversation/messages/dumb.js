// @flow

import React from 'react'
import Text from './text'
import Popup from './popup'
import AttachmentMessage from './attachment'
import {Box} from '../../../common-adapters'
import HiddenString from '../../../util/hidden-string'
import {messageStates, followStates} from '../../../constants/chat'

import type {FollowState, MessageState, TextMessage} from '../../../constants/chat'
import type {DumbComponentMap} from '../../../constants/types/more'

let mockKey = 1
function messageMock (messageState: MessageState, followState: FollowState, text?: ?string, senderDeviceRevokedAt?: number): TextMessage {
  return {
    type: 'Text',
    author: 'cecileb',
    message: new HiddenString(text || 'hello world'),
    followState,
    messageState,
    deviceName: 'Macbook',
    deviceType: 'desktop',
    timestamp: 1479764890000,
    conversationIDKey: 'cid1',
    key: mockKey++,
    senderDeviceRevokedAt,
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

const mocks = followStates.reduce((outerAcc, followState) => (
  {
    ...outerAcc,
    ...messageStates.reduce((acc, messageState) => (
      (followState === 'You')
        ? {...acc, [`${messageState} - ${followState}`]: {...baseMock, message: messageMock(messageState, followState)}}
        : {...acc, [`sent - ${followState}`]: {...baseMock, message: messageMock(messageState, followState)}}
    ), outerAcc),
  }
), {})

mocks['from revoked device'] = {...baseMock, message: messageMock('sent', 'Following', null, 123456)}

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

const attachmentBaseMessage = {
  type: 'Attachment',
  timestamp: 1479764890000,
  conversationIDKey: 'cid1',
  followState: 'You',
  author: 'marcopolo',
  deviceName: 'MKB',
  deviceType: 'desktop',
  messageID: 0,
  filename: '/tmp/Yosemite.jpg',
  title: 'Half Dome, Merced River, Winter',
  previewType: 'Image',
  previewPath: null,
  downloadedPath: null,
  messageState: 'sent',
  key: 'foo',
}

const attachmentMessageWithImg = {
  type: 'Attachment',
  timestamp: 1479764890000,
  conversationIDKey: 'cid1',
  followState: 'You',
  author: 'marcopolo',
  deviceName: 'MKB',
  deviceType: 'desktop',
  messageID: 0,
  filename: '/tmp/Yosemite.jpg',
  title: 'Half Dome, Merced River, Winter',
  previewType: 'Image',
  // $FlowIssue
  previewPath: require('file-loader!../../../images/yosemite preview.jpg'), // eslint-disable-line
  // $FlowIssue
  downloadedPath: require('file-loader!../../../images/yosemite.jpg'), // eslint-disable-line
  messageState: 'sent',
  key: 'foo',
}

const attachmentMessageGeneric = {
  type: 'Attachment',
  timestamp: 1479764890000,
  conversationIDKey: 'cid1',
  followState: 'You',
  author: 'marcopolo',
  deviceName: 'MKB',
  deviceType: 'desktop',
  messageID: 0,
  filename: '/tmp/The Nose - Topo.pdf',
  title: 'seattle-map.pdf',
  previewType: 'Other',
  downloadedPath: '/tmp/somewhere', // eslint-disable-line
  previewPath: null,
  messageState: 'sent',
  key: 'foo',
}

const attachmentBaseMock = {
  message: attachmentBaseMessage,
  includeHeader: true,
  isFirstNewMessage: false,
  onLoadAttachment: () => console.log('onLoadAttachment'),
  onAction: () => console.log('onAction'),
  onRetry: () => console.log('onRetry'),
  onOpenInFileUI: () => console.log('on open in file ui'),
  style: {},
}

const attachmentMap: DumbComponentMap<AttachmentMessage> = {
  component: AttachmentMessage,
  mocks: {
    'Basic - Not loaded': attachmentBaseMock,
    'Basic - Preview Image. Failed': {
      ...attachmentBaseMock,
      message: {...attachmentMessageWithImg, downloadedPath: null, messageState: 'failed'},
    },
    'Basic - Preview Image. Pending': {
      ...attachmentBaseMock,
      message: {...attachmentMessageWithImg, downloadedPath: null, messageState: 'pending'},
    },
    'Basic - Preview Image. Not Downloaded': {
      ...attachmentBaseMock,
      message: {...attachmentMessageWithImg, downloadedPath: null},
    },
    'Basic - Uploading': {
      ...attachmentBaseMock,
      message: {
        ...attachmentMessageWithImg,
        messageState: 'uploading',
        downloadedPath: null,
        progress: 0.3,
      },
    },
    'Basic - Downloading': {
      ...attachmentBaseMock,
      message: {
        ...attachmentMessageWithImg,
        messageState: 'downloading',
        downloadedPath: null,
        progress: 0.3,
      },
    },
    'Basic - Preview Image. Downloaded': {
      ...attachmentBaseMock,
      message: {
        ...attachmentMessageWithImg,
        messageState: 'downloaded',
      },
    },
    'Basic - Generic File. Uploading': {
      ...attachmentBaseMock,
      message: {
        ...attachmentMessageGeneric,
        downloadedPath: null,
        messageState: 'uploading',
        progress: 0.3,
      },
    },
    'Basic - Generic File. Failed': {
      ...attachmentBaseMock,
      message: {
        ...attachmentMessageGeneric,
        messageState: 'failed',
        downloadedPath: null,
      },
    },
    'Basic - Generic File. sent': {
      ...attachmentBaseMock,
      message: {
        ...attachmentMessageGeneric,
        messageState: 'sent',
      },
    },
    'Basic - Generic File. Downloading': {
      ...attachmentBaseMock,
      message: {
        ...attachmentMessageGeneric,
        messageState: 'downloading',
        downloadedPath: null,
        progress: 0.3,
      },
    },
    'Basic - Generic File. Downloaded': {
      ...attachmentBaseMock,
      message: {
        ...attachmentMessageGeneric,
        messageState: 'downloaded',
      },
    },
  },
}

const stackedMessagesMap = {
  component: StackedMessages,
  mocks: {
    'Stacked - two messages': {
      mock1: {...baseMock, message: messageMock('sent', 'You'), includeHeader: true, visiblePopupMenu: true},
      mock2: {...baseMock, message: messageMock('sent', 'You'), includeHeader: false},
    },
    'Stacked - one sent, one pending': {
      mock1: {...baseMock, message: messageMock('sent', 'You'), includeHeader: true},
      mock2: {...baseMock, message: messageMock('pending', 'You'), includeHeader: false},
    },
    'Stacked - one sent, one failed': {
      mock1: {...baseMock, message: messageMock('sent', 'You', 'Thanks!'), includeHeader: true},
      mock2: {...baseMock, message: messageMock('failed', 'You', 'Sorry my network connection is super bad…'), includeHeader: false},
    },
    'Stacked - someone else. two sent': {
      mock1: {...baseMock, message: messageMock('sent', 'Following'), includeHeader: true},
      mock2: {...baseMock, message: messageMock('sent', 'Following'), includeHeader: false},
    },
  },
}

const basePopupMock = {
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

const popupMap: DumbComponentMap<Popup> = {
  component: Popup,
  mocks: {
    'Following - Valid': {...basePopupMock, message: messageMock('sent', 'Following')},
    'Following - Revoked': {...basePopupMock, message: messageMock('sent', 'Following', null, 123456)},
    'You - Valid': {...basePopupMock, message: messageMock('sent', 'You')},
    'You - Revoked': {...basePopupMock, message: messageMock('sent', 'You', null, 123456)},
  },
}

export default {
  'Text Message': textMap,
  'Stacked Text Message': stackedMessagesMap,
  'Popup': popupMap,
  'Attachment Message': attachmentMap,
}
