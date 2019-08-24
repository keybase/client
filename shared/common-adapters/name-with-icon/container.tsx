import * as ProfileGen from '../../actions/profile-gen'
import * as RouteTreeGen from '../../actions/route-tree-gen'
import * as Tracker2Gen from '../../actions/tracker2-gen'
import NameWithIcon, {NameWithIconProps} from '.'
import {namedConnect, isMobile} from '../../util/container'
import {teamsTab} from '../../constants/tabs'

export type ConnectedNameWithIconProps = {
  onClick?: 'tracker' | 'profile' | NameWithIconProps['onClick']
} & Omit<NameWithIconProps, 'onClick'>

type OwnProps = ConnectedNameWithIconProps

const mapStateToProps = () => ({})

const mapDispatchToProps = dispatch => ({
  onOpenTeamProfile: (teamname: string) => {
    dispatch(RouteTreeGen.createClearModals())
    dispatch(
      RouteTreeGen.createNavigateAppend({path: [teamsTab, {props: {teamname: teamname}, selected: 'team'}]})
    )
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
    clickType,
    onClick: functionOnClick,
    teamname,
    username,
  }
}

const ConnectedNameWithIcon = namedConnect(mapStateToProps, mapDispatchToProps, mergeProps, 'NameWithIcon')(
  NameWithIcon
)

export default ConnectedNameWithIcon
