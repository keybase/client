import * as React from 'react'
import * as RouteTreeGen from '../../actions/route-tree-gen'
import * as Tracker2Gen from '../../actions/tracker2-gen'
import NameWithIcon, {type NameWithIconProps} from '.'
import * as Container from '../../util/container'
import * as ProfileConstants from '../../constants/profile'
import * as TeamsConstants from '../../constants/teams'

export type ConnectedNameWithIconProps = {
  onClick?: 'tracker' | 'profile' | NameWithIconProps['onClick']
} & Omit<NameWithIconProps, 'onClick'>

type OwnProps = ConnectedNameWithIconProps

const ConnectedNameWithIcon = (p: OwnProps) => {
  const {onClick, username, teamname, ...props} = p
  const teamID = TeamsConstants.useState(s => s.teamNameToID.get(teamname ?? ''))
  const dispatch = Container.useDispatch()
  const onOpenTeamProfile = React.useCallback(() => {
    if (teamID) {
      dispatch(RouteTreeGen.createClearModals())
      dispatch(RouteTreeGen.createNavigateAppend({path: [{props: {teamID}, selected: 'team'}]}))
    }
  }, [dispatch, teamID])
  const onOpenTracker = React.useCallback(() => {
    username && dispatch(Tracker2Gen.createShowUser({asTracker: true, username}))
  }, [dispatch, username])
  const showUserProfile = ProfileConstants.useState(s => s.dispatch.showUserProfile)
  const onOpenUserProfile = React.useCallback(() => {
    username && showUserProfile(username)
  }, [username, showUserProfile])

  let functionOnClick: NameWithIconProps['onClick']
  let clickType: NameWithIconProps['clickType'] = 'onClick'
  switch (onClick) {
    case 'tracker': {
      if (!Container.isMobile) {
        if (username) {
          functionOnClick = onOpenTracker
        }
      } else {
        if (username) {
          functionOnClick = onOpenUserProfile
        } else if (teamID) {
          functionOnClick = onOpenTeamProfile
        }
      }
      break
    }
    case 'profile': {
      if (username) {
        functionOnClick = onOpenUserProfile
      } else if (teamID) {
        functionOnClick = onOpenTeamProfile
      }
      clickType = 'profile'
      break
    }
    default:
      functionOnClick = onClick
  }

  return (
    <NameWithIcon
      {...props}
      clickType={clickType}
      onClick={functionOnClick}
      teamname={teamname}
      username={username}
    />
  )
}

export default ConnectedNameWithIcon
