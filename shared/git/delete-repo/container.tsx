import * as React from 'react'
import * as GitGen from '../../actions/git-gen'
import * as Constants from '../../constants/git'
import DeleteRepo, {Props} from '.'
import * as Container from '../../util/container'

type OwnProps = Container.RouteProps<{id: string}>

const NullWrapper = (props: Props) => (props.name ? <DeleteRepo {...props} /> : null)

export default Container.connect(
  (state, {routeProps}: OwnProps) => {
    const gitMap = Constants.getIdToGit(state)
    const git = (gitMap && gitMap.get(routeProps.get('id'))) || Constants.makeGitInfo()

    return {
      error: Constants.getError(state),
      name: git.name || '',
      teamname: git.teamname || '',
      waitingKey: Constants.loadingWaitingKey,
    }
  },
  (dispatch: any, {navigateUp}) => ({
    _onDelete: (teamname: string | null, name: string, notifyTeam: boolean) => {
      const deleteAction = teamname
        ? GitGen.createDeleteTeamRepo({name, notifyTeam, teamname})
        : GitGen.createDeletePersonalRepo({name})
      dispatch(deleteAction)
      dispatch(navigateUp())
    },
    onClose: () => dispatch(navigateUp()),
  }),
  (stateProps, dispatchProps, _: OwnProps) => ({
    ...stateProps,
    ...dispatchProps,
    onDelete: (notifyTeam: boolean) =>
      dispatchProps._onDelete(stateProps.teamname, stateProps.name, notifyTeam),
    title: 'Delete repo?',
  })
)(NullWrapper)
