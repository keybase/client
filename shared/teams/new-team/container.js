// @flow
import * as TeamsGen from '../../actions/teams-gen'
import NewTeamDialog from './'
// import upperFirst from 'lodash/upperFirst'
import {
  connect,
  compose,
  lifecycle,
  withStateHandlers,
  withHandlers,
  type TypedState,
} from '../../util/container'

const mapStateToProps = (state: TypedState) => ({
  errorText: null, // TODO upperFirst(state.chat.teamCreationError),
  pending: null, // TODO state.chat.teamCreationPending,
})

const mapDispatchToProps = (dispatch: Dispatch, {navigateUp, routePath}) => ({
  _onCreateNewTeam: (teamname: string) => {
    const rootPath = routePath.take(1)
    const sourceSubPath = routePath.rest()
    const destSubPath = sourceSubPath.butLast()
    dispatch(TeamsGen.createCreateNewTeam({teamname, rootPath, sourceSubPath, destSubPath}))
  },
  _onSetTeamCreationError: (error: string) => {
    dispatch(TeamsGen.createSetTeamCreationError({error}))
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
  withStateHandlers(({name}) => ({name: name || ''}), {
    onNameChange: () => (name: string) => ({name: name.toLowerCase()}),
  }),
  withHandlers({
    onSubmit: ({name, _onCreateNewTeam}) => () => _onCreateNewTeam(name),
  }),
  lifecycle({
    componentDidMount: function() {
      this.props._onSetTeamCreationError('')
    },
  })
)(NewTeamDialog)
