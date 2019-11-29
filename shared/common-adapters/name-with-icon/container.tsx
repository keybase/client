import * as ProfileGen from '../../actions/profile-gen'
import * as RouteTreeGen from '../../actions/route-tree-gen'
import * as Tracker2Gen from '../../actions/tracker2-gen'
import NameWithIcon, {NameWithIconProps} from '.'
import * as Container from '../../util/container'
import {TeamID} from '../../constants/types/teams'

export type ConnectedNameWithIconProps = {
  onClick?: 'tracker' | 'profile' | NameWithIconProps['onClick'] | (() => void)
} & Omit<NameWithIconProps, 'onClick'>

type OwnProps = ConnectedNameWithIconProps

const mapStateToProps = (state: Container.TypedState) => ({_teamNameToID: state.teams.teamNameToID})

const mapDispatchToProps = dispatch => ({
  onOpenTeamProfile: (teamID: TeamID) => {
    dispatch(RouteTreeGen.createClearModals())
    dispatch(RouteTreeGen.createNavigateAppend({path: [{props: {teamID}, selected: 'team'}]}))
  },
  onOpenTracker: (username: string) => dispatch(Tracker2Gen.createShowUser({asTracker: true, username})),
  onOpenUserProfile: (username: string) => dispatch(ProfileGen.createShowUserProfile({username})),
})

const mergeProps = (
  _stateProps,
  dispatchProps: ReturnType<typeof mapDispatchToProps>,
  ownProps: OwnProps
) => {
  const {onClick, username, teamname, ...props} = ownProps
  const teamID = teamname && _stateProps._teamNameToID.get(teamname)
  let functionOnClick
  let clickType
  // Since there's no tracker on mobile, we can't open it. Fallback to profile.
  if (!Container.isMobile && onClick === 'tracker') {
    if (username) {
      functionOnClick = () => dispatchProps.onOpenTracker(username)
    }
    clickType = 'tracker'
  } else if (onClick === 'profile' || (Container.isMobile && onClick === 'tracker')) {
    if (username) {
      functionOnClick = () => dispatchProps.onOpenUserProfile(username)
    } else if (teamID) {
      functionOnClick = () => dispatchProps.onOpenTeamProfile(teamID)
    }
    clickType = 'profile'
  } else if (onClick) {
    clickType = 'onClick'
    functionOnClick = onClick
  }

  return {
    ...props,
    clickType,
    onClick: functionOnClick,
    teamname,
    username,
  }
}

const ConnectedNameWithIcon = Container.namedConnect(
  mapStateToProps,
  mapDispatchToProps,
  mergeProps,
  'NameWithIcon'
)(NameWithIcon)

export default ConnectedNameWithIcon
