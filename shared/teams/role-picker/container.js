// @flow
import * as I from 'immutable'
import * as TeamsGen from '../../actions/teams-gen'
import * as Types from '../../constants/types/teams'
import {connect} from 'react-redux'
import {compose, withStateHandlers} from 'recompose'
import RolePicker from '.'
import {getRole, isOwner} from '../../constants/teams'

import type {TypedState} from '../../constants/reducer'

type StateProps = {
  _memberInfo: I.Set<Types.MemberInfo>,
  you: ?string,
  username: string,
  teamname: string,
  yourRole: ?Types.TeamRoleType,
}

const mapStateToProps = (state: TypedState, {routeProps}): StateProps => {
  const teamname = routeProps.get('teamname')
  const username = routeProps.get('username')
  return {
    _memberInfo: state.teams.getIn(['teamNameToMembers', teamname], I.Set()),
    teamname,
    username,
    you: state.config.username,
    yourRole: getRole(state, teamname),
  }
}

// TODO add stuff for edit membership options
type DispatchProps = {
  _onAddMember: (
    teamname: Types.Teamname,
    username: string,
    role: Types.TeamRoleType,
    sendNotification: boolean
  ) => void,
  _onEditMember: (teamname: Types.Teamname, username: string, role: Types.TeamRoleType) => void,
  onCancel: () => void,
}

const mapDispatchToProps = (dispatch: Dispatch, {navigateUp}): DispatchProps => ({
  _onAddMember: (teamname, username, role, sendNotification) =>
    dispatch(
      TeamsGen.createAddToTeam({
        teamname,
        email: '',
        username,
        role,
        sendChatNotification: sendNotification,
      })
    ),
  _onEditMember: (teamname, username, role) =>
    dispatch(TeamsGen.createEditMembership({teamname, username, role})),
  onCancel: () => dispatch(navigateUp()),
})

const mergeProps = (stateProps: StateProps, dispatchProps: DispatchProps, ownProps) => {
  const user = stateProps._memberInfo.find(member => member.username === stateProps.username)
  const onComplete = (role: Types.TeamRoleType, sendNotification?: boolean) => {
    if (user) {
      dispatchProps._onEditMember(stateProps.teamname, stateProps.username, role)
    } else {
      dispatchProps._onAddMember(stateProps.teamname, stateProps.username, role, sendNotification || false)
    }
    dispatchProps.onCancel()
  }
  const showSendNotification = !user
  return {
    ...stateProps,
    ...dispatchProps,
    ...ownProps,
    allowOwner: isOwner(stateProps.yourRole),
    onComplete,
    showSendNotification,
    currentType: user && user.type,
  }
}

export default compose(
  connect(mapStateToProps, mapDispatchToProps, mergeProps),
  withStateHandlers(
    ({currentType}) => ({selectedRole: currentType, sendNotification: false, confirm: false}),
    {
      setSelectedRole: () => selectedRole => ({selectedRole}),
      setSendNotification: () => sendNotification => ({sendNotification}),
      setConfirm: () => confirm => ({confirm}),
    }
  )
)(RolePicker)
