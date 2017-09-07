// @flow
import * as I from 'immutable'
import * as Constants from '../../constants/chat'
import Inbox from './index'
import pausableConnect from '../../util/pausable-connect'
import {createSelectorCreator, defaultMemoize} from 'reselect'
import {
  loadInbox,
  newChat,
  untrustedInboxVisible,
  setInboxFilter,
  selectConversation,
} from '../../actions/chat/creators'
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

const createImmutableEqualSelector = createSelectorCreator(defaultMemoize, I.is)

const passesStringFilter = (filter: string, toCheck: string): boolean => {
  // No need to worry about Unicode issues with toLowerCase(), since
  // names can only be ASCII.
  return toCheck.toLowerCase().indexOf(filter.toLowerCase()) >= 0
}

const passesParticipantFilter = (participants: I.List<string>, filter: string, you: ?string): boolean => {
  if (!filter) {
    return true
  }

  // don't filter you out if its just a convo with you!
  const justYou = participants.count() === 1 && participants.first() === you
  const names = justYou ? participants : participants.filter(p => p !== you)
  return names.some(n => passesStringFilter(filter, n))
}

const filteredInbox = createImmutableEqualSelector(
  [getInbox, getSupersededByState, getAlwaysShow, getFilter, Constants.getYou],
  (inbox, supersededByState, alwaysShow, filter, you) => {
    const smallIds = []
    const bigTeamToChannels = {}

    // Partition small and big. Some big will turn into small later if they only have one channel
    // Filter out any small teams that don't match
    inbox.forEach(i => {
      const id = i.conversationIDKey
      if ((!i.isEmpty || alwaysShow.has(id)) && !supersededByState.get(id)) {
        // Keep time cause we sort later
        const value = {id, time: i.time}
        if (!i.teamname && passesParticipantFilter(i.get('participants'), filter, you)) {
          smallIds.push(value)
        } else {
          if (!bigTeamToChannels[i.teamname]) {
            bigTeamToChannels[i.teamname] = {}
          }
          // Do we have the real name yet?
          const channel = i.channelname === '-' ? id : i.channelname
          bigTeamToChannels[i.teamname][channel] = value
        }
      }
    })

    // convert any small teams into smallids
    Object.keys(bigTeamToChannels).forEach(team => {
      // only one channel
      const channels = Object.keys(bigTeamToChannels[team])
      if (channels.length === 1) {
        if (passesParticipantFilter(I.List.of(team), filter, you)) {
          smallIds.push(bigTeamToChannels[team][channels[0]])
        }
        delete bigTeamToChannels[team]
      }
    })

    // Filter out big teams
    if (filter) {
      Object.keys(bigTeamToChannels).forEach(team => {
        // teamname doesn't pass
        if (!passesStringFilter(filter, team)) {
          const channels = Object.keys(bigTeamToChannels[team])
          channels.forEach(c => {
            if (!passesStringFilter(filter, c)) {
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

    const sortedSmallIds = smallIds
      .sort((a, b) => {
        if (a.time === b.time) {
          return a.id.localeCompare(b.id)
        }

        return b.time - a.time
      })
      .map(v => v.id)

    return [sortedSmallIds, bigTeamToChannels]
  }
)
const getRows = createImmutableEqualSelector(
  [filteredInbox, getPending, getFilter],
  (inbox, pending, filter) => {
    const [smallIds, bigTeamToChannels] = inbox

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
              conversationIDKey: channels[channel].id,
              teamname: team,
              type: 'big',
            }))
          )
        })
      )
    )

    const allSmallTeams = pids.concat(sids)
    return [allSmallTeams, bigTeams]
  }
)

const mapStateToProps = (state: TypedState, {isActiveRoute, smallTeamsExpanded}) => {
  const [allSmallTeams, bigTeams] = getRows(state, smallTeamsExpanded)
  const filter = getFilter(state)

  let smallTeams = allSmallTeams
  let showSmallTeamsExpandDivider = false

  if (!filter && bigTeams.count() && allSmallTeams.count() > smallteamsCollapsedMaxShown) {
    showSmallTeamsExpandDivider = true
    if (!smallTeamsExpanded) {
      smallTeams = allSmallTeams.slice(0, smallteamsCollapsedMaxShown)
    }
  }

  const bigTeamsBadgeCount = 0 // TODO real number
  const divider = {isBadged: bigTeamsBadgeCount > 0, type: 'divider'}
  const bigTeamsLabel = {isFiltered: !!filter, type: 'bigTeamsLabel'}
  const showBuildATeam = bigTeams.count() === 0

  const rows = smallTeams
    .concat(I.List(showSmallTeamsExpandDivider ? [divider] : []))
    .concat(I.List(bigTeams.count() ? [bigTeamsLabel] : []))
    .concat(bigTeams)

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
  }
}

const mapDispatchToProps = (dispatch: Dispatch, {focusFilter}) => ({
  loadInbox: () => dispatch(loadInbox()),
  onHotkey: cmd => {
    if (cmd.endsWith('+n')) {
      dispatch(newChat([]))
    } else {
      focusFilter()
    }
  },
  onNewChat: () => dispatch(newChat([])),
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
