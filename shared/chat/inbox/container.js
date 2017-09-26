// @flow
// import * as React from 'react'
import * as I from 'immutable'
import * as Constants from '../../constants/chat'
import Inbox from './index'
import pausableConnect from '../../util/pausable-connect'
import * as Creators from '../../actions/chat/creators'
import {createSelector} from 'reselect'
import {compose, lifecycle, withState, withHandlers} from 'recompose'
import throttle from 'lodash/throttle'
import createImmutableEqualSelector from '../../util/create-immutable-equal-selector'

import type {TypedState} from '../../constants/reducer'

const smallTeamsCollapsedMaxShown = 5
const getPending = (state: TypedState) => state.chat.get('pendingConversations')
const passesStringFilter = (filter: string, toCheck: string): boolean => toCheck.indexOf(filter) >= 0

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

const getFilter = (state: TypedState) => state.chat.get('inboxFilter').toLowerCase()
const getInbox = (state: TypedState) => state.entities.get('inbox')
const getAlwaysShow = (state: TypedState) => state.entities.get('inboxAlwaysShow')
const getSupersededBy = (state: TypedState) => state.entities.get('inboxSupersededBy')
const getIsEmpty = (state: TypedState) => state.entities.get('inboxIsEmpty')

// This chain of reselects is to optimize not having to redo any work
// If the timestamps are the same, we didn't change the list
// If the timestamps did change, and after sorting its still the same, we didn't change the list
// Else map it into the types and render
const getSmallTimestamps = (state: TypedState) => {
  DEBUG_SELECTORS && console.log('aaa 2 getSmallTimestamps  ')
  return state.entities.getIn(['inboxSmallTimestamps'], I.Map())
}

const getSortedSmallRows = createSelector([getSmallTimestamps], smallTimestamps => {
  DEBUG_SELECTORS && console.log('aaa 3 getSortedSmallRows ', smallTimestamps)
  return smallTimestamps.sort((a, b) => b - a).keySeq()
})

const getSmallRows = createImmutableEqualSelector(
  [getSortedSmallRows, getPending, getAlwaysShow, getSupersededBy, getIsEmpty],
  (sortedSmallRows, pending, alwaysShow, supersededBy, isEmpty) => {
    DEBUG_SELECTORS && console.log('aaa 4 getSmallRows', sortedSmallRows, alwaysShow, supersededBy, isEmpty)
    const pendingRows = pending.keySeq().toArray().map(k => ({conversationIDKey: k, type: 'small'}))
    const smallRows = sortedSmallRows
      .toArray()
      .filter(conversationIDKey => {
        return (
          !supersededBy.get(conversationIDKey) &&
          (!isEmpty.get(conversationIDKey) || alwaysShow.get(conversationIDKey))
        )
      })
      .map(conversationIDKey => ({conversationIDKey, type: 'small'}))
    return pendingRows.concat(smallRows)
  }
)

