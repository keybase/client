// @flow
import {compose, connect, setDisplayName} from '../../util/container'
import * as Route from '../../actions/route-tree'
import {teamsTab} from '../../constants/tabs'
import * as ProfileGen from '../../actions/profile-gen'
import * as TrackerGen from '../../actions/tracker-gen'
import NameWithIcon, {type NameWithIconProps} from '.'

export type ConnectedNameWithIconProps = {|
  ...NameWithIconProps,
  onClick: ((name: string) => void) | 'tracker' | 'profile',
|}

const mapStateToProps = () => ({})

const mapDispatchToProps = dispatch => ({
  onOpenUserProfile: (username: string) => dispatch(ProfileGen.createShowUserProfile({username})),
  onOpenTeamProfile: (teamname: string) =>
    dispatch(Route.navigateTo([teamsTab, {props: {teamname: teamname}, selected: 'team'}])),
  onOpenTracker: (username: string) =>
    dispatch(TrackerGen.createGetProfile({forceDisplay: true, ignoreCache: true, username})),
})

const mergeProps = (stateProps, dispatchProps, ownProps: ConnectedNameWithIconProps) => {
  const {onClick, ...props} = ownProps

  let functionOnClick
  if (onClick === 'tracker') {
    if (ownProps.username) {
      functionOnClick = dispatchProps.onOpenTracker
    } else {
      throw new Error('Cannot open tracker without username')
    }
  } else if (onClick === 'profile') {
    if (ownProps.username) {
      functionOnClick = dispatchProps.onOpenUserProfile
    } else {
      functionOnClick = dispatchProps.onOpenTeamProfile
    }
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
