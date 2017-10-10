// @flow
import {connect} from 'react-redux'
import * as Creators from '../../actions/teams/creators'
import AddPeople from '.'
import {navigateTo} from '../../actions/route-tree'
import {teamsTab} from '../../constants/tabs'

import type {TypedState} from '../../constants/reducer'

const mapStateToProps = (state: TypedState, {routeProps}) => ({
  name: routeProps.get('teamname'),
})

const mapDispatchToProps = (dispatch: Dispatch, {navigateUp, routeProps}) => ({
  onClose: () => dispatch(navigateUp()),
  onAddPeople: (role: string) => {
    console.warn('in onAddPeople', role)
    dispatch(Creators.addPeopleToTeam(routeProps.get('teamname'), role))
    dispatch(navigateTo([teamsTab]))
    dispatch(Creators.getTeams())
  },
})

export default connect(mapStateToProps, mapDispatchToProps)(AddPeople)
