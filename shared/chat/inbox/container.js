// @flow
import * as React from 'react'
import * as I from 'immutable'
import * as Constants from '../../constants/chat'
import * as ChatTypes from '../../constants/types/flow-types-chat'
import Inbox from './index'
import pausableConnect from '../../util/pausable-connect'
import * as Creators from '../../actions/chat/creators'
import {createSelector} from 'reselect'
import {compose, lifecycle, withState, withHandlers} from 'recompose'
import throttle from 'lodash/throttle'
import flatten from 'lodash/flatten'
import createImmutableEqualSelector from '../../util/create-immutable-equal-selector'

import type {TypedState} from '../../constants/reducer'

const smallTeamsCollapsedMaxShown = 5
const getSupersededByState = (state: TypedState) => state.chat.get('supersededByState')
const getPending = (state: TypedState) => state.chat.get('pendingConversations')
const getUnreadCounts = (state: TypedState) => state.chat.get('conversationUnreadCounts')

const passesStringFilter = (filter: string, toCheck: string): boolean => {
  // No need to worry about Unicode issues with toLowerCase(), since
  // names can only be ASCII.
  return toCheck.indexOf(filter) >= 0
}

const passesParticipantFilter = (lcFilter: string, lcParticipants: Array<string>, you: ?string): boolean => {
  if (!lcFilter) {
    return true
  }

  // don't filter you out if its just a convo with you!
  const justYou = lcParticipants.length === 1 && lcParticipants[0] === you
  const names = justYou ? lcParticipants : lcParticipants.filter(p => p !== you)
  return names.some(n => passesStringFilter(lcFilter, n))
}

// // Simple score for a filter. returns 1 for exact match. 0.75 for full name match
// // in a group conversation. 0.5 for a partial match
// // 0 for no match
function scoreFilter(
  lcFilter: string,
  lcStringToFilterOn: string,
  lcParticipants: Array<string>,
  lcYou: string
) {
  if (!lcStringToFilterOn && lcParticipants.length) {
    if (lcFilter === lcYou.toLowerCase()) {
      return 1
    }
    if (lcParticipants.some(p => p === lcFilter)) {
      return 1 - (lcParticipants.length - 1) / 100 * 0.25
    }

    if (passesParticipantFilter(lcFilter, lcParticipants, lcYou)) {
      return 0.5
    }
  }

  if (lcFilter === lcStringToFilterOn) {
    return 1
  }

  if (passesStringFilter(lcFilter, lcStringToFilterOn)) {
    return 0.5
  }

  return 0
}

// const getBigRows = createSelector([getInbox, getFilter], (inbox, filter) => {
// const bigTeamToChannels = inbox
// .filter(i => i.teamType === ChatTypes.CommonTeamType.complex)
// .reduce((map, i) => {
// if (!map[i.teamname]) {
// map[i.teamname] = {}
// }
// const id = i.conversationIDKey
// // Do we have the real name yet?
// const channel = i.channelname === '-' ? id : i.channelname
// map[i.teamname][channel] = id
// return map
// }, {})

// // Filter out big teams
// if (filter) {
// Object.keys(bigTeamToChannels).forEach(team => {
// // teamname doesn't pass
// if (filter && !passesStringFilter(filter, team)) {
// const channels = Object.keys(bigTeamToChannels[team])
// channels.forEach(c => {
// if (filter && !passesStringFilter(filter, c)) {
// delete bigTeamToChannels[team][c]
// }
// })

// const filteredChannels = Object.keys(bigTeamToChannels[team])
// if (!filteredChannels.length) {
// delete bigTeamToChannels[team]
// }
// }
// })
// }

// return bigTeamToChannels
// })

// const getRows = createSelector(
// [
// getSimpleRows,
// getBigRows,
// getPending,
// getFilter,
// getUnreadCounts,
// (_, smallTeamsExpanded) => smallTeamsExpanded,
// ],
// (smallIds, bigTeamToChannels, pending, filter, badgeCountMap, smallTeamsExpanded) => {
// const pids = I.List(pending.keySeq().map(k => ({conversationIDKey: k, type: 'small'})))
// const sids = I.List(smallIds.map(s => ({conversationIDKey: s, type: 'small'})))

// const bigTeams = I.List(
// flatten(
// Object.keys(bigTeamToChannels).sort().map(team => {
// const channels = bigTeamToChannels[team]
// return [
// ...(filter
// ? []
// : [
// {
// teamname: team,
// type: 'bigHeader',
// },
// ]),
// ].concat(
// Object.keys(channels).sort().map(channel => ({
// channelname: channel,
// conversationIDKey: channels[channel],
// teamname: team,
// type: 'big',
// }))
// )
// })
// )
// )

