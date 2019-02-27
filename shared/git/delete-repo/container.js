// @flow
import * as React from 'react'
import * as GitGen from '../../actions/git-gen'
import * as Constants from '../../constants/git'
import DeleteRepo from '.'
import {connect, type RouteProps} from '../../util/container'
import flags from '../../util/feature-flags'

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
      ? GitGen.createDeleteTeamRepo({name, notifyTeam, teamname})
      : GitGen.createDeletePersonalRepo({name})
    dispatch(deleteAction)
    if (flags.useNewRouter) {
      dispatch(navigateUp())
    }
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

export default connect<OwnProps, _, _, _, _>(
  mapStateToProps,
  mapDispatchToProps,
  mergeProps
)(NullWrapper)
