// @flow
import * as I from 'immutable'
import Render from './render'
import pausableConnect from '../util/pausable-connect'
import openURL from '../util/open-url'
import {getTeams} from '../actions/teams/creators'
import {compose, lifecycle} from 'recompose'

import type {TypedState} from '../constants/reducer'
import type {Teamname} from '../constants/teams'

type StateProps = {
  teams: I.Set<Teamname>,
}

const mapStateToProps = (state: TypedState): StateProps => {
  let teamnames = state.entities.getIn(['teams', 'teamNames'], I.Set())
  // TODO: Sort?
  return {
    teams: teamnames,
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
    // TODO: Hook this up. Need to change onShowNewTeamDialog to
    // make its conversationIDKey parameter optional first.
    console.log('onCreateTeam not implemented yet')
  },
  onJoinTeam: () => {
    // TODO: Hook this up once we have a join team dialog.
    console.log('onJoinTeam not implemented yet')
  },
  onReadDoc: () => {
    openURL('https://keybase.io/docs/command_line/teams_alpha')
  },
})

export default compose(
  pausableConnect(mapStateToProps, mapDispatchToProps),
  lifecycle({
    componentDidMount: function() {
      this.props._loadTeams()
    },
  })
)(Render)
