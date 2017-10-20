// @flow
import * as Creators from '../../actions/git/creators'
import * as Constants from '../../constants/git'
import DeleteRepo from '.'
import {compose, renderNothing, branch, connect, type TypedState} from '../../util/container'

const missingGit = {error: 'NoGit', loading: false, name: '', teamname: ''}

const mapStateToProps = (state: TypedState, {routeProps}) => {
  const gitMap = Constants.getIdToGit(state)
  const git = gitMap ? gitMap.get(routeProps.get('id')) : null

  return git
    ? {
        error: Constants.getError(state),
        loading: Constants.getLoading(state),
        name: git.name,
        teamname: git.teamname,
      }
    : missingGit
}

const mapDispatchToProps = (dispatch: any, {navigateAppend, navigateUp}) => ({
  _onDelete: (teamname: ?string, name: string, notifyTeam: boolean) => {
    const deleteAction = teamname
      ? Creators.deleteTeamRepo(teamname, name, notifyTeam)
      : Creators.deletePersonalRepo(name)
    dispatch(deleteAction)
  },
  onClose: () => dispatch(navigateUp()),
})

const mergeProps = (stateProps, dispatchProps, ownProps) =>
  stateProps === missingGit
    ? missingGit
    : {
        ...stateProps,
        ...dispatchProps,
        onDelete: (notifyTeam: boolean) =>
          dispatchProps._onDelete(stateProps.teamname, stateProps.name, notifyTeam),
      }

export default compose(
  connect(mapStateToProps, mapDispatchToProps, mergeProps),
  branch(props => props === missingGit, renderNothing)
)(DeleteRepo)
