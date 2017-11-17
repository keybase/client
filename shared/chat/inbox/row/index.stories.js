// @flow
import React from 'react'
import * as I from 'immutable'
import {Box} from '../../../common-adapters'
import {storiesOf, action} from '../../../stories/storybook'
import {globalColors} from '../../../styles'
import {SmallTeam} from './small-team'
import {FilterSmallTeam} from './filter-small-team'
import {BigTeamHeader} from './big-team-header'
import {BigTeamChannel} from './big-team-channel'
import {FilterBigTeamChannel} from './filter-big-team-channel'

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
    hasBadge: false,
    showBold: false,
    snippet: 'elisa: Hopefully not',
    teamname: 'fortgreenmoms',
    timestamp: 'Tue',
  },
  {
    ...simpleCommon,
    conversationIDKey: '1',
    hasUnread: true,
    hasBadge: true,
    showBold: true,
    snippet: 'in the top-drawer i believe',
    subColor: globalColors.black_75,
    usernameColor: globalColors.black_75,
  },
  {
    ...simpleCommon,
    conversationIDKey: '2',
    hasUnread: false,
    hasBadge: false,
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
        {mocks.map(m => <SmallTeam key={m.conversationIDKey} {...m} />)}
      </Box>
    ))
    .add('Team', () => (
      <Box style={{borderColor: 'black', borderStyle: 'solid', borderWidth: 1, width: 240}}>
        <BigTeamHeader teamname="Keybase" onShowMenu={action('onShowHeader')} />
        <BigTeamChannel teamname="Keybase" channelname="#general" {...commonChannel} />
        <BigTeamChannel teamname="Keybase" channelname="#random" showBold={true} {...commonChannel} />
        <BigTeamChannel
          teamname="Keybase"
          channelname="#zzz"
          showBold={true}
          hasUnread={true}
          {...commonChannel}
        />
        <BigTeamChannel teamname="Keybase" channelname="#video-games" isMuted={true} {...commonChannel} />
        <BigTeamHeader teamname="techtonica" onShowMenu={action('onShowHeader')} />
        <BigTeamChannel teamname="techtonica" channelname="#general" isSelected={true} {...commonChannel} />
        <BigTeamChannel teamname="techtonica" channelname="#ignore-selected-below" {...commonChannel} />
        <BigTeamChannel
          teamname="techtonica"
          channelname="#random"
          isSelected={true}
          isMuted={true}
          {...commonChannel}
        />
        <BigTeamChannel
          teamname="techtonica"
          channelname="#happy-hour"
          isSelected={true}
          hasUnread={true}
          {...commonChannel}
        />
      </Box>
    ))
    .add('Filtered', () => (
      <Box style={{borderColor: 'black', borderStyle: 'solid', borderWidth: 1, width: 240}}>
        <FilterSmallTeam {...commonFiltered} />
        <FilterSmallTeam {...commonFiltered} participants={I.List.of('chris')} />
        <FilterSmallTeam {...commonFiltered} teamname="pokerpals" />
        <FilterBigTeamChannel {...commonBigFiltered} channelname="general" />
        <FilterBigTeamChannel {...commonBigFiltered} channelname="random" />
        <FilterBigTeamChannel
          {...commonBigFiltered}
          teamname="stripe.usa"
          channelname="this-is-a-very-long-channel-name"
        />
        <FilterBigTeamChannel
          {...commonBigFiltered}
          teamname="this.is.a.very.long.team.name.situation"
          channelname="general"
        />
      </Box>
    ))
}

const commonBigFiltered = {
  teamname: 'stripe',
  onSelectConversation: action('onSelectConversation'),
}

const commonFiltered = {
  backgroundColor: globalColors.white,
  isMuted: false,
  isSelected: false,
  onSelectConversation: action('onSelectConversation'),
  participantNeedToRekey: false,
  participants: I.List.of('chris', 'mikem'),
  showBold: false,
  teamname: null,
  usernameColor: globalColors.darkBlue,
  youNeedToRekey: false,
}

export default load
