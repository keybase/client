// @flow
import * as Container from '../../util/container'
import * as TeamsGen from '../../actions/teams-gen'
import * as RouteTreeGen from '../../actions/route-tree-gen'
import NewTeamDialog from './'
import {upperFirst} from 'lodash-es'
import * as WaitingConstants from '../../constants/waiting'
import * as Constants from '../../constants/teams'
import flags from '../../util/feature-flags'

type OwnProps = Container.RouteProps<{makeSubteam: boolean, name: string}, {}>

const mapStateToProps = state => ({
  errorText: upperFirst(state.teams.teamCreationError),
  pending: WaitingConstants.anyWaiting(state, Constants.teamCreationWaitingKey),
})

const mapDispatchToProps = (dispatch, ownProps) => ({
  _onCreateNewTeam: (joinSubteam: boolean, teamname: string) => {
    if (flags.useNewRouter) {
      dispatch(TeamsGen.createCreateNewTeam({joinSubteam, teamname}))
    } else {
      const rootPath = ownProps.routePath.take(1)
      const sourceSubPath = ownProps.routePath.rest()
      const destSubPath = sourceSubPath.butLast()
      dispatch(TeamsGen.createCreateNewTeam({destSubPath, joinSubteam, rootPath, sourceSubPath, teamname}))
    }
  },
  onCancel: () => dispatch(RouteTreeGen.createNavigateUp()),
  onSetTeamCreationError: (error: string) => {
    dispatch(TeamsGen.createSetTeamCreationError({error}))
  },
})

const mergeProps = (stateProps, dispatchProps, ownProps) => {
  const isSubteam = Container.getRouteProps(ownProps, 'makeSubteam') || false
  const baseTeam = Container.getRouteProps(ownProps, 'name') || ''
  return {
    ...stateProps,
    ...dispatchProps,
    baseTeam,
    isSubteam,
  }
}

export default Container.compose(
  Container.connect<OwnProps, _, _, _, _>(
    mapStateToProps,
    mapDispatchToProps,
    mergeProps
  ),
  Container.withStateHandlers(({joinSubteam}) => ({joinSubteam: false, name: ''}), {
    onJoinSubteamChange: () => (checked: boolean) => ({joinSubteam: checked}),
    onNameChange: () => (name: string) => ({name: name.toLowerCase()}),
  }),
  Container.withHandlers({
    onSubmit: ({joinSubteam, _onCreateNewTeam}) => (fullName: string) =>
      _onCreateNewTeam(joinSubteam, fullName),
  }),
  Container.lifecycle({
    componentDidMount() {
      this.props.onSetTeamCreationError('')
    },
  })
)(NewTeamDialog)
