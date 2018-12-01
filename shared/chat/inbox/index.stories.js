// @flow
/* eslint-disable sort-keys */
import * as React from 'react'
import * as I from 'immutable'
import * as Constants from '../../constants/types/chat2'
import * as Sb from '../../stories/storybook'

import {isDarwin} from '../../constants/platform'
import {isMobile, globalColors, globalMargins} from '../../styles'

import Inbox from '.'

/*
 * Rows
 */
const makeRowItemSmall = (conversationIDKey: string = '') => ({
  conversationIDKey: Constants.stringToConversationIDKey(conversationIDKey),
  type: 'small',
})
const makeRowItemBigHeader = (teamname: string = '') => ({teamname, type: 'bigHeader'})
const makeRowItemBigChannel = (conversationIDKey, teamname, channelname) => ({
  channelname,
  conversationIDKey: Constants.stringToConversationIDKey(conversationIDKey),
  teamname,
  type: 'big',
})
const makeRowItemDivider = (showButton: boolean = false) => ({showButton, type: 'divider'})

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
  isFinalized: false,
  isLocked: false,
  isMuted: false,
  isSelected: false,
  onSelectConversation: Sb.action('onSelectConversation'),
  participantNeedToRekey: false,
  participants: ['chris'],
  rekeyInfo: null,
  showBold: false,
  snippet: 'snippet',
  snippetDecoration: '',
  subColor: globalColors.black_40,
  teamname: '',
  timestamp: '1:23 pm',
  unreadCount: 0,
  usernameColor: globalColors.black_75,
  youAreReset: false,
  youNeedToRekey: false,
}

const commonSmallFilter = {
  backgroundColor: globalColors.white,
  isLocked: false,
  isMuted: false,
  isSelected: false,
  onSelectConversation: Sb.action('onSelectConversation'),
  participants: ['chris', 'mikem'],
  showBold: false,
  teamname: '',
  usernameColor: globalColors.black_75,
}

const commonBigChannel = {
  hasBadge: false,
  hasUnread: false,
  isError: false,
  isMuted: false,
  isSelected: false,
  onSelectConversation: Sb.action('onSelectConversation'),
  showBold: false,
}

const commonBigFilter = {
  isSelected: false,
  isTeam: true,
  onSelectConversation: Sb.action('onSelectConversation'),
  teamname: 'stripe',
}

