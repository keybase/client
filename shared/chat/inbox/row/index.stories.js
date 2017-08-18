// @flow
import React from 'react'
import * as I from 'immutable'
import {Box} from '../../../common-adapters'
import {storiesOf, action} from '../../../stories/storybook'
import {globalColors} from '../../../styles'
import SimpleRow from './simple-row'
import {TeamRow, ChannelRow} from './team-row'

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
  teamname: null,
  timestamp: '1:23 pm',
  unreadCount: 0,
  usernameColor: globalColors.darkBlue,
  youNeedToRekey: false,
}

const mocks = [
  {
    ...simpleCommon,
    conversationIDKey: '3',
    hasUnread: false,
    showBold: false,
    snippet: 'elisa: Hopefully not',
    teamname: 'fortgreenmoms',
    timestamp: 'Tue',
  },
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

const commonChannel = {
  onSelectConversation: action('onSelectConversation'),
}

const load = () => {
  storiesOf('Chat/Inbox', module)
    .add('Simple', () => (
      <Box style={{width: 240}}>
        {mocks.map(m => <SimpleRow key={m.conversationIDKey} {...m} />)}
      </Box>
    ))
    .add('Team', () => (
      <Box style={{borderColor: 'black', borderStyle: 'solid', borderWidth: 1, width: 240}}>
        <TeamRow teamname="Keybase" />
        <ChannelRow teamname="Keybase" channelname="#general" {...commonChannel} />
        <ChannelRow teamname="Keybase" channelname="#random" showBold={true} {...commonChannel} />
        <ChannelRow
          teamname="Keybase"
          channelname="#zzz"
          showBold={true}
          hasUnread={true}
          {...commonChannel}
        />
        <ChannelRow teamname="Keybase" channelname="#video-games" isMuted={true} {...commonChannel} />
        <TeamRow teamname="techtonica" />
        <ChannelRow teamname="techtonica" channelname="#general" isSelected={true} {...commonChannel} />
        <ChannelRow teamname="techtonica" channelname="#ignore-selected-below" {...commonChannel} />
        <ChannelRow
          teamname="techtonica"
          channelname="#random"
          isSelected={true}
          isMuted={true}
          {...commonChannel}
        />
        <ChannelRow
          teamname="techtonica"
          channelname="#happy-hour"
          isSelected={true}
          hasUnread={true}
          {...commonChannel}
        />
      </Box>
    ))
}

export default load
