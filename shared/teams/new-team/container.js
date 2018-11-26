// @flow
import * as TeamsGen from '../../actions/teams-gen'
import NewTeamDialog from './'
import {upperFirst} from 'lodash-es'
import * as WaitingConstants from '../../constants/waiting'
import * as Constants from '../../constants/teams'
import {
  connect,
  compose,
  lifecycle,
  withStateHandlers,
  withHandlers,
  type RouteProps,
} from '../../util/container'

type OwnProps = RouteProps<{makeSubteam: boolean, name: string}, {}>

const mapStateToProps = state => ({
  errorText: upperFirst(state.teams.teamCreationError),
  pending: WaitingConstants.anyWaiting(state, Constants.teamCreationWaitingKey),
})

const mapDispatchToProps = (dispatch, {navigateUp, routePath}) => ({
  _onCreateNewTeam: (joinSubteam: boolean, teamname: string) => {
    const rootPath = routePath.take(1)
    const sourceSubPath = routePath.rest()
    const destSubPath = sourceSubPath.butLast()
    dispatch(TeamsGen.createCreateNewTeam({destSubPath, joinSubteam, rootPath, sourceSubPath, teamname}))
  },
  onSetTeamCreationError: (error: string) => {
    dispatch(TeamsGen.createSetTeamCreationError({error}))
  },
  onCancel: () => dispatch(navigateUp()),
})

const mergeProps = (stateProps, dispatchProps, ownProps) => {
  const isSubteam = ownProps.routeProps.get('makeSubteam') || false
  const baseTeam = ownProps.routeProps.get('name') || ''
  return {
    ...stateProps,
    ...dispatchProps,
    baseTeam,
    isSubteam,
  }
}

export default compose(
  connect<OwnProps, _, _, _, _>(
    mapStateToProps,
    mapDispatchToProps,
    mergeProps
  ),
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