const mapPropProviderProps = {
  // Small Teams
  bigTeamAChannel1: {
    ...commonBigChannel,
    channelname: 'general',
    teamname: 'Keybase',
  },
  bigTeamAChannel2: {
    ...commonBigChannel,
    channelname: 'random',
    showBold: true,
    teamname: 'Keybase',
  },
  bigTeamAChannel3: {
    ...commonBigChannel,
    channelname: 'zzz',
    hasUnread: true,
    showBold: true,
    teamname: 'Keybase',
  },
  bigTeamAChannel4: {
    ...commonBigChannel,
    channelname: 'video-games',
    isMuted: true,
    teamname: 'Keybase',
  },
  bigTeamAHeader: {
    memberCount: 0,
    badgeSubscribe: false, // Handled by PropProviders.TeamDropdownMenu
    teamname: 'Keybase',
  },
  bigTeamBChannel1: {
    ...commonBigChannel,
    channelname: 'general',
    isSelected: !isMobile,
    teamname: 'techtonica',
  },
  bigTeamBChannel2: {
    ...commonBigChannel,
    channelname: 'ignore-selected-below',
    teamname: 'techtonica',
  },
  smallTeamA: {
    ...commonSmallTeam,
    conversationIDKey: '3',
    hasBadge: false,
    hasUnread: false,
    showBold: false,
    snippet: 'elisa: Hopefully not',
    teamname: 'fortgreenmoms',
    timestamp: 'Tue',
  },
  bigTeamBChannel3: {
    ...commonBigChannel,
    channelname: 'random',
    isMuted: true,
    teamname: 'techtonica',
  },
  smallTeamB: {
    ...commonSmallTeam,
    conversationIDKey: '1',
    hasBadge: true,
    hasUnread: true,
    showBold: true,
    snippet: 'in the top-drawer i believe',
    subColor: globalColors.black_75,
    usernameColor: globalColors.black_75,
  },
  bigTeamBChannel4: {
    ...commonBigChannel,
    channelname: 'happy-hour',
    isMuted: true,
    teamname: 'techtonica',
  },
  smallTeamC: {
    ...commonSmallTeam,
    conversationIDKey: '2',
    hasBadge: false,
    hasUnread: false,
    participants: ['jzila'],
    showBold: false,
    snippet: "I don't know that I would want.",
    timestamp: '5:12 pm',
  },
  bigTeamBHeader: {
    badgeSubscribe: false,
    memberCount: 0, // Handled by PropProviders.TeamDropdownMenu
    teamname: 'techtonica',
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

  // Big Team A
  bigTeamDivider1: {
    badgeCount: 4,
  },
  smallTeamE: {
    ...commonSmallTeam,
    backgroundColor: isMobile ? commonSmallFilter.backgroundColor : globalColors.blue,
    conversationIDKey: '4',
    hasBadge: false,
    hasUnread: false,
    iconHoverColor: globalColors.white_75,
    isSelected: !isMobile,
    showBold: false,
    snippet: 'jork: what article?',
    subColor: isMobile ? commonSmallTeam.subColor : globalColors.white,
    teamname: 'atracks',
    timestamp: '5:13 pm',
    usernameColor: isMobile ? commonSmallTeam.usernameColor : globalColors.white,
  },
  bigTeamFilterAChannel1: {
    ...commonBigFilter,
    channelname: 'general',
  },
  smallTeamF: {
    ...commonSmallTeam,
    conversationIDKey: '6',
    hasBadge: false,
    hasUnread: false,
    participants: ['jacobyoung'],
    showBold: false,
    snippet: 'what does the scouter say about his power level?',
    subColor: globalColors.black_40,
    usernameColor: globalColors.black_40,
  },
  bigTeamFilterAChannel2: {
    ...commonBigFilter,
    channelname: 'random',
  },

  // Big Team B
  smallTeamG: {
    ...commonSmallTeam,
    conversationIDKey: '7',
    participants: ['nathunsmitty'],
    snippet: 'whoops',
    snippetDecoration: '💣',
    timestamp: '11:06 am',
  },
  bigTeamFilterBChannel1: {
    ...commonBigFilter,
    channelname: 'this-is-a-very-long-channel-name',
    teamname: 'stripe.usa',
  },
  smallTeamH: {
    conversationIDKey: '8',
    participants: ['ayoubd'],
    snippet: 'lol',
    snippetDecoration: '💥',
    timestamp: '1:37 pm',
  },
  bigTeamFilterCChannel1: {
    ...commonBigFilter,
    channelname: 'general',
    teamname: 'this.is.a.very.long.team.name.situation',
  },
  smallTeamI: {
    ...commonSmallTeam,
    conversationIDKey: '9',
    participants: ['cnojima'],
    snippet: 'rip',
    snippetDecoration: '',
    timestamp: '12:08 am',
  },

  // Small Teams Filter
  smallFilterTeamA: {
    ...commonSmallFilter,
  },
  smallTeamJ: {
    ...commonSmallTeam,
    conversationIDKey: '10',
    participants: ['max'],
    snippet: 'foo bar',
    snippetDecoration: '',
    timestamp: '2:56 pm',
  },
  smallFilterTeamB: {
    ...commonSmallFilter,
    paricipants: ['chris'],
  },

  // Big Teams Filter
  smallTeamK: {
    ...commonSmallTeam,
    conversationIDKey: '11',
    participants: ['nathunsmitty'],
    snippet: 'scoop die whoop',
    snippetDecoration: '',
    timestamp: '1:05 pm',
  },
  smallFilterTeamC: {
    ...commonSmallFilter,
    teamname: 'pokerpals',
  },
  smallTeamL: {
    ...commonSmallTeam,
    conversationIDKey: '12',
    participants: ['nathunsmitty', 'cnojima'],
    youAreReset: true,
  },
  smallTeamM: {
    ...commonSmallTeam,
    conversationIDKey: '13',
    participantNeedToRekey: true,
    participants: ['adamjspooner'],
  },

  smallTeamN: {
    ...commonSmallTeam,
    conversationIDKey: '14',
    participants: ['xgess'],
    youNeedToRekey: true,
  },
}

/*
 * Prop Provider Helpers
 */

/*
 * Look up the correct props to return for a given row component
 * Called from the row component's PropProvider
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

  return own.teamname ? mapPropProviderProps[own.teamname] : {}
}

/*
 * Inbox
 */
const propsInboxCommon = {
  allowShowFloatingButton: false,
  filter: '',
  filterFocusCount: 0,
  focusFilter: () => {},
  neverLoaded: false,
  nowOverride: 0, // just for dumb rendering
  onNewChat: Sb.action('onNewChat'),
  onSelectDown: Sb.action('onSelectDown'),
  onSelectUp: Sb.action('onSelectUp'),
  onUntrustedInboxVisible: Sb.action('onUntrustedInboxVisible'),
  rows: [],
  smallTeamsExpanded: false,
  toggleSmallTeamsExpanded: Sb.action('toggleSmallTeamsExpanded'),
}

const propsInboxEmpty = {
  ...propsInboxCommon,
}

const propsInboxSimple = {
  ...propsInboxCommon,
  rows: [
    makeRowItemSmall('smallTeamA'),
    makeRowItemSmall('smallTeamB'),
    makeRowItemSmall('smallTeamC'),
    makeRowItemSmall('smallTeamD'),
    makeRowItemSmall('smallTeamE'),
    makeRowItemSmall('smallTeamF'),
    makeRowItemSmall('smallTeamG'),
    makeRowItemSmall('smallTeamH'),
    makeRowItemSmall('smallTeamL'),
    makeRowItemSmall('smallTeamM'),
    makeRowItemSmall('smallTeamN'),
  ],
}

const propsInboxTeam = {
  ...propsInboxCommon,
  rows: [
    makeRowItemBigHeader('bigTeamAHeader'),
    makeRowItemBigChannel('bigTeamAChannel1', 'Keybase', 'general'),
    makeRowItemBigChannel('bigTeamAChannel2', 'Keybase', 'random'),
    makeRowItemBigChannel('bigTeamAChannel3', 'Keybase', 'zzz'),
    makeRowItemBigChannel('bigTeamAChannel4', 'Keybase', 'video-games'),

    makeRowItemBigHeader('bigTeamBHeader'),
    makeRowItemBigChannel('bigTeamBChannel1', 'techtonica', 'general'),
    makeRowItemBigChannel('bigTeamBChannel2', 'techtonica', 'ignore-selected-below'),
    makeRowItemBigChannel('bigTeamBChannel3', 'techtonica', 'random'),
    makeRowItemBigChannel('bigTeamBChannel4', 'techtonica', 'happy-hour'),
  ],
}

const propsInboxDivider = {
  ...propsInboxCommon,
  rows: [
    // Small
    makeRowItemSmall('smallTeamA'),
    makeRowItemSmall('smallTeamB'),
    makeRowItemSmall('smallTeamC'),
    makeRowItemSmall('smallTeamD'),
    makeRowItemSmall('smallTeamE'),
    makeRowItemSmall('smallTeamF'),

    // Divider
    makeRowItemDivider(true),

    // Big Team A
    makeRowItemBigHeader('bigTeamAHeader'),
    makeRowItemBigChannel('bigTeamAChannel1', 'Keybase', 'general'),
    makeRowItemBigChannel('bigTeamAChannel2', 'Keybase', 'random'),
    makeRowItemBigChannel('bigTeamAChannel3', 'Keybase', 'zzz'),
    makeRowItemBigChannel('bigTeamAChannel4', 'Keybase', 'video-games'),

    // Big Team B
    makeRowItemBigHeader('bigTeamBHeader'),
    makeRowItemBigChannel('bigTeamBChannel1', 'techtonica', 'general'),
    makeRowItemBigChannel('bigTeamBChannel2', 'techtonica', 'ignore-selected-below'),
    makeRowItemBigChannel('bigTeamBChannel3', 'techtonica', 'random'),
    makeRowItemBigChannel('bigTeamBChannel4', 'techtonica', 'happy-hour'),
  ],
  smallTeamsExpanded: false,
}

const propsInboxExpanded = {
  ...propsInboxCommon,
  rows: [
    // Small
    makeRowItemSmall('smallTeamA'),
    makeRowItemSmall('smallTeamB'),
    makeRowItemSmall('smallTeamC'),
    makeRowItemSmall('smallTeamD'),
    makeRowItemSmall('smallTeamE'),
    makeRowItemSmall('smallTeamF'),
    makeRowItemSmall('smallTeamG'),
    makeRowItemSmall('smallTeamH'),
    makeRowItemSmall('smallTeamI'),
    makeRowItemSmall('smallTeamJ'),
    makeRowItemSmall('smallTeamK'),
  ],
  smallTeamsExpanded: false,
}

const propsInboxFilter = {
  ...propsInboxCommon,
  filter: ' ',
  rows: [
    // Small
    makeRowItemSmall('smallFilterTeamA'),
    makeRowItemSmall('smallFilterTeamB'),
    makeRowItemSmall('smallFilterTeamC'),

    // Big Team A
    makeRowItemBigChannel('bigTeamFilterAChannel1', 'stripe', 'general'),
    makeRowItemBigChannel('bigTeamFilterAChannel2', 'stripe', 'random'),

    // Big Team B
    makeRowItemBigChannel('bigTeamFilterBChannel1', 'stripe.usa', 'this-is-a-very-long-channel-name'),
    makeRowItemBigChannel('bigTeamFilterCChannel1', 'this.is.a.very.long.team.name.situation', 'general'),
  ],
}

/*
 * Prop Providers
 */
const teamMemberCounts = {
  Keybase: 30,
  stripe: 1337,
  techtonica: 30,
}

const provider = Sb.createPropProviderWithCommon({
  ...Sb.PropProviders.TeamDropdownMenu(undefined, teamMemberCounts),
  BigTeamChannel: getPropProviderProps,
  BigTeamHeader: getPropProviderProps,
  BigTeamsDivider: ownProps => ({badgeCount: 5}),
  BuildTeam: p => ({
    loaded: true,
    onBuildTeam: Sb.action('onBuildTeam'),
  }),
  ChatFilterRow: p => ({
    filterFocusCount: p.filterFocusCount,
    fitler: p.filter,
    focusFilter: () => {},
    hotkeys: isDarwin ? ['command+n', 'command+k'] : ['ctrl+n', 'ctrl+k'],
    isLoading: false,
    onHotkey: Sb.action('onHotkey'),
    onNewChat: Sb.action('onNewChat'),
    onSelectDown: Sb.action('onSelectDown'),
    onSelectUp: Sb.action('onSelectUp'),
    onSetFilter: Sb.action('onSetFilter'),
    rows: p.rows,
  }),
  // BigTeamHeader is wrapped by OverlayParent
  ChatInboxHeaderContainer: p => {
    return {
      filterFocusCount: p.filterFocusCount,
      focusFilter: () => {},
      onNewChat: Sb.action('onNewChat'),
      rows: p.rows,
    }
  },
  FilterBigTeamChannel: getPropProviderProps,
  FilterSmallTeam: getPropProviderProps,
  NewChooser: p => ({
    isSelected: false,
    onCancel: Sb.action('onCancel'),
    onClick: Sb.action('onClick'),
    shouldShow: false,
    users: I.OrderedSet(['']),
  }),
  OverlayParent: getPropProviderProps,
  SmallTeam: getPropProviderProps,
  TeamsDivider: p => ({
    badgeCount: 2,
    hiddenCount: 4,
    showButton: p.showButton,
    style: {marginBottom: globalMargins.tiny},
    toggle: Sb.action('onToggle'),
  }),
})

class Wrapper extends React.Component<any, any> {
  state = {
    props: propsInboxExpanded,
  }

  componentDidMount() {
    if (!__STORYSHOT__) {
      setTimeout(() => {
        this.setState({props: {...this.state.props, smallTeamsExpanded: true}})
      }, 1)
    }
  }

  render() {
    return <Inbox {...this.state.props} />
  }
}

const load = () => {
  Sb.storiesOf('Chat/Inbox', module)
    .addDecorator(provider)
    .add('Empty', () => <Inbox {...propsInboxEmpty} />)
    .add('Simple', () => <Inbox {...propsInboxSimple} />)
    .add('Big Teams', () => <Inbox {...propsInboxTeam} />)
    .add('Divider', () => <Inbox {...propsInboxDivider} />)
    .add('Expanded teams', () => <Wrapper />)
    .add('Filter', () => <Inbox {...propsInboxFilter} />)
}

export default load
