import * as React from 'react'
import * as GitGen from '../../actions/git-gen'
import * as Constants from '../../constants/git'
import DeleteRepo from '.'
import {connect, RouteProps} from '../../util/container'

type OwnProps = RouteProps<
  {
    id: string
  },
  {}
>

const mapStateToProps = (state, {routeProps}) => {
  const gitMap = Constants.getIdToGit(state)
  const git = (gitMap && gitMap.get(routeProps.get('id'))) || Constants.makeGitInfo()

  return {
    error: Constants.getError(state),
    name: git.name || '',
    teamname: git.teamname || '',
    waitingKey: Constants.loadingWaitingKey,
  }
}

const mapDispatchToProps = (dispatch: any, {navigateAppend, navigateUp}) => ({
  _onDelete: (teamname: string | null, name: string, notifyTeam: boolean) => {
    const deleteAction = teamname
      ? GitGen.createDeleteTeamRepo({name, notifyTeam, teamname})
      : GitGen.createDeletePersonalRepo({name})
    dispatch(deleteAction)
    dispatch(navigateUp())
  },
  onClose: () => dispatch(navigateUp()),
})

const mergeProps = (stateProps, dispatchProps, ownProps) => ({
  ...stateProps,
  ...dispatchProps,
  onDelete: (notifyTeam: boolean) =>
    dispatchProps._onDelete(stateProps.teamname, stateProps.name, notifyTeam),
  title: 'Delete repo?',
})

const NullWrapper = props => (props.name ? <DeleteRepo {...props} /> : null)

export default connect(
  mapStateToProps,
  mapDispatchToProps,
  mergeProps
)(NullWrapper)
