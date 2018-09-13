// @flow
import {compose, connect, setDisplayName} from '../../util/container'
import * as Route from '../../actions/route-tree'
import {teamsTab} from '../../constants/tabs'
import * as ProfileGen from '../../actions/profile-gen'
import * as TrackerGen from '../../actions/tracker-gen'
import NameWithIcon, {type NameWithIconProps} from '.'
import {isMobile} from '../../constants/platform'

export type ConnectedNameWithIconProps = {|
  ...NameWithIconProps,
  onClick?: ((SyntheticEvent<> | void) => void) | 'tracker' | 'profile',
|}

const mapStateToProps = () => ({})

const mapDispatchToProps = dispatch => ({
  onOpenTeamProfile: (teamname: string) =>
    dispatch(Route.navigateTo([teamsTab, {props: {teamname: teamname}, selected: 'team'}])),
  onOpenTracker: (username: string) =>
    dispatch(TrackerGen.createGetProfile({forceDisplay: true, ignoreCache: true, username})),
  onOpenUserProfile: (username: string) => dispatch(ProfileGen.createShowUserProfile({username})),
})

const mergeProps = (stateProps, dispatchProps, ownProps: ConnectedNameWithIconProps) => {
  const {onClick, ...props} = ownProps

  let functionOnClick
  let clickType
  if (!isMobile && onClick === 'tracker') {
    functionOnClick = () => {
      ownProps.username && dispatchProps.onOpenTracker(ownProps.username)
    }
    clickType = 'tracker'
  } else if (onClick === 'profile' || (isMobile && onClick === 'tracker')) {
    functionOnClick = () => {
      if (ownProps.username) {
        dispatchProps.onOpenUserProfile(ownProps.username)
      } else if (ownProps.teamname) {
        dispatchProps.onOpenTeamProfile(ownProps.teamname)
      }
    }
    clickType = 'profile'
  } else if (typeof onClick === 'function') {
    functionOnClick = onClick
    clickType = 'custom'
  }

  return {
    ...props,
    clickType,
    onClick: functionOnClick,
  }
}

const ConnectedNameWithIcon = compose(
  connect(mapStateToProps, mapDispatchToProps, mergeProps),
  setDisplayName('NameWithIcon')
)(NameWithIcon)

export default ConnectedNameWithIcon
