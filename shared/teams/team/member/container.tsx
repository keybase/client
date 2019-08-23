import * as React from 'react'
import * as Types from '../../../constants/types/teams'
import * as Chat2Gen from '../../../actions/chat2-gen'
import * as RouteTreeGen from '../../../actions/route-tree-gen'
import * as TeamsGen from '../../../actions/teams-gen'
import * as Container from '../../../util/container'
import {HeaderHoc} from '../../../common-adapters'
import {createShowUserProfile} from '../../../actions/profile-gen'
import {TeamMember, MemberProps} from '.'
import {
  getCanPerform,
  getTeamMembers,
  teamWaitingKey,
  getDisabledReasonsForRolePicker,
} from '../../../constants/teams'
import {anyWaiting} from '../../../constants/waiting'

type OwnProps = Container.RouteProps<{username: string; teamname: string}>

const mapStateToProps = (state: Container.TypedState, ownProps: OwnProps) => {
  const username = Container.getRouteProps(ownProps, 'username', '')
  const teamname = Container.getRouteProps(ownProps, 'teamname', '')
  const disabledReasonsForRolePicker = getDisabledReasonsForRolePicker(state, teamname, username)

  return {
    _memberInfo: getTeamMembers(state, teamname),
    _username: username,
    _you: state.config.username,
    disabledReasonsForRolePicker,
    follower: state.config.followers.has(username),
    following: state.config.following.has(username),
    loading: anyWaiting(state, teamWaitingKey(teamname)),
    teamname: teamname,
    yourOperations: getCanPerform(state, teamname),
  }
}

const mapDispatchToProps = (dispatch: Container.TypedDispatch, ownProps: OwnProps) => ({
  _onChat: (username: string) => {
    username && dispatch(Chat2Gen.createPreviewConversation({participants: [username], reason: 'memberView'}))
  },
  _onEditRole: (teamname: string, username: string, role: Types.TeamRoleType) =>
    dispatch(TeamsGen.createEditMembership({role, teamname, username})),
  _onLeaveTeam: (teamname: string) => {
    dispatch(
      RouteTreeGen.createNavigateAppend({path: [{props: {teamname}, selected: 'teamReallyLeaveTeam'}]})
    )
  },
  _onRemoveMember: (teamname: string, username: string) => {
    dispatch(
      RouteTreeGen.createNavigateAppend({
        path: [{props: {teamname, username}, selected: 'teamReallyRemoveMember'}],
      })
    )
  },
  onBack: () => dispatch(RouteTreeGen.createNavigateUp()),
  onOpenProfile: () =>
    dispatch(createShowUserProfile({username: Container.getRouteProps(ownProps, 'username', '')})),
})

type State = {
  rolePickerOpen: boolean
  selectedRole: Types.TeamRoleType | null
}

type Props = MemberProps & {
  onEditRole: (role: Types.TeamRoleType) => void
}

class TeamMemberStateWrapper extends React.Component<Props, State> {
  state = {
    rolePickerOpen: false,
    selectedRole: null,
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
        onSelectRole={selectedRole => this.setState({selectedRole})}
        selectedRole={this.state.selectedRole}
      />
    )
  }
}

export default Container.connect(
  mapStateToProps,
  mapDispatchToProps,
  (stateProps, dispatchProps, _: OwnProps) => {
    // Gather contextual team membership info
    const yourInfo = stateProps._memberInfo.get(stateProps._you)
    const userInfo: Types.MemberInfo | undefined = stateProps._memberInfo.get(stateProps._username)
    const you = {
      type: yourInfo ? yourInfo.type : null,
      username: stateProps._you,
    }

    const user = {
      type: userInfo ? userInfo.type : null,
      username: stateProps._username,
    }
    // If they're an owner, you need to be an owner to edit them
    // otherwise you just need to be an admin
    let admin = user.type === 'owner' ? you.type === 'owner' : stateProps.yourOperations.manageMembers

    return {
      admin,
      disabledReasonsForRolePicker: stateProps.disabledReasonsForRolePicker,
      follower: stateProps.follower,
      following: stateProps.following,
      loading: stateProps.loading,
      onBack: dispatchProps.onBack,
      onChat: () => dispatchProps._onChat(stateProps._username),
      onEditRole: (role: Types.TeamRoleType) =>
        dispatchProps._onEditRole(stateProps.teamname, user.username, role),
      onOpenProfile: dispatchProps.onOpenProfile,
      onRemoveMember: () => {
        if (stateProps._username === stateProps._you) {
          dispatchProps._onLeaveTeam(stateProps.teamname)
        } else {
          dispatchProps._onRemoveMember(stateProps.teamname, stateProps._username)
        }
      },
      teamname: stateProps.teamname,
      user,
      you,
    }
  }
)(HeaderHoc(TeamMemberStateWrapper))
