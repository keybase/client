// @flow
import NewTeamDialog from './'
import {connect} from 'react-redux'
import {compose, withState, withHandlers} from 'recompose'

import type {TypedState} from '../../constants/reducer'

const mapStateToProps = (state: TypedState, {routeProps}) => ({
  _onCreateNewTeam: routeProps.onCreateNewTeam,
})

const mapDispatchToProps = (dispatch: Dispatch, {navigateUp}) => ({
  _navigateUp: navigateUp,
  onBack: () => dispatch(navigateUp()),
})

export default compose(
  connect(mapStateToProps, mapDispatchToProps),
  withState('name', 'onNameChange', ''),
  withHandlers({
    onSubmit: ({name, _onCreateNewTeam, _navigateUp}) => () => _onCreateNewTeam(name, _navigateUp),
  })
)(NewTeamDialog)
