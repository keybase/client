// @flow
import * as TeamsGen from '../../actions/teams-gen'
import * as RouteTreeGen from '../../actions/route-tree-gen'
import EditTeamDescription from '.'
import * as Container from '../../util/container'
import * as Constants from '../../constants/teams'

type OwnProps = Container.RouteProps<{teamname: string}, {}>

const mapStateToProps = (state, ownProps) => {
  const teamname = Container.getRouteProps(ownProps, 'teamname')
  if (!teamname) {
    throw new Error('There was a problem loading the description page, please report this error.')
  }
  const origDescription = Constants.getTeamPublicitySettings(state, teamname).description
  return {
    origDescription,
    teamname,
  }
}

const mapDispatchToProps = (dispatch, ownProps) => ({
  _onSetDescription: (description: string) => {
    dispatch(
      TeamsGen.createEditTeamDescription({
        description,
        teamname: Container.getRouteProps(ownProps, 'teamname'),
      })
    )
    dispatch(RouteTreeGen.createNavigateUp())
  },
  onClose: () => dispatch(RouteTreeGen.createNavigateUp()),
})

const mergeProps = (stateProps, dispatchProps, ownProps) => ({
  ...stateProps,
  ...dispatchProps,
})

const ConnectedEditTeamDescription = Container.compose(
  Container.connect<OwnProps, _, _, _, _>(
    mapStateToProps,
    mapDispatchToProps,
    mergeProps
  ),
  Container.withStateHandlers(({origDescription}) => ({description: origDescription}), {
    onChangeDescription: () => description => ({description}),
  }),
  Container.withHandlers({
    onSetDescription: ({description, _onSetDescription}) => () => _onSetDescription(description),
  }),
  Container.withProps(({teamname}) => ({
    waitingKey: Constants.teamWaitingKey(teamname),
  }))
)(EditTeamDescription)

export default ConnectedEditTeamDescription
