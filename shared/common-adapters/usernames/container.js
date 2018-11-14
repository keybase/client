// @flow
import {namedConnect} from '../../util/container'
import * as I from 'immutable'
import * as ProfileGen from '../../actions/profile-gen'
import * as TrackerGen from '../../actions/tracker-gen'
import * as TrackerTypes from '../../constants/types/tracker'
import {Usernames, type BaseUsernamesProps, type Props} from '.'

export type StateProps = {|
  _broken: {[key: string]: TrackerTypes.TrackerState},
  _following: I.Set<string> | Set<string>,
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

export const connectedPropsToProps = (
  stateProps: StateProps,
  dispatchProps: DispatchProps,
  connectedProps: ConnectedProps
): Props => {
  const userData = connectedProps.usernames
    .map(username => ({
      broken: stateProps._broken.trackerState === 'error',
      following: stateProps._following.has(username),
      username,
      you: stateProps._you === username,
    }))
    .filter(u => !connectedProps.skipSelf || !u.you)

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

// Connected username component
// instead of username objects supply array of username strings & this will fill in the rest
const mapStateToProps = state => {
  const _following = state.config.following
  const _broken = state.tracker.userTrackers
  const _you = state.config.username
  return {
    _broken,
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
  connectedPropsToProps(stateProps, dispatchProps, ownProps)

const ConnectedUsernames = namedConnect<OwnProps, _, _, _, _>(
  mapStateToProps,
  mapDispatchToProps,
  mergeProps,
  'Usernames'
)(Usernames)

export default ConnectedUsernames
