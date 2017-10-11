// @flow
import {connect} from 'react-redux'
import * as Creators from '../../actions/teams/creators'
import AddPeople from '.'
import {navigateTo} from '../../actions/route-tree'
import {teamsTab} from '../../constants/tabs'

import type {TypedState} from '../../constants/reducer'

const mapStateToProps = (state: TypedState, {routeProps}) => {
  const selectedUsersToAdd = state.entities.getIn(['search', 'searchKeyToUserInputItemIds', 'addToTeamSearch'], [])
  const usersAlreadyInTeam = state.entities.getIn(['teams', 'teamNameToMemberUsernames', routeProps.get('teamname')])
  const tooManyUsers = selectedUsersToAdd.size + usersAlreadyInTeam.size >= 20
  return {
    name: routeProps.get('teamname'),
    tooManyUsers,
  }
}

const mapDispatchToProps = (dispatch: Dispatch, {navigateUp, routeProps}) => ({
  onClose: () => dispatch(navigateUp()),
  onAddPeople: (role: string) => {
    dispatch(Creators.addPeopleToTeam(routeProps.get('teamname'), role))
    dispatch(navigateTo([teamsTab]))
    dispatch(Creators.getTeams())
  },
})

export default connect(mapStateToProps, mapDispatchToProps)(AddPeople)
