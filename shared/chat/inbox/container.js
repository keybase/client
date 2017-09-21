// @flow
import * as I from 'immutable'
import * as Constants from '../../constants/chat'
import * as ChatTypes from '../../constants/types/flow-types-chat'
import Inbox from './index'
import pausableConnect from '../../util/pausable-connect'
import {
  loadInbox,
  newChat,
  untrustedInboxVisible,
  setInboxFilter,
  selectConversation,
} from '../../actions/chat/creators'
import {createSelector} from 'reselect'
import {compose, lifecycle, withState, withHandlers} from 'recompose'
import throttle from 'lodash/throttle'
import flatten from 'lodash/flatten'

import type {TypedState} from '../../constants/reducer'

const smallTeamsCollapsedMaxShown = 5
const getInbox = (state: TypedState) => state.chat.get('inbox')
const getSupersededByState = (state: TypedState) => state.chat.get('supersededByState')
const getAlwaysShow = (state: TypedState) => state.chat.get('alwaysShow')
const getPending = (state: TypedState) => state.chat.get('pendingConversations')
const getFilter = (state: TypedState) => state.chat.get('inboxFilter')
const getUnreadCounts = (state: TypedState) => state.chat.get('conversationUnreadCounts')

const passesStringFilter = (filter: string, toCheck: string): boolean => {
  // No need to worry about Unicode issues with toLowerCase(), since
  // names can only be ASCII.
  return toCheck.toLowerCase().indexOf(filter.toLowerCase()) >= 0
}

const passesParticipantFilter = (filter: string, participants: Array<string>, you: ?string): boolean => {
  if (!filter) {
    return true
  }

  // don't filter you out if its just a convo with you!
  const justYou = participants.length === 1 && participants[0] === you
  const names = justYou ? participants : participants.filter(p => p !== you)
  return names.some(n => passesStringFilter(filter, n))
}

// Simple score for a filter. returns 1 for exact match. 0.75 for full name match
// in a group conversation. 0.5 for a partial match
// 0 for no match
function scoreFilter(filter, stringToFilterOn, you) {
  if (stringToFilterOn.indexOf(',') > 0) {
    const participants = stringToFilterOn.split(',')
    if (participants.some(p => p.toLowerCase() === filter.toLowerCase())) {
      if (participants.length === 2) {
        return 1
      }
      return 0.75
    }

    if (passesParticipantFilter(filter, participants, you)) {
      return 0.5
    }
  }

  if (filter.toLowerCase() === stringToFilterOn.toLowerCase()) {
    return 1
  }

  if (passesStringFilter(filter, stringToFilterOn)) {
    return 0.5
  }

  return 0
}

const getSimpleRows = createSelector(
  [getInbox, getAlwaysShow, getFilter, getSupersededByState, Constants.getYou],
  (inbox, alwaysShow, filter, supersededByState, you) => {
    return (
      inbox
        .filter(i => {
          if (i.teamType === ChatTypes.CommonTeamType.complex) {
            return false
          }

          const id = i.conversationIDKey
          const isEmpty = i.isEmpty && !alwaysShow.has(id)
          const isSuperseded = !!supersededByState.get(id)
          const passesFilter =
            !filter || scoreFilter(filter, i.teamname || i.get('participants').join(','), you) > 0

          return !isEmpty && !isSuperseded && passesFilter
        })
        // this is done for perf reasons and that sorting immutable lists is slow
        .map(i => ({
          conversationIDKey: i.conversationIDKey,
          time: i.time,
          filterScore: scoreFilter(filter, i.teamname || i.get('participants').join(','), you),
        }))
        .sort((a, b) => {
          if (filter) {
            if (b.filterScore !== a.filterScore) {
              return b.filterScore - a.filterScore
            }
          }

          if (a.time === b.time) {
            return a.conversationIDKey.localeCompare(b.conversationIDKey)
          }

          return b.time - a.time
        })
        .map(i => i.conversationIDKey)
    )
  }
)

