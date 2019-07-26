import * as Container from '../../util/container'
import * as TeamsGen from '../../actions/teams-gen'
import * as RouteTreeGen from '../../actions/route-tree-gen'
import NewTeamDialog from './'
import {upperFirst} from 'lodash-es'
import * as WaitingConstants from '../../constants/waiting'
import * as Constants from '../../constants/teams'

type OwnProps = Container.RouteProps<{makeSubteam: boolean; name: string}>

const mapStateToProps = state => ({
  errorText: upperFirst(state.teams.teamCreationError),
  pending: WaitingConstants.anyWaiting(state, Constants.teamCreationWaitingKey),
})

const mapDispatchToProps = dispatch => ({
  _onCreateNewTeam: (joinSubteam: boolean, teamname: string) =>
    dispatch(TeamsGen.createCreateNewTeam({joinSubteam, teamname})),
  onCancel: () => dispatch(RouteTreeGen.createNavigateUp()),
  onSetTeamCreationError: (error: string) => {
    dispatch(TeamsGen.createSetTeamCreationError({error}))
  },
})

const mergeProps = (stateProps, dispatchProps, ownProps: OwnProps) => {
  const isSubteam = Container.getRouteProps(ownProps, 'makeSubteam', false)
  const baseTeam = Container.getRouteProps(ownProps, 'name', '')
  return {
    ...stateProps,
    ...dispatchProps,
    baseTeam,
    isSubteam,
  }
}

export default Container.compose(
  Container.connect(mapStateToProps, mapDispatchToProps, mergeProps),
  Container.withStateHandlers((_: any) => ({joinSubteam: false, name: ''}), {
    onJoinSubteamChange: () => (checked: boolean) => ({joinSubteam: checked}),
    onNameChange: () => (name: string) => ({name: name.toLowerCase()}),
  } as any),
  Container.withHandlers({
    onSubmit: ({joinSubteam, _onCreateNewTeam}) => (fullName: string) =>
      _onCreateNewTeam(joinSubteam, fullName),
  } as any),
  Container.lifecycle({
    componentDidMount() {
      this.props.onSetTeamCreationError('')
    },
  } as any)
)(NewTeamDialog as any)
