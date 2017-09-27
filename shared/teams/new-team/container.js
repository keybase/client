// @flow
import NewTeamDialog from './'
import {connect} from 'react-redux'
import {compose, lifecycle, withState, withHandlers} from 'recompose'
import {createNewTeam, setTeamCreationError} from '../../actions/teams/creators'
import {upperFirst} from 'lodash'
import type {TypedState} from '../../constants/reducer'

const mapStateToProps = (state: TypedState) => ({
  errorText: upperFirst(state.chat.teamCreationError),
})

const mapDispatchToProps = (dispatch: Dispatch, {navigateUp}) => ({
  _onCreateNewTeam: name => {
    dispatch(createNewTeam(name))
  },
  _onSetTeamCreationError: error => {
    dispatch(setTeamCreationError(error))
  },
  onBack: () => dispatch(navigateUp()),
})

export default compose(
  connect(mapStateToProps, mapDispatchToProps),
  withState('name', 'onNameChange', ''),
  withHandlers({
    onSubmit: ({name, _onCreateNewTeam}) => () => _onCreateNewTeam(name),
  }),
  lifecycle({
    componentDidMount: function() {
      this.props._onSetTeamCreationError('')
    },
  })
)(NewTeamDialog)
