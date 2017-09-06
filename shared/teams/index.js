// @flow
import * as I from 'immutable'
import Render from './render'
import pausableConnect from '../util/pausable-connect'
import openURL from '../util/open-url'
import {getTeams} from '../actions/teams/creators'
import {navigateAppend} from '../actions/route-tree'
import {compose, lifecycle} from 'recompose'

import type {TypedState} from '../constants/reducer'
import type {Teamname} from '../constants/teams'

type StateProps = {
  _teamnames: I.Set<Teamname>,
}

const mapStateToProps = (state: TypedState): StateProps => {
  let teamnames = state.entities.getIn(['teams', 'teamnames'], I.Set())
  return {
    _teamnames: teamnames,
  }
}

type DispatchProps = {
  onCreateTeam: () => void,
  onJoinTeam: () => void,
  onReadDoc: () => void,
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
  onReadDoc: () => {
    openURL('https://keybase.io/docs/command_line/teams_alpha')
  },
})

const mergeProps = (stateProps: StateProps, dispatchProps: DispatchProps) => {
  let teamnames = stateProps._teamnames.toArray()
  // TODO: Sort case-insensitively?
  teamnames.sort()
  return {
    teamnames,
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
)(Render)