const getBigRows = createSelector([getInbox, getFilter], (inbox, filter) => {
  const bigTeamToChannels = inbox
    .filter(i => i.teamType === ChatTypes.CommonTeamType.complex)
    .reduce((map, i) => {
      if (!map[i.teamname]) {
        map[i.teamname] = {}
      }
      const id = i.conversationIDKey
      // Do we have the real name yet?
      const channel = i.channelname === '-' ? id : i.channelname
      map[i.teamname][channel] = id
      return map
    }, {})

  // Filter out big teams
  if (filter) {
    Object.keys(bigTeamToChannels).forEach(team => {
      // teamname doesn't pass
      if (filter && !passesStringFilter(filter, team)) {
        const channels = Object.keys(bigTeamToChannels[team])
        channels.forEach(c => {
          if (filter && !passesStringFilter(filter, c)) {
            delete bigTeamToChannels[team][c]
          }
        })

        const filteredChannels = Object.keys(bigTeamToChannels[team])
        if (!filteredChannels.length) {
          delete bigTeamToChannels[team]
        }
      }
    })
  }

  return bigTeamToChannels
})

const getRows = createSelector(
  [
    getSimpleRows,
    getBigRows,
    getPending,
    getFilter,
    getUnreadCounts,
    (_, smallTeamsExpanded) => smallTeamsExpanded,
  ],
  (smallIds, bigTeamToChannels, pending, filter, badgeCountMap, smallTeamsExpanded) => {
    const pids = I.List(pending.keySeq().map(k => ({conversationIDKey: k, type: 'small'})))
    const sids = I.List(smallIds.map(s => ({conversationIDKey: s, type: 'small'})))

    const bigTeams = I.List(
      flatten(
        Object.keys(bigTeamToChannels).sort().map(team => {
          const channels = bigTeamToChannels[team]
          return [
            ...(filter
              ? []
              : [
                  {
                    teamname: team,
                    type: 'bigHeader',
                  },
                ]),
          ].concat(
            Object.keys(channels).sort().map(channel => ({
              channelname: channel,
              conversationIDKey: channels[channel],
              teamname: team,
              type: 'big',
            }))
          )
        })
      )
    )

    let smallTeams = pids.concat(sids)
    let showSmallTeamsExpandDivider = false
    const smallTeamsRowsToHideCount = Math.max(0, smallTeams.count() - smallTeamsCollapsedMaxShown)
    let smallTeamsHiddenBadgeCount = 0
    let smallTeamsHiddenRowCount = 0
    if (!filter && bigTeams.count() && smallTeamsRowsToHideCount) {
      showSmallTeamsExpandDivider = true
      if (!smallTeamsExpanded) {
        const smallTeamsHidden = smallTeams.slice(smallTeamsCollapsedMaxShown)
        smallTeams = smallTeams.slice(0, smallTeamsCollapsedMaxShown)
        smallTeamsHiddenBadgeCount = smallTeamsHidden.reduce((total, team) => {
          if (team.type === 'small') {
            const unreadCount: ?Constants.UnreadCounts = badgeCountMap.get(team.conversationIDKey)
            return total + (unreadCount ? unreadCount.badged : 0)
          }
          return total
        }, 0)
        smallTeamsHiddenRowCount = smallTeamsRowsToHideCount
      }
    }

    const bigTeamsBadgeCount = bigTeams.reduce((total, team) => {
      if (team.type === 'big') {
        const unreadCount: ?Constants.UnreadCounts = badgeCountMap.get(team.conversationIDKey)
        return total + (unreadCount ? unreadCount.badged : 0)
      }
      return total
    }, 0)

    const divider = {type: 'divider'}
    const bigTeamsLabel = {isFiltered: !!filter, type: 'bigTeamsLabel'}
    const showBuildATeam = bigTeams.count() === 0

    const rows = smallTeams
      .concat(I.List(showSmallTeamsExpandDivider ? [divider] : []))
      .concat(I.List(bigTeams.count() ? [bigTeamsLabel] : []))
      .concat(bigTeams)

    return {
      bigTeamsBadgeCount,
      rows,
      showBuildATeam,
      showSmallTeamsExpandDivider,
      smallTeamsHiddenBadgeCount,
      smallTeamsHiddenRowCount,
    }
  }
)

