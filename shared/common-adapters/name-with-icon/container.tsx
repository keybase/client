import * as C from '@/constants'
import * as React from 'react'
import NameWithIcon, {type NameWithIconProps} from '.'

export type ConnectedNameWithIconProps = {
  onClick?: 'tracker' | 'profile' | NameWithIconProps['onClick']
} & Omit<NameWithIconProps, 'onClick'>

type OwnProps = ConnectedNameWithIconProps

const ConnectedNameWithIcon = (p: OwnProps) => {
  const {onClick, username, teamname, ...props} = p
  const teamID = C.useTeamsState(s => s.teamNameToID.get(teamname ?? ''))
  const clearModals = C.useRouterState(s => s.dispatch.clearModals)
  const navigateAppend = C.useRouterState(s => s.dispatch.navigateAppend)
  const onOpenTeamProfile = React.useCallback(() => {
    if (teamID) {
      clearModals()
      navigateAppend({props: {teamID}, selected: 'team'})
    }
  }, [clearModals, navigateAppend, teamID])
  const showUser = C.useTrackerState(s => s.dispatch.showUser)
  const onOpenTracker = React.useCallback(() => {
    username && showUser(username, true)
  }, [showUser, username])
  const showUserProfile = C.useProfileState(s => s.dispatch.showUserProfile)
  const onOpenUserProfile = React.useCallback(() => {
    username && showUserProfile(username)
  }, [username, showUserProfile])

  let functionOnClick: NameWithIconProps['onClick']
  let clickType: NameWithIconProps['clickType'] = 'onClick'
  switch (onClick) {
    case 'tracker': {
      if (!C.isMobile) {
        if (username) {
          functionOnClick = onOpenTracker
        }
      } else if (username) {
        functionOnClick = onOpenUserProfile
      } else if (teamID) {
        functionOnClick = onOpenTeamProfile
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
