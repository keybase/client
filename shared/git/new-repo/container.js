// @flow
import * as Creators from '../../actions/git/creators'
import * as I from 'immutable'
import NewRepo from '.'
import {compose, lifecycle} from 'recompose'
import {connect} from 'react-redux'
import {getTeams} from '../../actions/teams/creators'
import {navigateTo} from '../../actions/route-tree'
import {teamsTab} from '../../constants/tabs'

import type {TypedState} from '../../constants/reducer'

const mapStateToProps = (state: TypedState, {routeProps}) => ({
  isTeam: routeProps.isTeam,
  teams: state.entities.getIn(['teams', 'teamnames'], I.Set()),
})

const mapDispatchToProps = (dispatch: any, {navigateAppend, navigateUp, isTeam}) => ({
  _loadTeams: () => dispatch(getTeams()),
  onClose: () => dispatch(navigateUp()),
  onCreate: (name: string, teamname: ?string, notifyTeam: boolean) => {
    const createAction = isTeam && teamname
      ? Creators.createTeamRepo(teamname, name, notifyTeam)
      : Creators.createPersonalRepo(name)
    dispatch(createAction)
    dispatch(navigateUp())
  },
  onNewTeam: () => dispatch(navigateTo([teamsTab], ['showNewTeamDialog'])),
})

export default compose(
  connect(mapStateToProps, mapDispatchToProps),
  lifecycle({
    componentDidMount: function() {
      this.props._loadTeams()
    },
  })
)(NewRepo)
