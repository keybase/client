// @flow
import * as TeamsGen from '../../actions/teams-gen'
import EditTeamDescription from '.'
import {
  connect,
  compose,
  withHandlers,
  withProps,
  withStateHandlers,
  type RouteProps,
} from '../../util/container'
import * as Constants from '../../constants/teams'

type OwnProps = RouteProps<{teamname: string}, {}>

const mapStateToProps = (state, {routeProps}) => {
  const teamname = routeProps.get('teamname')
  if (!teamname) {
    throw new Error('There was a problem loading the description page, please report this error.')
  }
  const origDescription = Constants.getTeamPublicitySettings(state, teamname).description
  return {
    origDescription,
    teamname,
  }
}

const mapDispatchToProps = (dispatch, {navigateUp, routeProps}) => ({
  _onSetDescription: (description: string) => {
    dispatch(TeamsGen.createEditTeamDescription({description, teamname: routeProps.get('teamname')}))
    dispatch(navigateUp())
  },
  onClose: () => dispatch(navigateUp()),
})

const mergeProps = (stateProps, dispatchProps, ownProps) => ({
  ...stateProps,
  ...dispatchProps,
})

const ConnectedEditTeamDescription = compose(
  connect<OwnProps, _, _, _, _>(
    mapStateToProps,
    mapDispatchToProps,
    mergeProps
  ),
  withStateHandlers(({origDescription}) => ({description: origDescription}), {
    onChangeDescription: () => description => ({description}),
  }),
  withHandlers({
    onSetDescription: ({description, _onSetDescription}) => () => _onSetDescription(description),
  }),
  withProps(({teamname}) => ({
    waitingKey: Constants.teamWaitingKey(teamname),
  }))
)(EditTeamDescription)

export default ConnectedEditTeamDescription
