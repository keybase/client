import * as ProfileGen from '../../actions/profile-gen'
import * as RouteTreeGen from '../../actions/route-tree-gen'
import * as Tracker2Gen from '../../actions/tracker2-gen'
import NameWithIcon, {NameWithIconProps} from '.'
import * as Container from '../../util/container'
import {TeamID} from '../../constants/types/teams'

export type ConnectedNameWithIconProps = {
  onClick?: 'tracker' | 'profile' | NameWithIconProps['onClick']
} & Omit<NameWithIconProps, 'onClick'>

type OwnProps = ConnectedNameWithIconProps

const ConnectedNameWithIcon = Container.namedConnect(
  state => ({_teamNameToID: state.teams.teamNameToID}),
  dispatch => ({
    onOpenTeamProfile: (teamID: TeamID) => {
      dispatch(RouteTreeGen.createClearModals())
      dispatch(RouteTreeGen.createNavigateAppend({path: [{props: {teamID}, selected: 'team'}]}))
    },
    onOpenTracker: (username: string) => dispatch(Tracker2Gen.createShowUser({asTracker: true, username})),
    onOpenUserProfile: (username: string) => dispatch(ProfileGen.createShowUserProfile({username})),
  }),
  (_stateProps, dispatchProps, ownProps: OwnProps) => {
    const {onClick, username, teamname, ...props} = ownProps
    const teamID = teamname && _stateProps._teamNameToID.get(teamname)
    let functionOnClick: NameWithIconProps['onClick']
    let clickType: NameWithIconProps['clickType'] = 'onClick'

    switch (onClick) {
      case 'tracker': {
        if (!Container.isMobile) {
          if (username) {
            functionOnClick = () => dispatchProps.onOpenTracker(username)
          }
        } else {
          if (username) {
            functionOnClick = () => dispatchProps.onOpenUserProfile(username)
          } else if (teamID) {
            functionOnClick = () => dispatchProps.onOpenTeamProfile(teamID)
          }
        }
        break
      }
      case 'profile': {
        if (username) {
          functionOnClick = () => dispatchProps.onOpenUserProfile(username)
        } else if (teamID) {
          functionOnClick = () => dispatchProps.onOpenTeamProfile(teamID)
        }
        clickType = 'profile'
        break
      }
      default:
        functionOnClick = onClick
    }

    return {
      ...props,
      clickType,
      onClick: functionOnClick,
      teamname,
      username,
    }
  },
  'NameWithIcon'
)(NameWithIcon)

export default ConnectedNameWithIcon
