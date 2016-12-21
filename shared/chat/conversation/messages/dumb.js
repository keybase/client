// @flow

import React from 'react'
import Text from './text'
import Popup from './popup'
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
}
