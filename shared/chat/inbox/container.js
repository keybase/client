// @flow
import * as I from 'immutable'
import * as Constants from '../../constants/chat'
import Inbox from './index'
import pausableConnect from '../../util/pausable-connect'
import {createSelectorCreator, defaultMemoize} from 'reselect'
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

const createImmutableEqualSelector = createSelectorCreator(defaultMemoize, I.is)

const passesFilter = (i: Constants.InboxState, filter: string): boolean => {
  if (!filter) {
    return true
  }

  const names = i.get('participants').toArray()
  // No need to worry about Unicode issues with toLowerCase(), since
  // names can only be ASCII.
  return names.some(n => n.toLowerCase().indexOf(filter.toLowerCase()) >= 0)
}

const filteredInbox = createImmutableEqualSelector(
  [getInbox, getSupersededByState, getAlwaysShow, getFilter],
  (inbox, supersededByState, alwaysShow, filter) => {
    const smallIds = []
    const bigTeamToChannels = {}

    // Partition small and big. Some big will turn into small later if they only have one channel
    inbox.forEach(i => {
      const id = i.conversationIDKey
      if ((!i.isEmpty || alwaysShow.has(id)) && !supersededByState.get(id) && passesFilter(i, filter)) {
        // Keep time cause we sort later
        const value = {id, time: i.time}
        if (!i.teamname) {
          smallIds.push(value)
        } else {
          if (!bigTeamToChannels[i.teamname]) {
            bigTeamToChannels[i.teamname] = {}
          }
          bigTeamToChannels[i.teamname][i.channelname] = value
        }
      }
    })

    // convert any small teams into smallids
    Object.keys(bigTeamToChannels).forEach(team => {
      // only one channel
      const channels = Object.keys(bigTeamToChannels[team])
      if (channels.length === 1) {
        smallIds.push(bigTeamToChannels[team][channels[0]])
        delete bigTeamToChannels[team]
      }
    })

    const sortedSmallIds = smallIds
      .sort((a, b) => {
        if (a.time === b.time) {
          return a.id.localeCompare(b.id)
        }

        return b.time - a.time
      })
      .map(v => v.id)

    return [sortedSmallIds, filter ? {} : bigTeamToChannels]
  }
)
const getRows = createImmutableEqualSelector([filteredInbox, getPending], (inbox, pending) => {
  const [smallIds, bigTeamToChannels] = inbox

  const pids = I.List(pending.keySeq().map(k => ({conversationIDKey: k, type: 'small'})))
  const sids = I.List(smallIds.map(s => ({conversationIDKey: s, type: 'small'})))

  const bigTeams = I.List(
    flatten(
      Object.keys(bigTeamToChannels).sort().map(team => {
        const channels = bigTeamToChannels[team]
        return [
          {
            teamname: team,
            type: 'bigHeader',
          },
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
})

const mapStateToProps = (state: TypedState, {isActiveRoute, smallTeamsExpanded}) => {
  const [allSmallTeams, bigTeams] = getRows(state, smallTeamsExpanded)

  let smallTeams = allSmallTeams
  let showSmallTeamsExpandDivider = false
  if (bigTeams.count() && allSmallTeams.count() > smallteamsCollapsedMaxShown) {
    showSmallTeamsExpandDivider = true
    if (!smallTeamsExpanded) {
      smallTeams = allSmallTeams.slice(0, smallteamsCollapsedMaxShown)
    }
  }

  const bigTeamsBadgeCount = 0 // TODO real number
  const divider = {isBadged: bigTeamsBadgeCount > 0, type: 'divider'}
  const bigTeamsLabel = {type: 'bigTeamsLabel'}
  const showBuildATeam = bigTeams.count() === 0

  const rows = smallTeams
    .concat(I.List(showSmallTeamsExpandDivider ? [divider] : []))
    .concat(I.List(bigTeams.count() ? [bigTeamsLabel] : []))
    .concat(bigTeams)

  return {
    bigTeamsBadgeCount,
    filter: getFilter(state),
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
