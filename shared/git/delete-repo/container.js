// @flow
import * as React from 'react'
import * as GitGen from '../../actions/git-gen'
import * as Constants from '../../constants/git'
import DeleteRepo from '.'
import {connect, type RouteProps} from '../../util/container'

type OwnProps = RouteProps<{id: string}, {}>

const mapStateToProps = (state, {routeProps}) => {
  const gitMap = Constants.getIdToGit(state)
  const git = (gitMap && gitMap.get(routeProps.get('id'))) || {}

  return {
    error: Constants.getError(state),
    name: git.name || '',
    teamname: git.teamname || '',
    waitingKey: Constants.loadingWaitingKey,
  }
}

const mapDispatchToProps = (dispatch: any, {navigateAppend, navigateUp}) => ({
  _onDelete: (teamname: ?string, name: string, notifyTeam: boolean) => {
    const deleteAction = teamname
      ? GitGen.createDeleteTeamRepo({teamname, name, notifyTeam})
      : GitGen.createDeletePersonalRepo({name})
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

const NullWrapper = props => (props.name ? <DeleteRepo {...props} /> : null)

export default connect<OwnProps, _, _, _, _>(
  mapStateToProps,
  mapDispatchToProps,
  mergeProps
)(NullWrapper)