// let smallTeams = pids.concat(sids)
// let showSmallTeamsExpandDivider = false
// const smallTeamsRowsToHideCount = Math.max(0, smallTeams.count() - smallTeamsCollapsedMaxShown)
// let smallTeamsHiddenBadgeCount = 0
// let smallTeamsHiddenRowCount = 0
// if (!filter && bigTeams.count() && smallTeamsRowsToHideCount) {
// showSmallTeamsExpandDivider = true
// if (!smallTeamsExpanded) {
// const smallTeamsHidden = smallTeams.slice(smallTeamsCollapsedMaxShown)
// smallTeams = smallTeams.slice(0, smallTeamsCollapsedMaxShown)
// smallTeamsHiddenBadgeCount = smallTeamsHidden.reduce((total, team) => {
// if (team.type === 'small') {
// const unreadCount: ?Constants.UnreadCounts = badgeCountMap.get(team.conversationIDKey)
// return total + (unreadCount ? unreadCount.badged : 0)
// }
// return total
// }, 0)
// smallTeamsHiddenRowCount = smallTeamsRowsToHideCount
// }
// }

// const bigTeamsBadgeCount = bigTeams.reduce((total, team) => {
// if (team.type === 'big') {
// const unreadCount: ?Constants.UnreadCounts = badgeCountMap.get(team.conversationIDKey)
// return total + (unreadCount ? unreadCount.badged : 0)
// }
// return total
// }, 0)

// const divider = {type: 'divider'}
// const bigTeamsLabel = {isFiltered: !!filter, type: 'bigTeamsLabel'}
// const showBuildATeam = bigTeams.count() === 0

// const rows = smallTeams
// .concat(I.List(showSmallTeamsExpandDivider ? [divider] : []))
// .concat(I.List(bigTeams.count() ? [bigTeamsLabel] : []))
// .concat(bigTeams)

// return {
// bigTeamsBadgeCount,
// rows,
// showBuildATeam,
// showSmallTeamsExpandDivider,
// smallTeamsHiddenBadgeCount,
// smallTeamsHiddenRowCount,
// }
// }
// )

// let _state
// const mapStateToProps = (state: TypedState, {isActiveRoute, routeState}) => {
// _state = state
// const {smallTeamsExpanded} = routeState
// const {
// bigTeamsBadgeCount,
// rows,
// showBuildATeam,
// showSmallTeamsExpandDivider,
// smallTeamsHiddenBadgeCount,
// smallTeamsHiddenRowCount,
// } = getRows(state, smallTeamsExpanded)
// const filter = getFilter(state)

// return {
// _selected: Constants.getSelectedConversation(state),
// bigTeamsBadgeCount,
// filter,
// isActiveRoute,
// isLoading: state.chat.get('inboxUntrustedState') === 'loading',
// rows,
// showBuildATeam,
// showNewConversation: state.chat.inSearch && state.chat.inboxSearch.isEmpty(),
// showSmallTeamsExpandDivider,
// smallTeamsExpanded,
// smallTeamsHiddenBadgeCount,
// smallTeamsHiddenRowCount,
// }
// }