const getFilteredSmallRows = createSelector(
  [getSmallTimestamps, getFilter, getInbox, Constants.getYou],
  (smallTimestamps, lcFilter, inbox, you) => {
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

const getInboxBigChannels = (state: TypedState) => state.entities.get('inboxBigChannels')
const getInboxBigChannelsToTeam = (state: TypedState) => state.entities.get('inboxBigChannelsToTeam')
// Build a map of [team: {channel: id}]
const getTeamToChannel = createSelector(
  [getInboxBigChannels, getInboxBigChannelsToTeam],
  (inboxBigChannels, inboxBigChannelsToTeam) => {
    DEBUG_SELECTORS && console.log('aaa 7 getTeamToChannel ', inboxBigChannels, inboxBigChannelsToTeam)
    const teamToChannels = {}
    inboxBigChannelsToTeam.forEach((teamname, id) => {
      if (!teamToChannels[teamname]) {
        teamToChannels[teamname] = {}
      }
      teamToChannels[teamname][inboxBigChannels.get(id)] = id
    })
    return teamToChannels
  }
)

const getFilteredBigRows = createSelector([getTeamToChannel, getFilter], (teamToChannels, lcFilter) => {
  const rows = []
  Object.keys(teamToChannels).sort().forEach(teamname => {
    const teamPassed = passesStringFilter(lcFilter, teamname.toLowerCase())
    const channels = teamToChannels[teamname]
    Object.keys(channels).sort().forEach(channelname => {
      const channelPassed = teamPassed || passesStringFilter(lcFilter, channelname.toLowerCase())
      if (channelPassed) {
        rows.push({
          channelname,
          conversationIDKey: channels[channelname],
          teamname,
          type: 'big',
        })
      }
    })
  })

  return rows
})

const getFilteredRows = createSelector([getFilteredSmallRows, getFilteredBigRows], (smallRows, bigRows) => {
  return smallRows.concat(bigRows)
})

const getBigRows = createSelector([getTeamToChannel], teamToChannels => {
  DEBUG_SELECTORS && console.log('aaa 6 getBigRows', teamToChannels)
  const rows = []
  Object.keys(teamToChannels).sort().forEach(teamname => {
    rows.push({
      teamname,
      type: 'bigHeader',
    })

    const channels = teamToChannels[teamname]
    Object.keys(channels).sort().forEach(channelname => {
      rows.push({
        channelname,
        conversationIDKey: channels[channelname],
        teamname,
        type: 'big',
      })
    })
  })

  return rows
})

const smallTeamsPassThrough = (_, smallTeamsExpanded) => smallTeamsExpanded

const DEBUG_SELECTORS = true

// Get big and small and deal with the divider hiding small rows
const getRowsAndMetadata = createSelector(
  [getSmallRows, smallTeamsPassThrough, getBigRows],
  (smallRows, smallTeamsExpanded, bigRows) => {
    DEBUG_SELECTORS && console.log('aaa 5 getRows', smallRows, bigRows, smallTeamsExpanded)
    const smallTeamsRowsToHideCount = Math.max(0, smallRows.length - smallTeamsCollapsedMaxShown)
    const smallToShow = smallTeamsExpanded ? smallRows : smallRows.slice(0, smallTeamsCollapsedMaxShown)

    const showSmallTeamsExpandDivider = !!(bigRows.length && smallTeamsRowsToHideCount)
    const divider = showSmallTeamsExpandDivider ? [{type: 'divider'}] : []

    const rows = smallToShow.concat(divider, bigRows)

    return {
      rows,
      showBuildATeam: bigRows.length === 0,
      showSmallTeamsExpandDivider,
    }
  }
)

const mapStateToProps = (state: TypedState, {isActiveRoute, routeState}) => {
  DEBUG_SELECTORS && console.log('aaa 1 mapStateToProps')

  const filter = getFilter(state)
  const smallTeamsExpanded = routeState.get('smallTeamsExpanded')

  let rows
  let showSmallTeamsExpandDivider = false
  let showBuildATeam = false

  if (filter) {
    rows = getFilteredRows(state)
  } else {
    const rmd = getRowsAndMetadata(state, smallTeamsExpanded)
    showSmallTeamsExpandDivider = rmd.showSmallTeamsExpandDivider
    rows = rmd.rows
    showBuildATeam = rmd.showBuildATeam
  }

  const TEMP = {
    filter,
    isActiveRoute,
    rows,
    showBuildATeam,
    showSmallTeamsExpandDivider,
    smallTeamsExpanded: smallTeamsExpanded && showSmallTeamsExpandDivider, // only collapse if we're actually showing a divider,
  }

  DEBUG_SELECTORS && console.log('aaa mapStateToProps', TEMP)
  return TEMP
}

const mapDispatchToProps = (dispatch: Dispatch, {focusFilter, routeState, setRouteState}) => ({
  _onSelectNext: (rows, direction) => dispatch(Creators.selectNext(rows, direction)),
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
  onUntrustedInboxVisible: (converationIDKey, rowsVisible) =>
    dispatch(Creators.untrustedInboxVisible(converationIDKey, rowsVisible)),
  toggleSmallTeamsExpanded: () => setRouteState({smallTeamsExpanded: !routeState.get('smallTeamsExpanded')}),
})

// This merge props is not spreading on purpose so we never have any random props that might mutate and force a re-render
const mergeProps = (stateProps, dispatchProps, ownProps) => {
  DEBUG_SELECTORS && console.log('aaa 8 mergeProps')
  return {
    filter: stateProps.filter,
    loadInbox: dispatchProps.loadInbox,
    onHotkey: dispatchProps.onHotkey,
    onNewChat: dispatchProps.onNewChat,
    onSelect: dispatchProps.onSelect,
    // TODO move this into action so we don't need to plumb selected
    onSelectDown: () => {
      const filteredRows = stateProps.rows.filter(r => ['small', 'big'].includes(r.type))
      dispatchProps._onSelectNext(filteredRows, 1)
    },
    onSelectUp: () => {
      const filteredRows = stateProps.rows.filter(r => ['small', 'big'].includes(r.type))
      dispatchProps._onSelectNext(filteredRows, -1)
    },
    onSetFilter: dispatchProps.onSetFilter,
    onUntrustedInboxVisible: dispatchProps.onUntrustedInboxVisible,
    rows: stateProps.rows,
    showBuildATeam: stateProps.showBuildATeam,
    smallTeamsExpanded: stateProps.smallTeamsExpanded,
    toggleSmallTeamsExpanded: dispatchProps.toggleSmallTeamsExpanded,
  }
}

// Inbox is being loaded a ton by the navigator for some reason. we need a module-level helper
// to not call loadInbox multiple times
const throttleHelper = throttle(cb => cb(), 60 * 1000)

let TEMPCOUNT = 1
export default compose(
  withState('filterFocusCount', 'setFilterFocusCount', 0),
  withHandlers({
    focusFilter: props => () => props.setFilterFocusCount(props.filterFocusCount + 1),
  }),
  pausableConnect(mapStateToProps, mapDispatchToProps, mergeProps),
  lifecycle({
    componentDidMount: function() {
      throttleHelper(() => {
        this.props.loadInbox()
      })
    },
    componentDidUpdate: function(prevProps, prevState) {
      // TODO remove
      DEBUG_SELECTORS &&
        console.log('aaa Render count', TEMPCOUNT++, this.props, prevProps, this.state, prevState)
    },
  })
)(Inbox)