const mapStateToProps = (state: TypedState, {isActiveRoute, smallTeamsExpanded}) => {
  const {
    bigTeamsBadgeCount,
    rows,
    showBuildATeam,
    showSmallTeamsExpandDivider,
    smallTeamsHiddenBadgeCount,
    smallTeamsHiddenRowCount,
  } = getRows(state, smallTeamsExpanded)
  const filter = getFilter(state)

  return {
    _selected: Constants.getSelectedConversation(state),
    bigTeamsBadgeCount,
    filter,
    isActiveRoute,
    isLoading: state.chat.get('inboxUntrustedState') === 'loading',
    rows,
    showBuildATeam,
    showNewConversation: state.chat.inSearch && state.chat.inboxSearch.isEmpty(),
    showSmallTeamsExpandDivider,
    smallTeamsHiddenBadgeCount,
    smallTeamsHiddenRowCount,
  }
}

const mapDispatchToProps = (dispatch: Dispatch, {focusFilter}) => ({
  loadInbox: () => dispatch(loadInbox()),
  onHotkey: cmd => {
    if (cmd.endsWith('+n')) {
      dispatch(newChat())
    } else {
      focusFilter()
    }
  },
  onNewChat: () => dispatch(newChat()),
  onSelect: (conversationIDKey: ?Constants.ConversationIDKey) =>
    conversationIDKey && dispatch(selectConversation(conversationIDKey, true)),
  onSetFilter: (filter: string) => dispatch(setInboxFilter(filter)),
  onUntrustedInboxVisible: (converationIDKey, rowsVisible) =>
    dispatch(untrustedInboxVisible(converationIDKey, rowsVisible)),
})

const findNextConvo = (rows: I.List<any>, selected, direction) => {
  const filteredRows = rows.filter(r => ['small', 'big'].includes(r.type))
  const idx = filteredRows.findIndex(r => r.conversationIDKey === selected)
  let nextIdx
  if (idx === -1) {
    nextIdx = 0
  } else {
    nextIdx = Math.min(filteredRows.count() - 1, Math.max(0, idx + direction))
  }
  const r = filteredRows.get(nextIdx)
  return r && r.conversationIDKey
}

const mergeProps = (stateProps, dispatchProps, ownProps) => ({
  ...ownProps,
  ...stateProps,
  ...dispatchProps,
  onSelectDown: () => dispatchProps.onSelect(findNextConvo(stateProps.rows, stateProps._selected, 1)),
  onSelectUp: () => dispatchProps.onSelect(findNextConvo(stateProps.rows, stateProps._selected, -1)),
  smallTeamsExpanded: ownProps.smallTeamsExpanded && stateProps.showSmallTeamsExpandDivider, // only collapse if we're actually showing a divider
})

// Inbox is being loaded a ton by the navigator for some reason. we need a module-level helper
// to not call loadInbox multiple times
const throttleHelper = throttle(cb => cb(), 60 * 1000)

export default compose(
  withState('filterFocusCount', 'setFilterFocusCount', 0),
  withState('smallTeamsExpanded', 'setSmallTeamsExpanded', false),
  withHandlers({
    focusFilter: props => () => props.setFilterFocusCount(props.filterFocusCount + 1),
    toggleSmallTeamsExpanded: props => () => props.setSmallTeamsExpanded(!props.smallTeamsExpanded),
  }),
  pausableConnect(mapStateToProps, mapDispatchToProps, mergeProps),
  lifecycle({
    componentDidMount: function() {
      throttleHelper(() => {
        this.props.loadInbox()
      })
    },
  })
)(Inbox)
