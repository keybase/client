// @flow
import * as I from 'immutable'
import * as Constants from '../../constants/chat'
import * as ChatTypes from '../../constants/types/flow-types-chat'
import Inbox from './index'
import pausableConnect from '../../util/pausable-connect'
import {createSelector} from 'reselect'
import {loadInbox, newChat, untrustedInboxVisible, setInboxFilter} from '../../actions/chat/creators'
import {compose, lifecycle, withState, withHandlers} from 'recompose'
import throttle from 'lodash/throttle'
import flatten from 'lodash/flatten'

import type {TypedState} from '../../constants/reducer'

const smallteamsCollapsedMaxShown = 5
const getInbox = (state: TypedState) => state.chat.get('inbox')
const getSupersededByState = (state: TypedState) => state.chat.get('supersededByState')
const getAlwaysShow = (state: TypedState) => state.chat.get('alwaysShow')
const getPending = (state: TypedState) => state.chat.get('pendingConversations')
const getFilter = (state: TypedState) => state.chat.get('inboxFilter')
const getUnreadCounts = (state: TypedState) => state.chat.get('conversationUnreadCounts')

const passesStringFilter = (filter: string, toCheck: string): boolean => {
  return toCheck.toLowerCase().indexOf(filter.toLowerCase()) >= 0
}

const passesParticipantFilter = (participants: I.List<string>, filter: string, you: ?string): boolean => {
  const names = participants.filter(p => p !== you).toArray()
  // No need to worry about Unicode issues with toLowerCase(), since
  // names can only be ASCII.
  return names.some(n => passesStringFilter(filter, n))
}

const getSimpleRows = createSelector(
  [getInbox, getAlwaysShow, getFilter, getSupersededByState, Constants.getYou],
  (inbox, alwaysShow, filter, supersededByState, you) => {
    return inbox
      .filter(i => {
        if (i.teamType === ChatTypes.CommonTeamType.complex) {
          return false
        }

        const id = i.conversationIDKey
        const isEmpty = i.isEmpty && !alwaysShow.has(id)
        const isSuperseded = !!supersededByState.get(id)
        const isFilteredOut = !!(filter && !passesParticipantFilter(i.get('participants'), filter, you))

        return !isEmpty && !isSuperseded && !isFilteredOut
      })
      .sort((a, b) => {
        if (a.time === b.time) {
          return a.conversationIDKey.localeCompare(b.conversationIDKey)
        }

        return b.time - a.time
      })
      .map(i => i.conversationIDKey)
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

    if (!filter && bigTeams.count() && smallTeams.count() > smallteamsCollapsedMaxShown) {
      showSmallTeamsExpandDivider = true
      if (!smallTeamsExpanded) {
        smallTeams = smallTeams.slice(0, smallteamsCollapsedMaxShown)
      }
    }

    const bigTeamsBadgeCount = bigTeams.reduce((total, team) => {
      if (team.type === 'big') {
        const unreadCount: ?Constants.UnreadCounts = badgeCountMap.get(team.conversationIDKey)
        return total + (unreadCount ? unreadCount.badged : 0)
      }
      return total
    }, 0)

    const divider = {isBadged: bigTeamsBadgeCount > 0, type: 'divider'}
    const bigTeamsLabel = {isFiltered: !!filter, type: 'bigTeamsLabel'}
    const showBuildATeam = bigTeams.count() === 0

    const rows = smallTeams
      .concat(I.List(showSmallTeamsExpandDivider ? [divider] : []))
      .concat(I.List(bigTeams.count() ? [bigTeamsLabel] : []))
      .concat(bigTeams)

    return {bigTeamsBadgeCount, rows, showBuildATeam, showSmallTeamsExpandDivider}
  }
)

const mapStateToProps = (state: TypedState, {isActiveRoute, smallTeamsExpanded}) => {
  const {rows, showBuildATeam, showSmallTeamsExpandDivider, bigTeamsBadgeCount} = getRows(
    state,
    smallTeamsExpanded
  )
  const filter = getFilter(state)

  return {
    bigTeamsBadgeCount,
    filter,
    isActiveRoute,
    isLoading: state.chat.get('inboxUntrustedState') === 'loading',
    rows,
    showBuildATeam,
    showNewConversation: state.chat.inSearch && state.chat.inboxSearch.isEmpty(),
    showSmallTeamsExpandDivider,
  }
}

const mapDispatchToProps = (dispatch: Dispatch) => ({
  loadInbox: () => dispatch(loadInbox()),
  onNewChat: () => dispatch(newChat([])),
  onSetFilter: (filter: string) => dispatch(setInboxFilter(filter)),
  onUntrustedInboxVisible: (converationIDKey, rowsVisible) =>
    dispatch(untrustedInboxVisible(converationIDKey, rowsVisible)),
})

const mergeProps = (stateProps, dispatchProps, ownProps) => ({
  ...ownProps,
  ...stateProps,
  ...dispatchProps,
  smallTeamsExpanded: ownProps.smallTeamsExpanded && stateProps.showSmallTeamsExpandDivider, // only collapse if we're actually showing a divider
})

// Inbox is being loaded a ton by the navigator for some reason. we need a module-level helper
// to not call loadInbox multiple times
const throttleHelper = throttle(cb => cb(), 60 * 1000)

export default compose(
  withState('smallTeamsExpanded', 'setSmallTeamsExpanded', false),
  withHandlers({
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
