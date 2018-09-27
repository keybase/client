// @flow
import * as Types from '../../../constants/types/teams'
import {amIBeingFollowed, amIFollowing} from '../../../constants/selectors'
import * as I from 'immutable'
import * as Chat2Gen from '../../../actions/chat2-gen'
import {connect} from '../../../util/container'
import {compose} from 'recompose'
import {HeaderHoc} from '../../../common-adapters'
import {createShowUserProfile} from '../../../actions/profile-gen'
import {TeamMember} from '.'
import {type TypedState} from '../../../constants/reducer'
import {getCanPerform, getTeamMembers, teamWaitingKey} from '../../../constants/teams'
import {anyWaiting} from '../../../constants/waiting'
import * as RPCTypes from '../../../constants/types/rpc-gen'

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

const mapStateToProps = (state: TypedState, {routeProps}): StateProps => {
  const username = routeProps.get('username')
  const teamname = routeProps.get('teamname')

  return {
    teamname: teamname,
    loading: anyWaiting(state, teamWaitingKey(teamname)),
    following: amIFollowing(state, username),
    follower: amIBeingFollowed(state, username),
    yourOperations: getCanPerform(state, teamname),
    _username: username,
    _you: state.config.username,
    _memberInfo: getTeamMembers(state, teamname),
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

const mapDispatchToProps = (dispatch, {routeProps, navigateAppend, navigateUp}): DispatchProps => ({
  onOpenProfile: () => dispatch(createShowUserProfile({username: routeProps.get('username')})),
  _onEditMembership: (name: string, username: string) =>
    dispatch(
      navigateAppend([
        {
          props: {teamname: name, username},
          selected: 'rolePicker',
        },
      ])
    ),
  _onRemoveMember: (teamname: string, username: string) => {
    dispatch(navigateAppend([{props: {teamname, username}, selected: 'reallyRemoveMember'}]))
  },
  _onLeaveTeam: (teamname: string) => {
    dispatch(navigateAppend([{props: {teamname}, selected: 'reallyLeaveTeam'}]))
  },
  _onChat: username => {
    username && dispatch(Chat2Gen.createPreviewConversation({participants: [username], reason: 'memberView'}))
  },
  onBack: () => dispatch(navigateUp()),
})

const mergeProps = (stateProps: StateProps, dispatchProps: DispatchProps) => {
  // Gather contextual team membership info
  const yourInfo = stateProps._you && stateProps._memberInfo.get(stateProps._you)
  const userInfo = stateProps._memberInfo.get(stateProps._username)
  const you = {
    username: stateProps._you,
    type: yourInfo && yourInfo.type,
  }
  const user = {
    username: stateProps._username,
    type: userInfo && userInfo.type,
  }
  // If they're an owner, you need to be an owner to edit them
  // otherwise you just need to be an admin
  let admin = user.type === 'owner' ? you.type === 'owner' : stateProps.yourOperations.manageMembers

  return {
    ...stateProps,
    ...dispatchProps,
    admin,
    user,
    you,
    onChat: () => dispatchProps._onChat(stateProps._username),
    onEditMembership: () => dispatchProps._onEditMembership(stateProps.teamname, stateProps._username),
    onRemoveMember: () => {
      if (stateProps._username === stateProps._you) {
        dispatchProps._onLeaveTeam(stateProps.teamname)
      } else {
        dispatchProps._onRemoveMember(stateProps.teamname, stateProps._username)
      }
    },
  }
}

// $FlowIssue this type is messed up, TODO cleanup
export default compose(
  connect(
    mapStateToProps,
    mapDispatchToProps,
    mergeProps
  ),
  HeaderHoc
)(TeamMember)
