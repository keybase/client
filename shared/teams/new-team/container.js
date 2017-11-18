// @flow
import NewTeamDialog from './'
import {connect, compose, lifecycle, withState, withHandlers, type TypedState} from '../../util/container'
import {createNewTeam, setTeamCreationError} from '../../actions/teams/creators'
import upperFirst from 'lodash/upperFirst'

const mapStateToProps = (state: TypedState) => ({
  errorText: upperFirst(state.chat.teamCreationError),
  pending: state.chat.teamCreationPending,
})

const mapDispatchToProps = (dispatch: Dispatch, {navigateUp, routePath}) => ({
  _onCreateNewTeam: name => {
    const rootPath = routePath.take(1)
    const sourceSubPath = routePath.rest()
    const destSubPath = sourceSubPath.butLast()
    dispatch(createNewTeam(name, rootPath, sourceSubPath, destSubPath))
  },
  _onSetTeamCreationError: error => {
    dispatch(setTeamCreationError(error))
  },
  onBack: () => dispatch(navigateUp()),
})

const mergeProps = (stateProps, dispatchProps, ownProps) => ({
  ...stateProps,
  ...dispatchProps,
  name: ownProps.routeProps.get('name'),
})

export default compose(
  connect(mapStateToProps, mapDispatchToProps, mergeProps),
  withState('name', 'onNameChange', props => props.name || ''),
  withHandlers({
    onSubmit: ({name, _onCreateNewTeam}) => () => _onCreateNewTeam(name),
  }),
  lifecycle({
    componentDidMount: function() {
      this.props._onSetTeamCreationError('')
    },
  })
)(NewTeamDialog)
