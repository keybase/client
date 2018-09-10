// @flow
import {compose, connect, setDisplayName} from '../../util/container'
import {type TypedState} from '../../constants/reducer'
import * as ProfileGen from '../../actions/profile-gen'
import * as TrackerGen from '../../actions/tracker-gen'
import * as Styles from '../../styles'
import type {TextType, Background} from '../text'
import {Usernames, type Props} from '.'

export type ConnectedProps = {|
  backgroundMode?: Background,
  colorBroken?: boolean,
  colorFollowing?: boolean,
  colorYou?: boolean | string,
  commaColor?: string,
  containerStyle?: Styles.StylesCrossPlatform,
  inline?: boolean,
  inlineGrammar?: boolean,
  joinerStyle?: Styles.StylesCrossPlatform,
  onUsernameClicked?: ((username: string) => void) | 'tracker' | 'profile',
  prefix?: ?string,
  redColor?: string,
  showAnd?: boolean,
  skipSelf?: boolean,
  style?: Styles.StylesCrossPlatform,
  suffix?: ?string,
  title?: string,
  type: TextType,
  underline?: boolean,
  usernames: Array<string>,
|}

// Connected username component
// instead of username objects supply array of username strings & this will fill in the rest
const mapStateToProps = (state: TypedState) => {
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

const mergeProps = (stateProps, dispatchProps, ownProps: ConnectedProps) => {
  const userData = ownProps.usernames
    .map(username => ({
      broken: stateProps._broken.trackerState === 'error',
      following: stateProps._following.has(username),
      username,
      you: stateProps._you === username,
    }))
    .filter(u => !ownProps.skipSelf || !u.you)

  let onUsernameClicked
  if (ownProps.onUsernameClicked === 'tracker') {
    onUsernameClicked = dispatchProps.onOpenTracker
  } else if (ownProps.onUsernameClicked === 'profile') {
    onUsernameClicked = dispatchProps.onOpenProfile
  } else if (typeof onUsernameClicked === 'function') {
    onUsernameClicked = ownProps.onUsernameClicked
  }

  // $FlowIssue for some reason, Flow seems to think that onUsernameClicked can be "tracker" or "profile", even though we've explicitly overridden those and made clear ownProps.onUsernameClicked has to be a function.
  const props: Props = {...ownProps, onUsernameClicked, users: userData}

  return props
}

const ConnectedUsernames = compose(
  connect(mapStateToProps, mapDispatchToProps, mergeProps),
  setDisplayName('Usernames')
)(Usernames)

export default ConnectedUsernames
