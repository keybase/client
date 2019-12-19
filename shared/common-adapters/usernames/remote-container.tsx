import * as Container from '../../util/container'
import * as ProfileGen from '../../actions/profile-gen'
import {Usernames, Props} from '.'

type OwnProps = {
  onUsernameClicked?: ((username: string) => void) | 'tracker' | 'profile'
  skipSelf?: boolean
  usernames: Array<string>
} & Omit<Props, 'users' | 'onUsernameClicked'>

export default Container.remoteConnect(
  (state: any) => ({
    _following: state.following,
    _userInfo: state.userInfo,
    _you: state.username,
  }),
  dispatch => ({
    onUsernameClicked: (username: string) => dispatch(ProfileGen.createShowUserProfile({username})),
  }),
  (stateProps, dispatchProps, ownProps: OwnProps) => {
    const _following = new Set(stateProps._following)

    const users = ownProps.usernames.reduce<Props['users']>((arr, username) => {
      const you = stateProps._you === username
      if (!ownProps.skipSelf || !you) {
        arr.push({
          broken: (stateProps._userInfo[username] && stateProps._userInfo[username].broken) || false,
          following: _following.has(username),
          username,
          you,
        })
      }
      return arr
    }, [])

    const {onUsernameClicked: _onUsernameClicked, skipSelf, usernames, ...rest} = ownProps
    return {...rest, onUsernameClicked: dispatchProps.onUsernameClicked, users}
  }
)(Usernames)
