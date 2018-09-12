// @flow
import {compose, connect, setDisplayName} from '../../util/container'
import * as ProfileGen from '../../actions/profile-gen'
import * as TrackerGen from '../../actions/tracker-gen'
import NameWithIcon, {type NameWithIconProps} from '.'

export type ConnectedNameWithIconProps = {|
  ...NameWithIconProps,
  onClick: (any => void) | 'tracker' | 'profile',
|}

const mapStateToProps = () => ({})

const mapDispatchToProps = dispatch => ({
  onOpenProfile: (username: string) => dispatch(ProfileGen.createShowUserProfile({username})),
  onOpenTracker: (username: string) =>
    dispatch(TrackerGen.createGetProfile({forceDisplay: true, ignoreCache: true, username})),
})

const mergeProps = (stateProps, dispatchProps, ownProps: ConnectedNameWithIconProps) => {
  const {onClick, ...props} = ownProps

  let functionOnClick
  if (onClick === 'tracker') {
    functionOnClick = dispatchProps.onOpenTracker
  } else if (onClick === 'profile') {
    functionOnClick = dispatchProps.onOpenProfile
  } else if (typeof onClick === 'function') {
    functionOnClick = onClick
  }

  return {
    ...props,
    onClick: functionOnClick,
  }
}

const ConnectedNameWithIcon = compose(
  connect(mapStateToProps, mapDispatchToProps, mergeProps),
  setDisplayName('Usernames')
)(NameWithIcon)

export default ConnectedNameWithIcon
