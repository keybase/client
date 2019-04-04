// @flow
import * as Types from '../../../constants/types/teams'
import {amIBeingFollowed, amIFollowing} from '../../../constants/selectors'
import * as I from 'immutable'
import * as Chat2Gen from '../../../actions/chat2-gen'
import * as RouteTreeGen from '../../../actions/route-tree-gen'
import * as Container from '../../../util/container'
import {compose} from 'recompose'
import {HeaderHoc} from '../../../common-adapters'
import {createShowUserProfile} from '../../../actions/profile-gen'
import {TeamMember} from '.'
import {getCanPerform, getTeamMembers, teamWaitingKey} from '../../../constants/teams'
import {anyWaiting} from '../../../constants/waiting'
import * as RPCTypes from '../../../constants/types/rpc-gen'

type OwnProps = Container.RouteProps<{username: string, teamname: string}, {}>

type StateProps = {
  teamname: string,
  following: boolean,
  follower: boolean,
  _you: ?string,
  _username: string,
  _memberInfo: I.Map<string, Types.MemberInfo>,
  yourOperations: RPCTypes.TeamOperation,
  loading: boolean,
}

const mapStateToProps = (state, ownProps): StateProps => {
  const username = Container.getRouteProps(ownProps, 'username')
  const teamname = Container.getRouteProps(ownProps, 'teamname')

  return {
    _memberInfo: getTeamMembers(state, teamname),
    _username: username,
    _you: state.config.username,
    follower: amIBeingFollowed(state, username),
    following: amIFollowing(state, username),
    loading: anyWaiting(state, teamWaitingKey(teamname)),
    teamname: teamname,
    yourOperations: getCanPerform(state, teamname),
  }
}

type DispatchProps = {|
  onOpenProfile: () => void,
  _onEditMembership: (name: string, username: string) => void,
  _onRemoveMember: (name: string, username: string) => void,
  _onLeaveTeam: (teamname: string) => void,
  _onChat: (string, ?string) => void,
  onBack: () => void,
  // TODO remove member
|}

const mapDispatchToProps = (dispatch, ownProps): DispatchProps => ({
  _onChat: username => {
    username && dispatch(Chat2Gen.createPreviewConversation({participants: [username], reason: 'memberView'}))
  },
  _onEditMembership: (name: string, username: string) =>
    dispatch(
      RouteTreeGen.createNavigateAppend({
        path: [
          {
            props: {teamname: name, username},
            selected: 'teamRolePicker',
          },
        ],
      })
    ),
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
  const yourInfo = stateProps._you && stateProps._memberInfo.get(stateProps._you)
  const userInfo = stateProps._memberInfo.get(stateProps._username)
  const you = {
    type: yourInfo && yourInfo.type,
    username: stateProps._you,
  }
  const user = {
    type: userInfo && userInfo.type,
    username: stateProps._username,
  }
  // If they're an owner, you need to be an owner to edit them
  // otherwise you just need to be an admin
  let admin = user.type === 'owner' ? you.type === 'owner' : stateProps.yourOperations.manageMembers

  return {
    ...stateProps,
    ...dispatchProps,
    admin,
    onChat: () => dispatchProps._onChat(stateProps._username),
    onEditMembership: () => dispatchProps._onEditMembership(stateProps.teamname, stateProps._username),
    onRemoveMember: () => {
      if (stateProps._username === stateProps._you) {
        dispatchProps._onLeaveTeam(stateProps.teamname)
      } else {
        dispatchProps._onRemoveMember(stateProps.teamname, stateProps._username)
      }
    },
    // $FlowIssue this type is messed up, TODO cleanup
    user,
    // $FlowIssue this type is messed up, TODO cleanup
    you,
  }
}

export default compose(
  Container.connect<OwnProps, _, _, _, _>(
    mapStateToProps,
    mapDispatchToProps,
    mergeProps
  ),
  HeaderHoc
)(TeamMember)
