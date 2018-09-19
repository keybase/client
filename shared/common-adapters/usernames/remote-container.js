// @flow
import * as ProfileGen from '../../actions/profile-gen'
import {Usernames} from '.'
import {remoteConnect, compose} from '../../util/container'
import * as Container from './container'

// Connected username component
const mapStateToProps = (props) => ({
  _broken: props.broken,
  _following: props.following,
  _you: props.username,
})

const mapDispatchToProps = (dispatch) => ({
  _onUsernameClicked: (username: string) => dispatch(ProfileGen.createShowUserProfile({username})),
})

const mergeProps = (stateProps, dispatchProps, ownProps) =>
  Container.connectedPropsToProps(
    {...stateProps, _following: new Set(stateProps._following)},
    {},
    {...ownProps, onUsernameClicked: dispatchProps._onUsernameClicked}
  )

export default compose(
  remoteConnect(mapStateToProps, mapDispatchToProps, mergeProps)
)(Usernames)
