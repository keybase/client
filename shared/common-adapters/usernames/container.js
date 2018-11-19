// @flow
import {namedConnect} from '../../util/container'
import * as I from 'immutable'
import * as ProfileGen from '../../actions/profile-gen'
import * as TrackerGen from '../../actions/tracker-gen'
import * as UsersConstants from '../../constants/users'
import type {InfoMap as UserInfoMap} from '../../constants/types/users'
import {Usernames, type BaseUsernamesProps, type Props, type UserList} from '.'

export type StateProps = {|
  _following: I.Set<string> | Set<string>,
  _userInfo: UserInfoMap,
  _you: string,
|}

export type ConnectedProps = {|
  ...BaseUsernamesProps,
  onUsernameClicked?: ((username: string) => void) | 'tracker' | 'profile',
  skipSelf?: boolean,
  usernames: Array<string>,
|}

type OwnProps = ConnectedProps

export type DispatchProps = {|
  onOpenProfile?: (username: string) => void,
  onOpenTracker?: (username: string) => void,
|}

export function connectedPropsToProps<T>(
  stateProps: T,
  dispatchProps: DispatchProps,
  connectedProps: ConnectedProps,
  userDataFromState: (T, Array<string>) => UserList
): Props {
  const userData = userDataFromState(stateProps, connectedProps.usernames).filter(
    u => !connectedProps.skipSelf || !u.you
  )
  let onUsernameClickedNew: ?(username: string) => void
  if (connectedProps.onUsernameClicked === 'tracker') {
    onUsernameClickedNew = dispatchProps.onOpenTracker
  } else if (connectedProps.onUsernameClicked === 'profile') {
    onUsernameClickedNew = dispatchProps.onOpenProfile
  } else if (typeof connectedProps.onUsernameClicked === 'function') {
    onUsernameClickedNew = (connectedProps.onUsernameClicked: (username: string) => void)
  }

  // Remove onUsernameClicked
  const {skipSelf, usernames, onUsernameClicked, ...props} = connectedProps

  return ({
    ...props,
    onUsernameClicked: onUsernameClickedNew ? (onUsernameClickedNew: (username: string) => void) : undefined,
    users: userData,
  }: Props)
}

const userDataFromState = (stateProps, usernames) =>
  usernames.map(username => ({
    broken: UsersConstants.getIsBroken(stateProps._userInfo, username) ?? false,
    following: stateProps._following.has(username),
    username,
    you: stateProps._you === username,
  }))

// Connected username component
// instead of username objects supply array of username strings & this will fill in the rest
const mapStateToProps = state => {
  const _following = state.config.following
  const _userInfo = state.users.infoMap
  const _you = state.config.username
  return {
    _userInfo,
    _following,
    _you,
  }
}

const mapDispatchToProps = dispatch => ({
  onOpenProfile: (username: string) => dispatch(ProfileGen.createShowUserProfile({username})),
  onOpenTracker: (username: string) =>
    dispatch(TrackerGen.createGetProfile({forceDisplay: true, ignoreCache: true, username})),
})

const mergeProps = (stateProps, dispatchProps, ownProps: ConnectedProps) =>
  connectedPropsToProps(stateProps, dispatchProps, ownProps, userDataFromState)

const ConnectedUsernames = namedConnect<OwnProps, _, _, _, _>(
  mapStateToProps,
  mapDispatchToProps,
  mergeProps,
  'Usernames'
)(Usernames)

export default ConnectedUsernames
