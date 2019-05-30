import {namedConnect} from '../../util/container'
import * as I from 'immutable'
import * as ProfileGen from '../../actions/profile-gen'
import * as Tracker2Gen from '../../actions/tracker2-gen'
import * as UsersConstants from '../../constants/users'
import {InfoMap as UserInfoMap} from '../../constants/types/users'
import {Usernames, BaseUsernamesProps, Props, UserList} from '.'

<<<<<<< HEAD:shared/common-adapters/usernames/container.tsx
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
||||||| merged common ancestors:shared/common-adapters/usernames/container.js
export type StateProps = {|
  _following: I.Set<string> | Set<string>,
  _userInfo: UserInfoMap,
  _you: string,
|}
=======
export type StateProps = {
  _following: I.Set<string> | Set<string>
  _userInfo: UserInfoMap
  _you: string
}
>>>>>>> Initial conversion:shared/common-adapters/usernames/container.tsx

<<<<<<< HEAD:shared/common-adapters/usernames/container.tsx
export type ConnectedProps = ConnectedOnlyProps & BaseUsernamesProps
||||||| merged common ancestors:shared/common-adapters/usernames/container.js
export type ConnectedProps = {|
  ...BaseUsernamesProps,
  onUsernameClicked?: ((username: string) => void) | 'tracker' | 'profile',
  skipSelf?: boolean,
  usernames: Array<string>,
|}
=======
export type ConnectedProps = {
  onUsernameClicked?: ((username: string) => void) | 'tracker' | 'profile'
  skipSelf?: boolean
  usernames: Array<string>
} & BaseUsernamesProps
>>>>>>> Initial conversion:shared/common-adapters/usernames/container.tsx

type OwnProps = ConnectedProps

<<<<<<< HEAD:shared/common-adapters/usernames/container.tsx
export type DispatchProps = {
  onOpenProfile?: (username: string) => void
  onOpenTracker?: (username: string) => void
}
||||||| merged common ancestors:shared/common-adapters/usernames/container.js
export type DispatchProps = {|
  onOpenProfile?: (username: string) => void,
  onOpenTracker?: (username: string) => void,
|}
=======
export type DispatchProps = {
  onOpenProfile?: ((username: string) => void)
  onOpenTracker?: ((username: string) => void)
}
>>>>>>> Initial conversion:shared/common-adapters/usernames/container.tsx

export function connectedPropsToProps<T>(
  stateProps: T,
  dispatchProps: DispatchProps,
  connectedProps: ConnectedProps,
<<<<<<< HEAD:shared/common-adapters/usernames/container.tsx
  userDataFromState: (t: T, array: Array<string>) => UserList
||||||| merged common ancestors:shared/common-adapters/usernames/container.js
  userDataFromState: (T, Array<string>) => UserList
=======
  userDataFromState: ((t: T, array: Array<string>) => UserList)
>>>>>>> Initial conversion:shared/common-adapters/usernames/container.tsx
): Props {
  const userData = userDataFromState(stateProps, connectedProps.usernames).filter(
    u => !connectedProps.skipSelf || !u.you
  )
<<<<<<< HEAD:shared/common-adapters/usernames/container.tsx
  let onUsernameClickedNew: (username: string) => void | null
||||||| merged common ancestors:shared/common-adapters/usernames/container.js
  let onUsernameClickedNew: ?(username: string) => void
=======
  let onUsernameClickedNew: ((username: string) => void) | null
>>>>>>> Initial conversion:shared/common-adapters/usernames/container.tsx
  if (connectedProps.onUsernameClicked === 'tracker') {
    onUsernameClickedNew = dispatchProps.onOpenTracker
  } else if (connectedProps.onUsernameClicked === 'profile') {
    onUsernameClickedNew = dispatchProps.onOpenProfile
  } else if (typeof connectedProps.onUsernameClicked === 'function') {
<<<<<<< HEAD:shared/common-adapters/usernames/container.tsx
    onUsernameClickedNew = connectedProps.onUsernameClicked as (username: string) => void
||||||| merged common ancestors:shared/common-adapters/usernames/container.js
    onUsernameClickedNew = (connectedProps.onUsernameClicked: (username: string) => void)
=======
    onUsernameClickedNew = connectedProps.onUsernameClicked as ((username: string) => void)
>>>>>>> Initial conversion:shared/common-adapters/usernames/container.tsx
  }

  // Remove onUsernameClicked
  const {skipSelf, usernames, onUsernameClicked, ...props} = connectedProps

  return {
    ...props,
<<<<<<< HEAD:shared/common-adapters/usernames/container.tsx
    onUsernameClicked: onUsernameClickedNew
      ? (onUsernameClickedNew as (username: string) => void)
      : undefined,
||||||| merged common ancestors:shared/common-adapters/usernames/container.js
    onUsernameClicked: onUsernameClickedNew ? (onUsernameClickedNew: (username: string) => void) : undefined,
=======
    onUsernameClicked: onUsernameClickedNew
      ? (onUsernameClickedNew as ((username: string) => void))
      : undefined,
>>>>>>> Initial conversion:shared/common-adapters/usernames/container.tsx
    users: userData,
  } as Props
}

const userDataFromState = (stateProps, usernames) =>
  usernames.map(username => ({
    // Auto generated from flowToTs. Please clean me!
    broken:
      UsersConstants.getIsBroken(stateProps._userInfo, username) !== null &&
      UsersConstants.getIsBroken(stateProps._userInfo, username) !== undefined
        ? UsersConstants.getIsBroken(stateProps._userInfo, username)
        : false,
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
