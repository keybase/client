// @flow
import * as Creators from '../../actions/git/creators'
import * as Constants from '../../constants/git'
import DeleteRepo from '.'
import {compose} from 'recompose'
import {connect} from 'react-redux'

import type {TypedState} from '../../constants/reducer'

const mapStateToProps = (state: TypedState, {routeProps}) => {
  const git = Constants.getIdToGit(state).get(routeProps.get('id'))
  return {
    error: Constants.getError(state),
    loading: Constants.getLoading(state),
    name: git.name,
    teamname: git.teamname,
  }
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

const mergeProps = (stateProps, dispatchProps, ownProps) => ({
  ...stateProps,
  ...dispatchProps,
  onDelete: (notifyTeam: boolean) =>
    dispatchProps._onDelete(stateProps.teamname, stateProps.name, notifyTeam),
})

export default compose(connect(mapStateToProps, mapDispatchToProps, mergeProps))(DeleteRepo)
