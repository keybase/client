/* eslint-disable sort-keys */
import * as React from 'react'
import * as I from 'immutable'
import * as Types from '../../constants/types/chat2'
import * as Sb from '../../stories/storybook'
import {isDarwin} from '../../constants/platform'
import {isMobile, globalColors, globalMargins} from '../../styles'
import Inbox from '.'
import {RowItemSmall, RowItemBigHeader, RowItemBig, RowItemDivider} from './index.types'

/*
 * Rows
 */
const makeRowItemSmall = (conversationIDKey: string = ''): RowItemSmall => ({
  type: 'small',
  conversationIDKey: Types.stringToConversationIDKey(conversationIDKey),
})
const makeRowItemBigHeader = (teamname: string = ''): RowItemBigHeader => ({type: 'bigHeader', teamname})
const makeRowItemBigChannel = (conversationIDKey, teamname, channelname): RowItemBig => ({
  type: 'big',
  teamname,
  channelname,
  conversationIDKey: Types.stringToConversationIDKey(conversationIDKey),
})
const makeRowItemDivider = (showButton: boolean = false): RowItemDivider => ({type: 'divider', showButton})

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
  iconHoverColor: globalColors.black_50,
  isLocked: false,
  isMuted: false,
  isSelected: false,
  isFinalized: false,
  onSelectConversation: Sb.action('onSelectConversation'),
  participants: ['chris'],
  participantNeedToRekey: false,
  rekeyInfo: null,
  showBold: false,
  snippet: 'snippet',
  snippetDecoration: '',
  subColor: globalColors.black_50,
  teamname: '',
  timestamp: '1:23 pm',
  unreadCount: 0,
  usernameColor: globalColors.black,
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
  usernameColor: globalColors.black,
}

const commonBigChannel = {
  hasBadge: false,
  hasUnread: false,
  isError: false,
  isMuted: false,
  isSearching: false,
  isSelected: false,
  onSelectConversation: Sb.action('onSelectConversation'),
  showBold: false,
}

