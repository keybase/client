import * as ProfileGen from '../../actions/profile-gen'
import {Usernames} from '.'
import {remoteConnect, compose} from '../../util/container'
import * as Container from './container'
import * as UsersTypes from '../../constants/types/users'

type OwnProps = Container.ConnectedProps

type State = {
  following: Set<string>
  userInfo: {[K in string]: UsersTypes._UserInfo}
  username: string
}

// Connected username component
const mapStateToProps = props => ({
  _following: props.following,
  _userInfo: props.userInfo,
  _you: props.username,
})

const mapDispatchToProps = dispatch => ({
  _onUsernameClicked: (username: string) => dispatch(ProfileGen.createShowUserProfile({username})),
})

const userDatafromState = (stateProps, usernames) =>
  usernames.map(username => ({
    broken: (stateProps._userInfo[username] && stateProps._userInfo[username].broken) || false,
    following: stateProps._following.has(username),
    username,
    you: stateProps._you === username,
  }))

const mergeProps = (stateProps, dispatchProps, ownProps: OwnProps) =>
  Container.connectedPropsToProps(
    {...stateProps, _following: new Set(stateProps._following)},
    {},
    {...ownProps, onUsernameClicked: dispatchProps._onUsernameClicked},
    userDatafromState
  )

export default remoteConnect(mapStateToProps, mapDispatchToProps, mergeProps)(Usernames)
