// @flow

import React from 'react'
import Text from './text'
import {Box} from '../../../common-adapters'
import {messageStates, followStates} from '../../../constants/chat'

import type {DumbComponentMap} from '../../../constants/types/more'

const baseMock = {
  author: 'cecileb',
  message: 'hello world',
  followState: 'Following',
  includeHeader: true,
  onRetry: () => console.log('onRetry'),
}

const mocks = followStates.reduce((outerAcc, followState) => (
  {
    ...outerAcc,
    ...messageStates.reduce((acc, messageState) => (
      (followState === 'You')
        ? {...acc, [`${messageState} - ${followState}`]: {...baseMock, messageState, followState}}
        : {...acc, [`Ok - ${followState}`]: {...baseMock, messageState, followState}}
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
      mock1: {...baseMock, followState: 'You', messageState: 'Ok', includeHeader: true},
      mock2: {...baseMock, followState: 'You', messageState: 'Ok', includeHeader: false},
    },
    'Stacked - one ok, one sending': {
      mock1: {...baseMock, followState: 'You', messageState: 'Ok', includeHeader: true},
      mock2: {...baseMock, followState: 'You', messageState: 'Sending', includeHeader: false},
    },
    'Stacked - one ok, one failed': {
      mock1: {...baseMock, followState: 'You', messageState: 'Ok', includeHeader: true, message: 'Thanks!'},
      mock2: {...baseMock, followState: 'You', messageState: 'Failed', includeHeader: false, message: 'Sorry my network connection is super bad…'},
    },
    'Stacked - someone else. two ok': {
      mock1: {...baseMock, followState: 'Following', messageState: 'Ok', includeHeader: true},
      mock2: {...baseMock, followState: 'Following', messageState: 'Ok', includeHeader: false},
    },
  }

  ,
}

export default {
  'Text Message': textMap,
  'Stacked Text Message': stackedMessagesMap,
}