const commonBigFilter = {
  isSelected: false,
  onSelectConversation: Sb.action('onSelectConversation'),
  teamname: 'stripe',
  isTeam: true,
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
    subColor: globalColors.black,
    usernameColor: globalColors.black,
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
    backgroundColor: isMobile ? commonSmallFilter.backgroundColor : globalColors.blue,
    conversationIDKey: '4',
    hasUnread: false,
    hasBadge: true,
    iconHoverColor: globalColors.white_75,
    isSelected: !isMobile,
    showBold: false,
    snippet: 'jork: what article?',
    subColor: isMobile ? commonSmallTeam.subColor : globalColors.white,
    teamname: 'atracks',
    timestamp: '5:13 pm',
    usernameColor: isMobile ? commonSmallTeam.usernameColor : globalColors.white,
  },
  smallTeamF: {
    ...commonSmallTeam,
    conversationIDKey: '6',
    participants: ['jacobyoung'],
    hasUnread: false,
    hasBadge: false,
    showBold: false,
    snippet: 'what does the scouter say about his power level?',
    subColor: globalColors.black_50,
    usernameColor: globalColors.black_50,
  },
  smallTeamG: {
    ...commonSmallTeam,
    conversationIDKey: '7',
    participants: ['nathunsmitty'],
    snippet: 'whoops',
    timestamp: '11:06 am',
    snippetDecoration: '💣',
  },
  smallTeamH: {
    conversationIDKey: '8',
    participants: ['ayoubd'],
    snippet: 'lol',
    timestamp: '1:37 pm',
    snippetDecoration: '💥',
  },
  smallTeamI: {
    ...commonSmallTeam,
    conversationIDKey: '9',
    participants: ['cnojima'],
    snippet: 'rip',
    timestamp: '12:08 am',
    snippetDecoration: '',
  },
  smallTeamJ: {
    ...commonSmallTeam,
    conversationIDKey: '10',
    participants: ['max'],
    snippet: 'foo bar',
    timestamp: '2:56 pm',
    snippetDecoration: '',
  },
  smallTeamK: {
    ...commonSmallTeam,
    conversationIDKey: '11',
    participants: ['nathunsmitty'],
    snippet: 'scoop die whoop',
    timestamp: '1:05 pm',
    snippetDecoration: '',
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
    participants: ['adamjspooner'],
    participantNeedToRekey: true,
  },
  smallTeamN: {
    ...commonSmallTeam,
    conversationIDKey: '14',
    participants: ['xgess'],
    youNeedToRekey: true,
  },

  // Big Team A
  bigTeamAHeader: {
    teamname: 'Keybase',
    memberCount: 0, // Handled by PropProviders.TeamDropdownMenu
    badgeSubscribe: false,
  },
  bigTeamAChannel1: {
    ...commonBigChannel,
    teamname: 'Keybase',
    channelname: 'general',
  },
  bigTeamAChannel2: {
    ...commonBigChannel,
    teamname: 'Keybase',
    channelname: 'random',
    showBold: true,
  },
  bigTeamAChannel3: {
    ...commonBigChannel,
    teamname: 'Keybase',
    channelname: 'zzz',
    showBold: true,
    hasUnread: true,
  },
  bigTeamAChannel4: {
    ...commonBigChannel,
    teamname: 'Keybase',
    channelname: 'video-games',
    isMuted: true,
  },

  // Big Team B
  bigTeamBHeader: {
    teamname: 'techtonica.long.team.name.with.ellipsis',
    memberCount: 0, // Handled by PropProviders.TeamDropdownMenu
    badgeSubscribe: false,
  },
  bigTeamBChannel1: {
    ...commonBigChannel,
    teamname: 'techtonica.long.team.name.with.ellipsis',
    channelname: 'general',
    isSelected: !isMobile,
  },
  bigTeamBChannel2: {
    ...commonBigChannel,
    teamname: 'techtonica.long.team.name.with.ellipsis',
    channelname: 'ignore-selected-below',
  },
  bigTeamBChannel3: {
    ...commonBigChannel,
    teamname: 'techtonica.long.team.name.with.ellipsis',
    channelname: 'random',
    isMuted: true,
  },
  bigTeamBChannel4: {
    ...commonBigChannel,
    teamname: 'techtonica.long.team.name.with.ellipsis',
    channelname: 'happy-hour',
    isMuted: true,
  },

  // Small Teams Filter
  smallFilterTeamA: {
    ...commonSmallFilter,
  },
  smallFilterTeamB: {
    ...commonSmallFilter,
    paricipants: ['chris'],
  },
  smallFilterTeamC: {
    ...commonSmallFilter,
    teamname: 'pokerpals',
  },

  // Big Teams Filter
  bigTeamFilterAChannel1: {
    ...commonBigFilter,
    channelname: 'general',
  },
  bigTeamFilterAChannel2: {
    ...commonBigFilter,
    channelname: 'random',
  },
  bigTeamFilterBChannel1: {
    ...commonBigFilter,
    teamname: 'stripe.usa',
    channelname: 'this-is-a-very-long-channel-name',
  },
  bigTeamFilterCChannel1: {
    ...commonBigFilter,
    teamname: 'this.is.a.very.long.team.name.situation',
    channelname: 'general',
  },

  bigTeamDivider1: {
    badgeCount: 4,
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
  if (own.conversationIDKey && own.conversationIDKey !== 'EMPTY') {
    const props = mapPropProviderProps[own.conversationIDKey]
    return {
      ...props,
      conversationIDKey: own.conversationIDKey,
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
  isSearching: false,
  neverLoaded: false,
  nowOverride: 0, // just for dumb rendering
  onNewChat: Sb.action('onNewChat'),
  onUntrustedInboxVisible: Sb.action('onUntrustedInboxVisible'),
  onSelectUp: Sb.action('onSelectUp'),
  onSelectDown: Sb.action('onSelectDown'),
  onEnsureSelection: Sb.action('onEnsureSelection'),
  rows: [],
  selectedConversationIDKey: Types.stringToConversationIDKey('fake conversation id key'),
  smallTeamsExpanded: false,
  toggleSmallTeamsExpanded: Sb.action('toggleSmallTeamsExpanded'),
  unreadIndices: I.List(),
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
    makeRowItemBigChannel('bigTeamBChannel1', 'techtonica.long.team.name.with.ellipsis', 'general'),
    makeRowItemBigChannel(
      'bigTeamBChannel2',
      'techtonica.long.team.name.with.ellipsis',
      'ignore-selected-below'
    ),
    makeRowItemBigChannel('bigTeamBChannel3', 'techtonica.long.team.name.with.ellipsis', 'random'),
    makeRowItemBigChannel('bigTeamBChannel4', 'techtonica.long.team.name.with.ellipsis', 'happy-hour'),
  ],
}

const propsInboxDivider = {
  ...propsInboxCommon,
  smallTeamsExpanded: false,
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
    makeRowItemBigChannel('bigTeamBChannel1', 'techtonica.long.team.name.with.ellipsis', 'general'),
    makeRowItemBigChannel(
      'bigTeamBChannel2',
      'techtonica.long.team.name.with.ellipsis',
      'ignore-selected-below'
    ),
    makeRowItemBigChannel('bigTeamBChannel3', 'techtonica.long.team.name.with.ellipsis', 'random'),
    makeRowItemBigChannel('bigTeamBChannel4', 'techtonica.long.team.name.with.ellipsis', 'happy-hour'),
  ],
}

