// @flow
import * as I from 'immutable'
import Teams from './main'
import pausableConnect from '../util/pausable-connect'
import openURL from '../util/open-url'
import {getTeams} from '../actions/teams/creators'
import {navigateAppend} from '../actions/route-tree'
import {compose, lifecycle} from 'recompose'
import {openInKBFS} from '../actions/kbfs'

import type {TypedState} from '../constants/reducer'
import type {Teamname} from '../constants/teams'

type StateProps = {
  _teamnames: I.Set<Teamname>,
  loaded: boolean,
}

const mapStateToProps = (state: TypedState): StateProps => {
  const teamnames = state.entities.getIn(['teams', 'teamnames'], I.Set())
  const loaded = state.entities.getIn(['teams', 'loaded'], false)
  return {
    _teamnames: teamnames,
    loaded,
  }
}

type DispatchProps = {
  onCreateTeam: () => void,
  onJoinTeam: () => void,
  onReadMore: () => void,
  onOpenFolder: (teamname: Teamname) => void,
  onManageChat: (teamname: Teamname) => void,
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
  onJoinTeam: () => {
    // TODO: Hook this up once we have a join team dialog.
    console.log('onJoinTeam not implemented yet')
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
  let teamnames = stateProps._teamnames.toArray()
  // TODO: Sort case-insensitively?
  teamnames.sort()
  return {
    teamnames,
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
