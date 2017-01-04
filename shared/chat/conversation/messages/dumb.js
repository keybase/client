// @flow
import HiddenString from '../../../util/hidden-string'
import Popup from './popup'
import React from 'react'
import Text from './text'
import {Box} from '../../../common-adapters'
import {Map} from 'immutable'
import {messageStates} from '../../../constants/chat'

import type {MessageState, TextMessage} from '../../../constants/chat'
import type {DumbComponentMap} from '../../../constants/types/more'

let mockKey = 1
function messageMock (messageState: MessageState, you: string, text?: ?string, senderDeviceRevokedAt?: number): TextMessage {
  return {
    type: 'Text',
    author: 'cecileb',
    message: new HiddenString(text || 'hello world'),
    you,
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
      /* ? */ {...acc, [`${messageState} - ${followState}`]: {...baseMock, message: messageMock(messageState, you), you, followingMap, metaDataMap}}
        // : {...acc, [`sent - ${followState}`]: {...baseMock, message: messageMock(messageState, you)}}
    ), outerAcc),
  }
), {})

mocks['from revoked device'] = {...baseMock, message: messageMock('sent', '', null, 123456), you, followingMap, metaDataMap}

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
      mock1: {...baseMock, message: messageMock('sent', 'You'), includeHeader: true, visiblePopupMenu: true, you, followingMap, metaDataMap},
      mock2: {...baseMock, message: messageMock('sent', 'You'), includeHeader: false, you, followingMap, metaDataMap},
    },
    'Stacked - one sent, one pending': {
      mock1: {...baseMock, message: messageMock('sent', 'You'), includeHeader: true, you, followingMap, metaDataMap},
      mock2: {...baseMock, message: messageMock('pending', 'You'), includeHeader: false, you, followingMap, metaDataMap},
    },
    'Stacked - one sent, one failed': {
      mock1: {...baseMock, message: messageMock('sent', 'You', 'Thanks!'), includeHeader: true, you, followingMap, metaDataMap},
      mock2: {...baseMock, message: messageMock('failed', 'You', 'Sorry my network connection is super bad…'), includeHeader: false, you, followingMap, metaDataMap},
    },
    'Stacked - someone else. two sent': {
      mock1: {...baseMock, message: messageMock('sent', 'Following'), includeHeader: true, you, followingMap, metaDataMap},
      mock2: {...baseMock, message: messageMock('sent', 'Following'), includeHeader: false, you, followingMap, metaDataMap},
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
    'Following - Valid': {...basePopupMock, message: messageMock('sent', ''), you, followingMap, metaDataMap},
    'Following - Revoked': {...basePopupMock, message: messageMock('sent', '', null, 123456), you, followingMap, metaDataMap},
    'You - Valid': {...basePopupMock, message: messageMock('sent', ''), you, followingMap, metaDataMap},
    'You - Revoked': {...basePopupMock, message: messageMock('sent', '', null, 123456), you, followingMap, metaDataMap},
  },
}

export default {
  'Text Message': textMap,
  'Stacked Text Message': stackedMessagesMap,
  'Popup': popupMap,
}
