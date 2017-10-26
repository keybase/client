// @flow
import NewTeamDialog from './'
import {connect, compose, lifecycle, withState, withHandlers, type TypedState} from '../../util/container'
import {createNewTeam, setTeamCreationError} from '../../actions/teams/creators'
import {upperFirst} from 'lodash'

const mapStateToProps = (state: TypedState) => ({
  errorText: upperFirst(state.chat.teamCreationError),
  pending: state.chat.teamCreationPending,
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
