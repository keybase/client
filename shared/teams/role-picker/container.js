// @flow
import {connect} from 'react-redux'
import * as I from 'immutable'
import {compose, withState} from 'recompose'
import RolePicker from '.'
import * as Creators from '../../actions/teams/creators'
import * as Constants from '../../constants/teams'

import type {TypedState} from '../../constants/reducer'

type StateProps = {
  _memberInfo: I.Set<Constants.MemberInfo>,
  you: ?string,
  username: string,
  teamname: string,
}

const mapStateToProps = (state: TypedState, {routeProps: {username, teamname}}): StateProps => ({
  _memberInfo: state.entities.getIn(['teams', 'teamNameToMembers', teamname], I.Set()),
  teamname: teamname,
  username: username,
  you: state.config.username,
})

export type Role = null | 'reader' | 'writer' | 'admin' | 'owner'

// TODO add stuff for edit membership options
type DispatchProps = {
  _onAddMember: (
    teamname: Constants.Teamname,
    username: string,
    role: Role,
    sendNotification: boolean
  ) => void,
  onBack: () => void,
}

const mapDispatchToProps = (dispatch: Dispatch, {navigateUp}): DispatchProps => ({
  _onAddMember: (teamname, username, role, sendNotification) =>
    dispatch(Creators.addToTeam(teamname, '', username, role, sendNotification)),
  onBack: () => dispatch(navigateUp()),
})

const mergeProps = (stateProps: StateProps, dispatchProps: DispatchProps, ownProps) => {
  const yourInfo = stateProps._memberInfo.find(member => member.username === stateProps.you)
  return {
    ...stateProps,
    ...dispatchProps,
    ...ownProps,
    allowOwner: yourInfo && yourInfo.type === 'owners',
    onComplete: (role: Role, sendNotification?: boolean) => {
      dispatchProps._onAddMember(stateProps.teamname, stateProps.username, role, sendNotification || false)
      dispatchProps.onBack()
    },
  }
}

export default compose(
  withState('selectedRole', 'setSelectedRole', null),
  withState('sendNotification', 'setSendNotification', false),
  connect(mapStateToProps, mapDispatchToProps, mergeProps)
)(RolePicker)
