// @flow
/* eslint-disable sort-keys */
import React from 'react'
import {Box} from '../../../common-adapters'
import {storiesOf, action, createPropProvider} from '../../../stories/storybook'
import * as PropProviders from '../../../stories/prop-providers'
import {globalColors} from '../../../styles'
import {SmallTeam} from './small-team'
import {FilterSmallTeam} from './filter-small-team'
import {BigTeamHeader} from './big-team-header'
import {BigTeamChannel} from './big-team-channel'
import {FilterBigTeamChannel} from './filter-big-team-channel'

const simpleCommon = {
  backgroundColor: globalColors.white,
  conversationIDKey: '',
  hasResetUsers: false,
  hasUnread: false,
  iconHoverColor: globalColors.black_60,
  isMuted: false,
  isSelected: false,
  onSelectConversation: action('onSelectConversation'),
  participants: ['chris'],
  rekeyInfo: null,
  showBold: false,
  snippet: 'snippet',
  snippetDecoration: '',
  subColor: globalColors.black_40,
  teamname: '',
  timestamp: '1:23 pm',
  unreadCount: 0,
  usernameColor: globalColors.darkBlue,
  youAreReset: false,
  isLocked: false,
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
    participants: ['jzila'],
    showBold: false,
    snippet: "I don't know that I would want.",
    timestamp: '5:12 pm',
  },
  {
    ...simpleCommon,
    conversationIDKey: '5',
    hasBadge: false,
    hasResetUsers: true,
    hasUnread: false,
    participants: ['jzila'],
    showBold: false,
    snippet: "I don't know that I would want.",
    timestamp: '5:12 pm',
  },
  {
    ...simpleCommon,
    backgroundColor: globalColors.blue,
    conversationIDKey: '4',
    hasUnread: false,
    hasBadge: false,
    iconHoverColor: globalColors.white_75,
    isSelected: true,
    showBold: false,
    snippet: 'jork: what article?',
    subColor: globalColors.white,
    teamname: 'atracks',
    timestamp: '5:13 pm',
    usernameColor: globalColors.white,
  },
  {
    ...simpleCommon,
    conversationIDKey: '6',
    participants: ['nathunsmitty'],
    snippet: 'whoops',
    timestamp: '11:06 am',
    snippetDecoration: '💣',
  },
  {
    ...simpleCommon,
    conversationIDKey: '7',
    participants: ['nathunsmitty'],
    snippet: 'lol',
    timestamp: '1:37 pm',
    snippetDecoration: '💥',
  },
]

const commonChannel = {
  onSelectConversation: action('onSelectConversation'),
  hasBadge: false,
  hasUnread: false,
  isMuted: false,
  isSelected: false,
  showBold: false,
  isError: false,
}

const provider = createPropProvider(PropProviders.Common(), PropProviders.TeamDropdownMenu())

const load = () => {
  storiesOf('Chat/Inbox', module)
    .addDecorator(provider)
    .add('Simple', () => (
      <Box style={{width: 270}}>
        {mocks.map(m => (
          <SmallTeam
            key={m.conversationIDKey}
            participantNeedToRekey={false}
            youNeedToRekey={false}
            isFinalized={false}
            {...m}
          />
        ))}
      </Box>
    ))
    .add('Team', () => (
      <Box style={{borderColor: 'black', borderStyle: 'solid', borderWidth: 1, width: 270}}>
        <BigTeamHeader badgeSubscribe={false} memberCount={30} teamname="Keybase" />
        <BigTeamChannel {...commonChannel} teamname="Keybase" channelname="#general" />
        <BigTeamChannel {...commonChannel} teamname="Keybase" channelname="#random" showBold={true} />
        <BigTeamChannel
          {...commonChannel}
          teamname="Keybase"
          channelname="#zzz"
          showBold={true}
          hasUnread={true}
        />
        <BigTeamChannel {...commonChannel} teamname="Keybase" channelname="#video-games" isMuted={true} />

        <BigTeamHeader badgeSubscribe={false} memberCount={30} teamname="techtonica" />
        <BigTeamChannel {...commonChannel} teamname="techtonica" channelname="#general" isSelected={true} />
        <BigTeamChannel {...commonChannel} teamname="techtonica" channelname="#ignore-selected-below" />
        <BigTeamChannel
          {...commonChannel}
          teamname="techtonica"
          channelname="#random"
          isSelected={true}
          isMuted={true}
        />
        <BigTeamChannel
          {...commonChannel}
          teamname="techtonica"
          channelname="#happy-hour"
          isSelected={true}
          hasUnread={true}
        />
      </Box>
    ))
    .add('Filtered', () => (
      <Box style={{borderColor: 'black', borderStyle: 'solid', borderWidth: 1, width: 270}}>
        <FilterSmallTeam {...commonFiltered} />
        <FilterSmallTeam {...commonFiltered} participants={['chris']} />
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
  isSelected: false,
  onSelectConversation: action('onSelectConversation'),
}

const commonFiltered = {
  backgroundColor: globalColors.white,
  isLocked: false,
  isMuted: false,
  isSelected: false,
  onSelectConversation: action('onSelectConversation'),
  participants: ['chris', 'mikem'],
  showBold: false,
  teamname: '',
  usernameColor: globalColors.darkBlue,
}

export default load
