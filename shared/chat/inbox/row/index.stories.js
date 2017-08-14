// @flow
import React from 'react'
import * as I from 'immutable'
import {Box} from '../../../common-adapters'
import {storiesOf, action} from '../../../stories/storybook'
import {globalColors} from '../../../styles'
import SimpleRow from './simple-row'

const simpleCommon = {
  backgroundColor: globalColors.white,
  conversationIDKey: '',
  hasUnread: false,
  isMuted: false,
  isSelected: false,
  onSelectConversation: action('onSelectConversation'),
  participantNeedToRekey: false,
  participants: I.List(['chris']),
  rekeyInfo: null,
  showBold: false,
  snippet: 'snippet',
  subColor: globalColors.black_40,
  timestamp: '1:23 pm',
  unreadCount: 0,
  usernameColor: globalColors.darkBlue,
  youNeedToRekey: false,
}

const mocks = [
  {
    ...simpleCommon,
    conversationIDKey: '1',
    hasUnread: true,
    showBold: true,
    snippet: 'in the top-drawer i believe',
    subColor: globalColors.black_75,
    usernameColor: globalColors.black_75,
  },
  {
    ...simpleCommon,
    conversationIDKey: '2',
    hasUnread: false,
    participants: I.List(['jzila']),
    showBold: false,
    snippet: 'I don\t know that I would want.',
    timestamp: '5:12 pm',
  },
]

const load = () => {
  storiesOf('Chat/Inbox', module).add('Normal', () => (
    <Box style={{width: 240}}>
      {mocks.map(m => <SimpleRow key={m.conversationIDKey} {...m} />)}
    </Box>
  ))
}

export default load
