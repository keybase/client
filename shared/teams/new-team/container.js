// @flow
import * as TeamsGen from '../../actions/teams-gen'
import NewTeamDialog from './'
import {upperFirst} from 'lodash-es'
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
  errorText: upperFirst(state.teams.teamCreationError),
  pending: state.teams.teamCreationPending,
})

const mapDispatchToProps = (dispatch: Dispatch, {navigateUp, routePath}) => ({
  _onCreateNewTeam: (joinSubteam: boolean, teamname: string) => {
    const rootPath = routePath.take(1)
    const sourceSubPath = routePath.rest()
    const destSubPath = sourceSubPath.butLast()
    dispatch(TeamsGen.createCreateNewTeam({destSubPath, joinSubteam, rootPath, sourceSubPath, teamname}))
  },
  onSetTeamCreationError: (error: string) => {
    dispatch(TeamsGen.createSetTeamCreationError({error}))
  },
  onBack: () => dispatch(navigateUp()),
})

const mergeProps = (stateProps, dispatchProps, ownProps) => {
  const isSubteam = ownProps.routeProps.get('makeSubteam') || false
  const routeName = ownProps.routeProps.get('name') || ''
  const baseTeam = baseTeamname(routeName)
  return {
    ...stateProps,
    ...dispatchProps,
    baseTeam,
    isSubteam,
  }
}

export default compose(
  connect(mapStateToProps, mapDispatchToProps, mergeProps),
  withStateHandlers(({joinSubteam}) => ({joinSubteam: false, name: ''}), {
    onJoinSubteamChange: () => (checked: boolean) => ({joinSubteam: checked}),
    onNameChange: () => (name: string) => ({name: name.toLowerCase()}),
  }),
  withHandlers({
    onSubmit: ({joinSubteam, _onCreateNewTeam}) => (fullName: string) =>
      _onCreateNewTeam(joinSubteam, fullName),
  }),
  lifecycle({
    componentDidMount() {
      this.props.onSetTeamCreationError('')
    },
  })
)(NewTeamDialog)
