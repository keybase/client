// @flow
import * as TeamsGen from '../../actions/teams-gen'
import NewTeamDialog from './'
import upperFirst from 'lodash/upperFirst'
import {
  connect,
  compose,
  lifecycle,
  withStateHandlers,
  withHandlers,
  type TypedState,
} from '../../util/container'
import {baseTeamname} from '../../constants/teamname'

const mapStateToProps = (state: TypedState) => ({
  errorText: upperFirst(state.entities.teams.teamCreationError),
  pending: state.entities.teams.teamCreationPending,
})

const mapDispatchToProps = (dispatch: Dispatch, {navigateUp, routePath}) => ({
  _onCreateNewTeam: (joinSubteam: boolean, teamname: string) => {
    const rootPath = routePath.take(1)
    const sourceSubPath = routePath.rest()
    const destSubPath = sourceSubPath.butLast()
    dispatch(TeamsGen.createCreateNewTeam({destSubPath, joinSubteam, rootPath, sourceSubPath, teamname}))
  },
  _onSetTeamCreationError: (error: string) => {
    dispatch(TeamsGen.createSetTeamCreationError({error}))
  },
  onBack: () => dispatch(navigateUp()),
})

const mergeProps = (stateProps, dispatchProps, ownProps) => {
  const isSubteam = ownProps.routeProps.get('makeSubteam') || false
  const routeName = ownProps.routeProps.get('name') || ''
  const name = routeName.concat(isSubteam ? '.' : '')
  const baseTeam = baseTeamname(name)
  return {
    ...stateProps,
    ...dispatchProps,
    baseTeam,
    isSubteam,
    name,
  }
}

export default compose(
  connect(mapStateToProps, mapDispatchToProps, mergeProps),
  withStateHandlers(({joinSubteam, name}) => ({joinSubteam: false, name: name || ''}), {
    onJoinSubteamChange: () => (checked: boolean) => ({joinSubteam: checked}),
    onNameChange: () => (name: string) => ({name: name.toLowerCase()}),
  }),
  withHandlers({
    onSubmit: ({joinSubteam, name, _onCreateNewTeam}) => () => _onCreateNewTeam(joinSubteam, name),
  }),
  lifecycle({
    componentDidMount: function() {
      this.props._onSetTeamCreationError('')
    },
  })
)(NewTeamDialog)
