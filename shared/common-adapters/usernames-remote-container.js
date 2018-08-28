// @flow
import * as ProfileGen from '../actions/profile-gen'
import {Usernames} from '../common-adapters'
import {remoteConnect, compose} from '../util/container'

// Connected username component
const mapStateToProps = ({broken, following, username}) =>
  ({broken, following, username})

const mapDispatchToProps = (dispatch) => ({
  _onUsernameClicked: (username: string) => dispatch(ProfileGen.createShowUserProfile({username})),
})

const mergeProps = (stateProps, {_onUsernameClicked}, ownProps) => {
  const following = new Set(stateProps.following)
  const userData = ownProps.usernames
    .map(username => ({
      broken: stateProps.broken.trackerState === 'error',
      following: following.has(username),
      username,
      you: stateProps.username === username,
    }))
    // .filter(u => !ownProps.skipSelf || !u.you)

  return {
    ...ownProps,
    users: userData,
    ...(ownProps.clickable ? {onUsernameClicked: _onUsernameClicked} : {}),
  }
}

export default compose(
  remoteConnect(mapStateToProps, mapDispatchToProps, mergeProps)
)(Usernames)
