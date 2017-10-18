// @flow
import {connect} from 'react-redux'
import * as Creators from '../../actions/teams/creators'
import * as SearchCreators from '../../actions/search/creators'
import AddPeople from '.'
import {HeaderHoc} from '../../common-adapters'
import {navigateAppend} from '../../actions/route-tree'
import {compose, withPropsOnChange} from 'recompose'

import type {TypedState} from '../../constants/reducer'

const mapStateToProps = (state: TypedState, {routeProps}) => ({
  name: routeProps.get('teamname'),
})

const mapDispatchToProps = (dispatch: Dispatch, {navigateUp, routeProps}) => ({
  onAddPeople: (role: string) => {
    dispatch(Creators.addPeopleToTeam(routeProps.get('teamname'), role))
    dispatch(navigateUp())
    dispatch(Creators.getTeams())
    dispatch(SearchCreators.clearSearchResults('addToTeamSearch'))
    dispatch(SearchCreators.setUserInputItems('addToTeamSearch', []))
  },
  onClose: () => dispatch(navigateUp()),
  onOpenRolePicker: (role: string, onComplete: string => void) => {
    dispatch(navigateAppend([{props: {onComplete, selectedRole: role}, selected: 'controlledRolePicker'}]))
  },
})

export default compose(
  connect(mapStateToProps, mapDispatchToProps),
  compose(
    withPropsOnChange(['onExitSearch'], props => ({
      onCancel: () => props.onClose(),
      title: 'Add people',
    })),
    HeaderHoc
  )
)(AddPeople)
