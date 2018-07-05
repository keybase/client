// @flow
/* eslint-disable sort-keys */
import * as React from 'react'
import * as I from 'immutable'
import * as Constants from '../../constants/types/chat2'

import * as PropProviders from '../../stories/prop-providers'
import {storiesOf, action} from '../../stories/storybook'
import {globalColors} from '../../styles'

import Inbox from '.'

// import {SmallTeam} from './small-team'
// import {FilterSmallTeam} from './filter-small-team'
// import {BigTeamHeader} from './big-team-header'
// import {BigTeamChannel} from './big-team-channel'
// import {FilterBigTeamChannel} from './filter-big-team-channel'

/*
 * Rows
 */

const makeRowItemSmall = (conversationIDKey: string = '') => ({
  type: 'small',
  conversationIDKey: Constants.stringToConversationIDKey(conversationIDKey),
})
const makeRowItemBigHeader = (teamname: string = '') => ({type: 'bigHeader', teamname})
const makeRowItemBigChannel = (conversationIDKey, teamname, channelname) => ({
  type: 'big',
  teamname,
  channelname,
  conversationIDKey: Constants.stringToConversationIDKey(conversationIDKey),
})
const makeRowItemDivider = () => ({type: 'divider'})

/*
 * Component Prop Map
 *
 * mapPropProviderProps: [coversationIDKey] -> PropProvider props
 */

const commonSmallTeam = {
  backgroundColor: globalColors.white,
  conversationIDKey: '',
  hasResetUsers: false,
  hasUnread: false,
  iconHoverColor: globalColors.black_60,
  isLocked: false,
  isMuted: false,
  isSelected: false,
  isFinalized: false,
  onSelectConversation: action('onSelectConversation'),
  participants: ['chris'],
  participantNeedToRekey: false,
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
  youNeedToRekey: false,
}

const commonSmallFilter = {
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

const commonBigChannel = {
  hasBadge: false,
  hasUnread: false,
  isError: false,
  isMuted: false,
  isSelected: false,
  onSelectConversation: action('onSelectConversation'),
  showBold: false,
}

const commonBigFilter = {
  isSelected: false,
  onSelectConversation: action('onSelectConversation'),
  teamname: 'stripe',
}

const mapPropProviderProps = {
  // Small Teams
  smallTeamA: {
    ...commonSmallTeam,
    conversationIDKey: '3',
    hasUnread: false,
    hasBadge: false,
    showBold: false,
    snippet: 'elisa: Hopefully not',
    teamname: 'fortgreenmoms',
    timestamp: 'Tue',
  },
  smallTeamB: {
    ...commonSmallTeam,
    conversationIDKey: '1',
    hasUnread: true,
    hasBadge: true,
    showBold: true,
    snippet: 'in the top-drawer i believe',
    subColor: globalColors.black_75,
    usernameColor: globalColors.black_75,
  },
  smallTeamC: {
    ...commonSmallTeam,
    conversationIDKey: '2',
    hasUnread: false,
    hasBadge: false,
    participants: ['jzila'],
    showBold: false,
    snippet: "I don't know that I would want.",
    timestamp: '5:12 pm',
  },
  smallTeamD: {
    ...commonSmallTeam,
    conversationIDKey: '5',
    hasBadge: false,
    hasResetUsers: true,
    hasUnread: false,
    participants: ['jzila'],
    showBold: false,
    snippet: "I don't know that I would want.",
    timestamp: '5:12 pm',
  },
  smallTeamE: {
    ...commonSmallTeam,
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

  // Small Teams Filter
  smallFilterA: {},
  smallFilterB: {},
  smallFilterC: {},

  // Big Team A
  bigTeamAHeader: {},
  bigTeamAChannel1: {},
  bigTeamAChannel2: {},
  bigTeamAChannel3: {},

  // Big Team B
  bigTeamBHeader: {},
  bigTeamBChannel1: {},
  bigTeamBChannel2: {},
  bigTeamBChannel3: {},
  bigTeamBChannel4: {},
}

/*
 * Prop Provider Helpers
 */

/*
 * Look up the correct props to return for a given row component
 * Called from the row component's prop provider
 * Uses either conversationIDKey or teamname as a key in mapPropProviderProps
 */
const getPropProviderProps = own => {
  if (own.conversationIDKey) {
    const props = mapPropProviderProps[own.conversationIDKey]
    return {
      ...props,
      key: props.conversationIDKey,
    }
  }

  return mapPropProviderProps[own.teamname]
}

/*
 * Inbox
 */
const propsInboxCommon = {
  filter: '',
  filterFocusCount: 0,
  isLoading: false,
  nowOverride: 0, // just for dumb rendering
  onHotkey: () => action('onHotkey'),
  onNewChat: () => action('onNewChat'),
  onSelectDown: () => action('onSelectDown'),
  onSelectUp: () => action('onSelectUp'),
  onSetFilter: () => action('onSelectFilter'),
  onUntrustedInboxVisible: () => action('onUntrustedInboxVisible'),
  rows: [],
  showBuildATeam: false,
  showNewChat: false,
  showNewConversation: false,
  showSmallTeamsExpandDivider: false,
  smallIDsHidden: [],
  smallTeamsExpanded: false,
  toggleSmallTeamsExpanded: () => action('toggleSmallTeamsExpanded'),
}

const propsInboxEmpty = {
  ...propsInboxCommon,
  showNewChat: true,
}

const propsInboxSimple = {
  ...propsInboxCommon,
  rows: [
    makeRowItemSmall('smallTeamA'),
    makeRowItemSmall('smallTeamB'),
    makeRowItemSmall('smallTeamC'),
    makeRowItemSmall('smallTeamD'),
    makeRowItemSmall('smallTeamE'),
  ],
}

/*
 * Prop Providers
 */
const provider = PropProviders.compose(
  PropProviders.TeamDropdownMenu(),
  PropProviders.Avatar(['following', 'both'], ['followers', 'both']),
  {
    NewChooser: p => ({
      isSelected: false,
      onCancel: () => {},
      onClick: () => action('onClick'),
      shouldShow: false,
      users: I.OrderedSet(['']),
    }),
    SmallTeam: p => {
      // console.log('SmallTeam Prop Proivder')
      // console.log({ownProps: p})
      const viewProps = getPropProviderProps(p)
      // console.log({viewProps})
      return viewProps
    },
    BigTeamHeader: getPropProviderProps,
    BigTeamChannel: getPropProviderProps,
    FilterSmallTeam: getPropProviderProps,
    FilterBigTeamChannel: getPropProviderProps,
  }
)

const load = () => {
  console.log('BIG NEW THINGS')
  storiesOf('Chat/NewStuff')
    .addDecorator(provider)
    .add('Empty', () => {
      return <Inbox {...propsInboxEmpty} />
    })
    .add('Simple', () => {
      return <Inbox {...propsInboxSimple} />
    })
}

export default load
