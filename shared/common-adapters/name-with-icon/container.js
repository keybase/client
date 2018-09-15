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
  onClick?: 'tracker' | 'profile',
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
  const {onClick, username, teamname, ...props} = ownProps

  let functionOnClick
  let clickType
  // Since there's no tracker on mobile, we can't open it. Fallback to profile.
  if (!isMobile && onClick === 'tracker') {
    if (username) {
      functionOnClick = () => dispatchProps.onOpenTracker(username)
    }
    clickType = 'tracker'
  } else if (onClick === 'profile' || (isMobile && onClick === 'tracker')) {
    if (username) {
      functionOnClick = () => dispatchProps.onOpenUserProfile(username)
    } else if (teamname) {
      functionOnClick = () => dispatchProps.onOpenTeamProfile(teamname)
    }
    clickType = 'profile'
  }

  return {
    ...props,
    username,
    teamname,
    clickType,
    onClick: functionOnClick,
  }
}

const ConnectedNameWithIcon = compose(
  connect(mapStateToProps, mapDispatchToProps, mergeProps),
  setDisplayName('NameWithIcon')
)(NameWithIcon)

export default ConnectedNameWithIcon
