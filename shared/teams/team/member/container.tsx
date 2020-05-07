import * as React from 'react'
import * as Types from '../../../constants/types/teams'
import * as Chat2Gen from '../../../actions/chat2-gen'
import * as RouteTreeGen from '../../../actions/route-tree-gen'
import * as TeamsGen from '../../../actions/teams-gen'
import * as Container from '../../../util/container'
import {createShowUserProfile} from '../../../actions/profile-gen'
import {TeamMember, MemberProps} from '.'
import * as Constants from '../../../constants/teams'
import {anyWaiting} from '../../../constants/waiting'

type OwnProps = Container.RouteProps<{username: string; teamID: Types.TeamID}>

type State = {
  rolePickerOpen: boolean
}

type Props = MemberProps & {
  onEditRole: (role: Types.TeamRoleType) => void
}

export class TeamMemberStateWrapper extends React.Component<Props, State> {
  static navigationOptions = {
    header: undefined,
  }
  state = {
    rolePickerOpen: false,
  }

  render() {
    return (
      <TeamMember
        {...this.props}
        isRolePickerOpen={this.state.rolePickerOpen}
        onCancelRolePicker={() => this.setState({rolePickerOpen: false})}
        onEditMembership={() => this.setState({rolePickerOpen: true})}
        onConfirmRolePicker={role => {
          this.props.onEditRole(role)
          this.setState({rolePickerOpen: false})
        }}
      />
    )
  }
}

export default Container.connect(
  (state: Container.TypedState, ownProps: OwnProps) => {
    const username = Container.getRouteProps(ownProps, 'username', '')
    const teamID = Container.getRouteProps(ownProps, 'teamID', Types.noTeamID)
    const teamDetails = Constants.getTeamDetails(state, teamID)
    const {teamname} = Constants.getTeamMeta(state, teamID)
    const disabledReasonsForRolePicker = Constants.getDisabledReasonsForRolePicker(state, teamID, username)
    const error = state.teams.errorInEditMember
    return {
      _memberInfo: teamDetails.members,
      _username: username,
      _you: state.config.username,
      disabledReasonsForRolePicker,
      error: error.username === username && error.teamID === teamID ? error.error : '',
      follower: state.config.followers.has(username),
      following: state.config.following.has(username),
      loading: anyWaiting(state, Constants.teamWaitingKey(teamID)),
      teamID,
      teamname,
      yourOperations: Constants.getCanPerform(state, teamname),
    }
  },
  (dispatch: Container.TypedDispatch, ownProps: OwnProps) => ({
    _onChat: (username: string) => {
      username &&
        dispatch(Chat2Gen.createPreviewConversation({participants: [username], reason: 'memberView'}))
    },
    _onEditRole: (teamID: Types.TeamID, username: string, role: Types.TeamRoleType) =>
      dispatch(TeamsGen.createEditMembership({role, teamID, usernames: [username]})),
    _onRemoveMember: (teamID: Types.TeamID, username: string) => {
      dispatch(
        RouteTreeGen.createNavigateAppend({
          path: [{props: {members: [username], teamID}, selected: 'teamReallyRemoveMember'}],
        })
      )
    },
    onBack: () => dispatch(RouteTreeGen.createNavigateUp()),
    onBlur: () => dispatch(TeamsGen.createSetEditMemberError(Constants.emptyErrorInEditMember)),
    onLeaveTeam: () => {
      dispatch(
        RouteTreeGen.createNavigateAppend({
          path: [
            {
              props: {teamID: Container.getRouteProps(ownProps, 'teamID', Types.noTeamID)},
              selected: 'teamReallyLeaveTeam',
            },
          ],
        })
      )
    },
    onOpenProfile: () =>
      dispatch(createShowUserProfile({username: Container.getRouteProps(ownProps, 'username', '')})),
  }),
  (stateProps, dispatchProps, _: OwnProps) => {
    // Gather contextual team membership info
    const yourInfo = stateProps._memberInfo?.get(stateProps._you)
    const userInfo = stateProps._memberInfo?.get(stateProps._username)

    const you = {type: yourInfo?.type, username: stateProps._you}
    const user = {type: userInfo?.type, username: stateProps._username}

    // If they're an owner, you need to be an owner to edit them
    // otherwise you just need to be an admin
    const admin = user.type === 'owner' ? you.type === 'owner' : stateProps.yourOperations.manageMembers

    return {
      admin,
      disabledReasonsForRolePicker: stateProps.disabledReasonsForRolePicker,
      error: stateProps.error,
      follower: stateProps.follower,
      following: stateProps.following,
      loading: stateProps.loading,
      onBack: dispatchProps.onBack,
      onBlur: dispatchProps.onBlur,
      onChat: () => dispatchProps._onChat(stateProps._username),
      onEditRole: (role: Types.TeamRoleType) =>
        dispatchProps._onEditRole(stateProps.teamID, user.username, role),
      onOpenProfile: dispatchProps.onOpenProfile,
      onRemoveMember: () => {
        if (stateProps._username === stateProps._you) {
          dispatchProps.onLeaveTeam()
        } else {
          dispatchProps._onRemoveMember(stateProps.teamID, stateProps._username)
        }
      },
      teamID: stateProps.teamID,
      teamname: stateProps.teamname,
      user,
      you,
    }
  }
)(TeamMemberStateWrapper)
