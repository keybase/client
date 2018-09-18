// @flow
import * as I from 'immutable'
import * as TeamsGen from '../../actions/teams-gen'
import * as Types from '../../constants/types/teams'
import {connect} from '../../util/container'
import {compose, withStateHandlers} from 'recompose'
import RolePicker from '.'
import {getTeamMembers, getRole, isOwner} from '../../constants/teams'

import type {TypedState} from '../../constants/reducer'

type StateProps = {
  _memberInfo: I.Map<string, Types.MemberInfo>,
  you: ?string,
  username: string,
  teamname: string,
  yourRole: Types.MaybeTeamRoleType,
}

const mapStateToProps = (state: TypedState, {routeProps}): StateProps => {
  const teamname = routeProps.get('teamname')
  const username = routeProps.get('username')
  return {
    _memberInfo: getTeamMembers(state, teamname),
    teamname,
    username,
    you: state.config.username,
    yourRole: getRole(state, teamname),
  }
}

// TODO add stuff for edit membership options
type DispatchProps = {|
  _onAddMember: (
    teamname: Types.Teamname,
    username: string,
    role: Types.TeamRoleType,
    sendNotification: boolean
  ) => void,
  _onEditMember: (teamname: Types.Teamname, username: string, role: Types.TeamRoleType) => void,
  onCancel: () => void,
|}

const mapDispatchToProps = (dispatch, {navigateUp}): DispatchProps => ({
  _onAddMember: (teamname, username, role, sendNotification) =>
    dispatch(
      TeamsGen.createAddToTeam({
        teamname,
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
  const user = stateProps._memberInfo.get(stateProps.username)
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
    currentType: user ? user.type : 'reader',
  }
}

export default compose(
  connect(mapStateToProps, mapDispatchToProps, mergeProps),
  withStateHandlers(
    ({currentType}: {currentType: Types.TeamRoleType}) => ({
      selectedRole: currentType,
      sendNotification: false,
      confirm: false,
    }),
    {
      setSelectedRole: () => (selectedRole: Types.TeamRoleType) => ({selectedRole}),
      setSendNotification: () => sendNotification => ({sendNotification}),
      setConfirm: () => confirm => ({confirm}),
    }
  )
)(RolePicker)
