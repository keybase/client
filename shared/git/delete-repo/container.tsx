import * as React from 'react'
import * as GitGen from '../../actions/git-gen'
import * as RouteTreeGen from '../../actions/route-tree-gen'
import * as Constants from '../../constants/git'
import DeleteRepo, {Props} from '.'
import * as Container from '../../util/container'

type OwnProps = Container.RouteProps<{id: string}>

const NullWrapper = (props: Props) => (props.name ? <DeleteRepo {...props} /> : null)

export default Container.connect(
  (state, ownProps: OwnProps) => {
    const gitMap = Constants.getIdToGit(state)
    const id = Container.getRouteProps(ownProps, 'id', '')
    const git = gitMap.get(id) || Constants.makeGitInfo()

    return {
      error: Constants.getError(state),
      name: git.name || '',
      teamname: git.teamname || '',
      waitingKey: Constants.loadingWaitingKey,
    }
  },
  dispatch => ({
    _onDelete: (teamname: string | null, name: string, notifyTeam: boolean) => {
      const deleteAction = teamname
        ? GitGen.createDeleteTeamRepo({name, notifyTeam, teamname})
        : GitGen.createDeletePersonalRepo({name})
      dispatch(deleteAction)
      dispatch(RouteTreeGen.createNavigateUp())
    },
    onClose: () => dispatch(RouteTreeGen.createNavigateUp()),
  }),
  (stateProps, dispatchProps, _: OwnProps) => ({
    ...stateProps,
    onClose: dispatchProps.onClose,
    onDelete: (notifyTeam: boolean) =>
      dispatchProps._onDelete(stateProps.teamname, stateProps.name, notifyTeam),
    title: 'Delete repo?',
  })
)(NullWrapper)