const mapDispatchToProps = (dispatch: Dispatch, {focusFilter, routeState, setRouteState}) => ({
  loadInbox: () => dispatch(Creators.loadInbox()),
  onHotkey: cmd => {
    if (cmd.endsWith('+n')) {
      dispatch(Creators.newChat())
    } else {
      focusFilter()
    }
  },
  onNewChat: () => dispatch(Creators.newChat()),
  onSelect: (conversationIDKey: ?Constants.ConversationIDKey) =>
    conversationIDKey && dispatch(Creators.selectConversation(conversationIDKey, true)),
  onSetFilter: (filter: string) => dispatch(Creators.setInboxFilter(filter)),
  toggleSmallTeamsExpanded: () => setRouteState({smallTeamsExpanded: !routeState.smallTeamsExpanded}),
  onUntrustedInboxVisible: (converationIDKey, rowsVisible) =>
    dispatch(Creators.untrustedInboxVisible(converationIDKey, rowsVisible)),
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

// const mergeProps = (stateProps, dispatchProps, ownProps) => {
// return {
// ...ownProps,
// ...stateProps,
// ...dispatchProps,
// onSelectDown: () => dispatchProps.onSelect(findNextConvo(stateProps.rows, stateProps._selected, 1)),
// onSelectUp: () => dispatchProps.onSelect(findNextConvo(stateProps.rows, stateProps._selected, -1)),
// smallTeamsExpanded: ownProps.smallTeamsExpanded && stateProps.showSmallTeamsExpandDivider, // only collapse if we're actually showing a divider
// }
// }

// Inbox is being loaded a ton by the navigator for some reason. we need a module-level helper
// to not call loadInbox multiple times
const throttleHelper = throttle(cb => cb(), 60 * 1000)

// export default compose(
// withState('filterFocusCount', 'setFilterFocusCount', 0),
// withHandlers({
// focusFilter: props => () => props.setFilterFocusCount(props.filterFocusCount + 1),
// }),
// pausableConnect(mapStateToProps, mapDispatchToProps, mergeProps),
// lifecycle({
// componentDidMount: function() {
// throttleHelper(() => {
// this.props.loadInbox()
// })
// },
// })
// )(Inbox)

// const TEMPInbox = (props: any) => <div>{'aaa'}{props.children}</div>

const getFilter = (state: TypedState) => state.chat.get('inboxFilter')
const getInbox = (state: TypedState) => state.entities.get('inbox')
const getAlwaysShow = (state: TypedState) => state.entities.get('inboxAlwaysShow')
const getSupersededBy = (state: TypedState) => state.entities.get('inboxSupersededBy')
const getIsEmpty = (state: TypedState) => state.entities.get('inboxIsEmpty')

// This chain of reselects is to optimize not having to redo any work
// If the timestamps are the same, we didn't change the list
// If the timestamps did change, and after sorting its still the same, we didn't change the list
// Else map it into the types and render
const getSmallTimestamps = (state: TypedState) => state.entities.getIn(['inboxSmallTimestamps'], I.Map())

const getSortedSmallRows = createSelector([getSmallTimestamps], smallTimestamps =>
  smallTimestamps.sort((a, b) => b - a).keySeq().toArray()
)

const getSmallRows = createImmutableEqualSelector(
  [getSortedSmallRows, getAlwaysShow, getSupersededBy, getIsEmpty],
  (sortedSmallRows, alwaysShow, supersededBy, isEmpty) =>
    sortedSmallRows
      .filter(conversationIDKey => {
        return (
          !supersededBy.get(conversationIDKey) &&
          (!isEmpty.get(conversationIDKey) || alwaysShow.get(conversationIDKey))
        )
      })
      .map(conversationIDKey => ({conversationIDKey, type: 'small'}))
)

const getFilteredSmallRows = createSelector(
  [getSmallTimestamps, getFilter, getInbox, Constants.getYou],
  (smallTimestamps, filter, inbox, you) => {
    const lcFilter = filter.toLowerCase()

    return smallTimestamps
      .keySeq()
      .toArray()
      .filter(convID => {
        const i = inbox.get(convID)
        if (!i) {
          return false
        }
        const passesFilter = scoreFilter(lcFilter, i.teamname || '', i.get('participants').toArray(), you) > 0
        return passesFilter
      })
      .map(conversationIDKey => ({conversationIDKey, type: 'small'}))
  }
)

const mapStateToProps = (state: TypedState, {isActiveRoute, routeState}) => {
  const filter = getFilter(state)

  let smallRows
  if (filter) {
    smallRows = getFilteredSmallRows(state)
  } else {
    smallRows = getSmallRows(state)
  }

  const rows = smallRows // TODO big

  return {
    _selected: Constants.getSelectedConversation(state),
    isActiveRoute,
    bigTeamsBadgeCount: 0, // TODO
    filter,
    rows,
    showBuildATeam: false, // TODO
    showSmallTeamsExpandDivider: true, // TODO
    smallTeamsHiddenBadgeCount: 0, // TODO
    smallTeamsHiddenRowCount: 0, // TODO
  }
}

// This merge props is not spreading on purpose so we never have any random props that might mutate and force a re-render
const mergeProps = (stateProps, dispatchProps, ownProps) => {
  return {
    bigTeamsBadgeCount: stateProps.bigTeamsBadgeCount,
    filter: stateProps.filter,
    loadInbox: dispatchProps.loadInbox,
    onHotkey: dispatchProps.onHotkey,
    onNewChat: dispatchProps.onNewChat,
    onSelect: dispatchProps.onSelect,
    onSelectDown: () => dispatchProps.onSelect(findNextConvo(stateProps.rows, stateProps._selected, 1)),
    onSelectUp: () => dispatchProps.onSelect(findNextConvo(stateProps.rows, stateProps._selected, -1)),
    onSetFilter: dispatchProps.onSetFilter,
    onUntrustedInboxVisible: dispatchProps.onUntrustedInboxVisible,
    rows: stateProps.rows,
    showBuildATeam: stateProps.showBuildATeam,
    showSmallTeamsExpandDivider: stateProps.showSmallTeamsExpandDivider,
    smallTeamsExpanded: ownProps.smallTeamsExpanded && stateProps.showSmallTeamsExpandDivider, // only collapse if we're actually showing a divider
    smallTeamsHiddenBadgeCount: stateProps.smallTeamsHiddenBadgeCount,
    smallTeamsHiddenRowCount: stateProps.smallTeamsHiddenRowCount,
    toggleSmallTeamsExpanded: dispatchProps.toggleSmallTeamsExpanded,
  }
}
let TEMPCOUNT = 1
export default compose(
  pausableConnect(mapStateToProps, mapDispatchToProps, mergeProps),
  lifecycle({
    componentWillReceiveProps: function(nextProps: any, nextState: any) {
      console.log(
        'aaa Render count',
        TEMPCOUNT++,
        this.props,
        nextProps,
        this.state,
        nextState,
        shallowEqualDebug(this.props, nextProps),
        shallowEqualDebug(this.state, nextState)
      )
    },
    componentDidMount: function() {
      // throttleHelper(() => {
      this.props.loadInbox()
      // })
    },
  })
)(Inbox)