const propsInboxExpanded = {
  ...propsInboxCommon,
  smallTeamsExpanded: false,
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
}

/*
 * Prop Providers
 */
const teamMemberCounts = {
  Keybase: 30,
  'techtonica.long.team.name.with.ellipsis': 30,
  stripe: 1337,
}

const provider = Sb.createPropProviderWithCommon({
  ...Sb.PropProviders.TeamDropdownMenu(undefined, teamMemberCounts),
  ChatInboxHeaderContainer: p => {
    return {
      focusFilter: () => {},
      filterFocusCount: p.filterFocusCount,
      onNewChat: Sb.action('onNewChat'),
      rows: p.rows,
    }
  },
  ChatFilterRow: p => ({
    focusFilter: () => {},
    fitler: p.filter,
    filterFocusCount: p.filterFocusCount,
    isLoading: false,
    hotkeys: isDarwin ? ['command+n', 'command+k'] : ['ctrl+n', 'ctrl+k'],
    onHotkey: Sb.action('onHotkey'),
    onNewChat: Sb.action('onNewChat'),
    onSelectDown: Sb.action('onSelectDown'),
    onSelectUp: Sb.action('onSelectUp'),
    onSetFilter: Sb.action('onSetFilter'),
    rows: p.rows,
  }),
  BuildTeam: () => ({
    onBuildTeam: Sb.action('onBuildTeam'),
    loaded: true,
  }),
  NewChooser: () => ({
    isSelected: false,
    onCancel: Sb.action('onCancel'),
    onClick: Sb.action('onClick'),
    shouldShow: false,
    users: I.OrderedSet(['']),
  }),
  TeamsDivider: p => ({
    badgeCount: 2,
    showButton: p.showButton,
    hiddenCount: 4,
    style: {marginBottom: globalMargins.tiny},
    toggle: Sb.action('onToggle'),
  }),
  InboxBigTeamHeader: getPropProviderProps,
  SmallTeam: getPropProviderProps,
  BigTeamsDivider: () => ({badgeCount: 5}),
  BigTeamChannel: getPropProviderProps,
  FilterSmallTeam: getPropProviderProps,
  FilterBigTeamChannel: getPropProviderProps,
  SelectableSmallTeam: getPropProviderProps,
  SelectableBigTeamChannel: getPropProviderProps,
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
}

export default load
