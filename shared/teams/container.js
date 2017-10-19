// @flow
import * as I from 'immutable'
import Teams from './main'
import openURL from '../util/open-url'
import {getTeams} from '../actions/teams/creators'
import {navigateAppend} from '../actions/route-tree'
import {compose, lifecycle, type TypedState, pausableConnect} from '../util/container'
import {openInKBFS} from '../actions/kbfs'
import {injectItem} from '../actions/gregor'
import type {Teamname, TeamListRow} from '../constants/teams'

type StateProps = {
  _teamrows: I.Set<TeamListRow>,
  sawChatBanner: boolean,
  loaded: boolean,
}

const mapStateToProps = (state: TypedState): StateProps => {
  const teamrows = state.entities.getIn(['teams', 'teamrows'], I.Set())
  const loaded = state.entities.getIn(['teams', 'loaded'], false)
  return {
    _teamrows: teamrows,
    sawChatBanner: state.entities.getIn(['teams', 'sawChatBanner'], false),
    loaded,
  }
}

type DispatchProps = {
  onCreateTeam: () => void,
  onHideBanner: () => void,
  onJoinTeam: () => void,
  onManageChat: (teamname: Teamname) => void,
  onOpenFolder: (teamname: Teamname) => void,
  onReadMore: () => void,
  onViewTeam: (teamname: Teamname) => void,
}

const mapDispatchToProps = (dispatch: Dispatch): DispatchProps => ({
  _loadTeams: () => dispatch(getTeams()),
  onCreateTeam: () => {
    dispatch(
      navigateAppend([
        {
          props: {},
          selected: 'showNewTeamDialog',
        },
      ])
    )
  },
  onHideBanner: () => dispatch(injectItem('sawChatBanner', 'true')),
  onJoinTeam: () => {
    dispatch(navigateAppend(['showJoinTeamDialog']))
  },
  onManageChat: (teamname: Teamname) =>
    dispatch(navigateAppend([{props: {teamname}, selected: 'manageChannels'}])),
  onOpenFolder: (teamname: Teamname) => dispatch(openInKBFS(`/keybase/team/${teamname}`)),
  onReadMore: () => {
    openURL('https://keybase.io/blog/introducing-keybase-teams')
  },
  onViewTeam: (teamname: Teamname) => dispatch(navigateAppend([{props: {teamname}, selected: 'team'}])),
})

const mergeProps = (stateProps: StateProps, dispatchProps: DispatchProps) => {
  let teamrows = stateProps._teamrows.toArray()
  teamrows.sort((a, b) => {
    const aName = a.teamName.toUpperCase()
    const bName = b.teamName.toUpperCase()
    if (aName < bName) {
      return -1
    } else if (aName > bName) {
      return 1
    } else {
      return 0
    }
  })

  return {
    sawChatBanner: stateProps.sawChatBanner,
    teamrows,
    loaded: stateProps.loaded,
    ...dispatchProps,
  }
}

export default compose(
  pausableConnect(mapStateToProps, mapDispatchToProps, mergeProps),
  lifecycle({
    componentDidMount: function() {
      this.props._loadTeams()
    },
  })
)(Teams)
