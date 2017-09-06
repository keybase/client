// @flow
import NewTeamDialog from './'
import {connect} from 'react-redux'
import {compose, withState, withHandlers} from 'recompose'
import {createNewTeam} from '../../actions/teams/creators'

const mapDispatchToProps = (dispatch: Dispatch, {navigateUp}) => ({
  _onCreateNewTeam: name => {
    dispatch(createNewTeam(name))
    dispatch(navigateUp())
  },
  onBack: () => dispatch(navigateUp()),
})

export default compose(
  connect(null, mapDispatchToProps),
  withState('name', 'onNameChange', ''),
  withHandlers({
    onSubmit: ({name, _onCreateNewTeam}) => () => _onCreateNewTeam(name),
  })
)(NewTeamDialog)
