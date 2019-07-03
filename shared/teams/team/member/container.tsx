import * as React from 'react'
import * as Types from '../../../constants/types/teams'
import {amIBeingFollowed, amIFollowing} from '../../../constants/selectors'
import * as I from 'immutable'
import * as Chat2Gen from '../../../actions/chat2-gen'
import * as RouteTreeGen from '../../../actions/route-tree-gen'
import * as TeamsGen from '../../../actions/teams-gen'
import * as Container from '../../../util/container'
import {compose} from 'recompose'
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
import * as RPCTypes from '../../../constants/types/rpc-gen'

type OwnProps = Container.RouteProps<
  {
    username: string
    teamname: string
  },
  {}
>

type StateProps = {
  disabledReasonsForRolePicker: Types.DisabledReasonsForRolePicker
  teamname: string
  following: boolean
  follower: boolean
  _you: string
  _username: string
  _memberInfo: I.Map<string, Types.MemberInfo>
  yourOperations: RPCTypes.TeamOperation
  loading: boolean
}

const mapStateToProps = (state, ownProps): StateProps => {
  const username = Container.getRouteProps(ownProps, 'username')
  const teamname = Container.getRouteProps(ownProps, 'teamname')
  const disabledReasonsForRolePicker = getDisabledReasonsForRolePicker(state, teamname, username)

  return {
    _memberInfo: getTeamMembers(state, teamname),
    _username: username,
    _you: state.config.username,
    disabledReasonsForRolePicker,
    follower: amIBeingFollowed(state, username),
    following: amIFollowing(state, username),
    loading: anyWaiting(state, teamWaitingKey(teamname)),
    teamname: teamname,
    yourOperations: getCanPerform(state, teamname),
  }
}

type DispatchProps = {
  onOpenProfile: () => void
  _onEditRole: (teamname: string, username: string, role: Types.TeamRoleType) => void
  _onRemoveMember: (name: string, username: string) => void
  _onLeaveTeam: (teamname: string) => void
  _onChat: (username: string) => void
  onBack: () => void
}

const mapDispatchToProps = (dispatch, ownProps): DispatchProps => ({
  _onChat: username => {
    username && dispatch(Chat2Gen.createPreviewConversation({participants: [username], reason: 'memberView'}))
  },
  _onEditRole: (teamname, username, role) =>
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
    dispatch(createShowUserProfile({username: Container.getRouteProps(ownProps, 'username')})),
})

const mergeProps = (stateProps: StateProps, dispatchProps: DispatchProps) => {
  // Gather contextual team membership info
  const yourInfo = stateProps._memberInfo.get(stateProps._you)
  const userInfo: Types.MemberInfo | null = stateProps._memberInfo.get(stateProps._username)
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

export default compose(
  Container.connect(mapStateToProps, mapDispatchToProps, mergeProps),
  HeaderHoc
)(TeamMemberStateWrapper)
