// @flow

import React from 'react'
import Text from './text'
import {Box} from '../../../common-adapters'
import HiddenString from '../../../util/hidden-string'
import {messageStates, followStates} from '../../../constants/chat'

import type {FollowState, MessageState, TextMessage} from '../../../constants/chat'
import type {DumbComponentMap} from '../../../constants/types/more'

function messageMock (messageState: MessageState, followState: FollowState, text?: string): TextMessage {
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
  }
}

const baseMock = {
  includeHeader: true,
  onRetry: () => console.log('onRetry'),
  visiblePopupMenu: false,
  onTogglePopupMenu: () => console.log('onTogglePopupMenu'),
  onEdit: () => console.log('onEdit'),
  onDelete: () => console.log('onDelete'),
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

export default {
  'Text Message': textMap,
  'Stacked Text Message': stackedMessagesMap,
}
