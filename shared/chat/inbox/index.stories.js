// @flow
import * as React from 'react'
import * as PropProviders from '../../stories/prop-providers'
import {storiesOf, action} from '../../stories/storybook'
import Inbox from '.'


// import {SmallTeam} from './small-team'
// import {FilterSmallTeam} from './filter-small-team'
// import {BigTeamHeader} from './big-team-header'
// import {BigTeamChannel} from './big-team-channel'
// import {FilterBigTeamChannel} from './filter-big-team-channel'

const propsInboxCommon = {
  children: [],
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
  smallIDsHidden: []
  toggleSmallTeamsExpanded: () => {},
}

const propsInboxEmpty = {
  ...propsInboxCommon,
  showNewChat: true,
  onNewChat: actions('onNewChat')
  rows: []
}

const provider = PropProviders.compose(
  PropProviders.TeamDropdownMenu(),
  PropProviders.Avatar(['following', 'both'], ['followers', 'both']),
)

const load = () => {
  storiesOf('Chat/Inbox')
  .add('Empty', () => {})
  .add('Simple', () => {})
  .add('Team', () => {})
  .add('Filtered', () => {})
}


export default load
