import {namedConnect} from '../../util/container'
import * as I from 'immutable'
import * as ProfileGen from '../../actions/profile-gen'
import * as Tracker2Gen from '../../actions/tracker2-gen'
import * as UsersConstants from '../../constants/users'
import {InfoMap as UserInfoMap} from '../../constants/types/users'
import {Usernames, BaseUsernamesProps, Props, UserList} from '.'

export type StateProps = {
  _following: I.Set<string> | Set<string>
  _userInfo: UserInfoMap
  _you: string
}

type ConnectedOnlyProps = {
  onUsernameClicked?: ((username: string) => void) | 'tracker' | 'profile'
  skipSelf?: boolean
  usernames: Array<string>
}

export type ConnectedProps = ConnectedOnlyProps & BaseUsernamesProps

type OwnProps = ConnectedProps

export type DispatchProps = {
  onOpenProfile?: (username: string) => void
  onOpenTracker?: (username: string) => void
}

export function connectedPropsToProps<T>(
  stateProps: T,
  dispatchProps: DispatchProps,
  connectedProps: OwnProps,
  userDataFromState: (t: T, array: Array<string>) => UserList
): Props {
  const userData = userDataFromState(stateProps, connectedProps.usernames).filter(
    u => !connectedProps.skipSelf || !u.you
  )
  let onUsernameClickedNew: ((username: string) => void) | null = null
  if (connectedProps.onUsernameClicked === 'tracker') {
    onUsernameClickedNew = dispatchProps.onOpenTracker || null
  } else if (connectedProps.onUsernameClicked === 'profile') {
    onUsernameClickedNew = dispatchProps.onOpenProfile || null
  } else if (typeof connectedProps.onUsernameClicked === 'function') {
    onUsernameClickedNew = connectedProps.onUsernameClicked || null
  }

  // Remove onUsernameClicked
  const {skipSelf, usernames, onUsernameClicked, ...props} = connectedProps

  return {
    ...props,
    onUsernameClicked: onUsernameClickedNew
      ? (onUsernameClickedNew as (username: string) => void)
      : undefined,
    users: userData,
  } as Props
}

const userDataFromState = (stateProps, usernames) =>
  usernames.map(username => ({
    broken: UsersConstants.getIsBroken(stateProps._userInfo, username) || false,
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
    _following,
    _userInfo,
    _you,
  }
}

const mapDispatchToProps = dispatch => ({
  onOpenProfile: (username: string) => dispatch(ProfileGen.createShowUserProfile({username})),
  onOpenTracker: (username: string) => dispatch(Tracker2Gen.createShowUser({asTracker: true, username})),
})

const mergeProps = (stateProps, dispatchProps, ownProps: ConnectedProps) =>
  connectedPropsToProps(stateProps, dispatchProps, ownProps, userDataFromState)

const ConnectedUsernames = namedConnect(mapStateToProps, mapDispatchToProps, mergeProps, 'Usernames')(
  Usernames
)

export default ConnectedUsernames
