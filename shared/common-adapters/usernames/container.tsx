import * as Container from '../../util/container'
import * as ProfileGen from '../../actions/profile-gen'
import * as Tracker2Gen from '../../actions/tracker2-gen'
import * as UsersConstants from '../../constants/users'
import {Usernames, Props} from '.'

type OwnProps = {
  onUsernameClicked?: ((username: string) => void) | 'tracker' | 'profile'
  skipSelf?: boolean
  usernames: Array<string>
} & Omit<Props, 'users' | 'onUsernameClicked'>

const ConnectedUsernames = Container.namedConnect(
  state => {
    const _following = state.config.following
    const _userInfo = state.users.infoMap
    const _you = state.config.username
    return {
      _following,
      _userInfo,
      _you,
    }
  },
  dispatch => ({
    _onOpenProfile: (username: string) => dispatch(ProfileGen.createShowUserProfile({username})),
    _onOpenTracker: (username: string) => dispatch(Tracker2Gen.createShowUser({asTracker: true, username})),
  }),
  (stateProps, dispatchProps, ownProps: OwnProps) => {
    const users = ownProps.usernames.reduce<Props['users']>((arr, username) => {
      const you = stateProps._you === username
      if (!ownProps.skipSelf || !you) {
        arr.push({
          broken: UsersConstants.getIsBroken(stateProps._userInfo, username) || false,
          following: stateProps._following.has(username),
          username,
          you,
        })
      }
      return arr
    }, [])

    let onUsernameClicked: undefined | ((s: string) => void)
    switch (ownProps.onUsernameClicked) {
      case 'tracker':
        onUsernameClicked = dispatchProps._onOpenTracker
        break
      case 'profile':
        onUsernameClicked = dispatchProps._onOpenProfile
        break
      default:
        if (typeof ownProps.onUsernameClicked === 'function') {
          onUsernameClicked = ownProps.onUsernameClicked
        }
    }

    const {onUsernameClicked: _onUsernameClicked, skipSelf, usernames, ...rest} = ownProps
    return {...rest, onUsernameClicked, users}
  },
  'Usernames'
)(Usernames)

export default ConnectedUsernames
