// @flow
import * as React from 'react'
import * as I from 'immutable'

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
const makeRowItemSmall = () => ({type: 'small', conversationIDKey: ''})
const makeRowItemBigTeamLabel = (isFiltered: boolean = false) => ({type: 'bigTeamsLabel', isFiltered})
const makeRowItemBigHeader = (teamname: string) => ({type: 'bigHeader', teamname})
const makeRowItemDivider = () => ({type: 'divider'})

/*
 * Component Prop Map
 *
 * componentMap: [coversationIDKey] -> PropProvider props
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
}

const commonSmallFiltered = {
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

const commonBigFiltered = {
  isSelected: false,
  onSelectConversation: action('onSelectConversation'),
  teamname: 'stripe',
}

const componentMap = {
  smallFiltered1: {},
  smallFiltered1: {},
  smallFiltered1: {},
  smallTeam1: {},
  smallTeam2: {},
  smallTeam3: {},
  smallTeam4: {},
  smallTeam5: {},
}

/*
 * Prop Provider Helpers
 */
const getComponentProps = own => componentMap[own.conversationIDKey]

/*
 * Inbox
 */
const propsInboxCommon = {
  filter: '',
  filterFocusCount: 0,
  isLoading: false,
  nowOverride: 0, // just for dumb rendering
  onNewChat: () => {},
  onSelectUp: () => {},
  onSelectDown: () => {},
  onHotkey: () => {},
  onSetFilter: () => {},
  onUntrustedInboxVisible: () => {},
  rows: [],
  showBuildATeam: false,
  showNewChat: false,
  showNewConversation: false,
  showSmallTeamsExpandDivider: false,
  smallTeamsExpanded: false,
  smallIDsHidden: [],
  toggleSmallTeamsExpanded: () => {},
}

const propsInboxEmpty = {
  ...propsInboxCommon,
  onNewChat: action('onNewChat'),
  showNewChat: true,
}

const propsInboxSimple = {
  ...propsInboxCommon,
  rows: [
    // TODO: Generate different row values using the makeRowItem functions above
  ],
}

// TODO: Write propProviders for
const provider = PropProviders.compose(
  PropProviders.TeamDropdownMenu(),
  PropProviders.Avatar(['following', 'both'], ['followers', 'both']),
  {
    BigTeamChannel: getComponentProps,
    BigTeamHeader: getComponentProps,
    BigTeamsDivider: getComponentProps,
    FilterBigTeamChannel: getComponentProps,
    FilterSmallTeam: getComponentProps,
    NewChooser: p => ({
      isSelected: false,
      onCancel: () => {},
      onClick: () => action('onClick'),
      shouldShow: false,
      users: I.OrderedSet(['']),
    }),
    SmallTeam: getComponentProps,
  }
)

const load = () => {
  console.log('BIG NEW THINGS')
  storiesOf('Chat/NewStuff')
    .addDecorator(provider)
    .add('Empty', () => {
      return <Inbox {...propsInboxEmpty} />
    })
}

export default load
