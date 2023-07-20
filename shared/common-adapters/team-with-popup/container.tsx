import * as React from 'react'
import * as TeamsConstants from '../../constants/teams'
import * as RouterConstants from '../../constants/router2'
import type * as TeamsTypes from '../../constants/types/teams'
import type {TextType} from '../text'
import {TeamWithPopup} from './'

type OwnProps = {
  inline?: boolean
  prefix?: string
  shouldLoadTeam?: boolean
  teamName: string
  type: TextType
  underline?: boolean
}

const ConnectedTeamWithPopup = (ownProps: OwnProps) => {
  const teamID = TeamsConstants.useState(s => TeamsConstants.getTeamID(s, ownProps.teamName))
  const meta = TeamsConstants.useState(s => TeamsConstants.getTeamMeta(s, teamID))
  const description = TeamsConstants.useState(s => s.teamDetails.get(teamID)?.description) ?? ''
  const stateProps = {
    description,
    isMember: meta.isMember,
    isOpen: meta.isOpen,
    memberCount: meta.memberCount,
    teamID,
  }
  const joinTeam = TeamsConstants.useState(s => s.dispatch.joinTeam)
  const _onJoinTeam = joinTeam
  const clearModals = RouterConstants.useState(s => s.dispatch.clearModals)
  const navigateAppend = RouterConstants.useState(s => s.dispatch.navigateAppend)
  const _onViewTeam = React.useCallback(
    (teamID: TeamsTypes.TeamID) => {
      clearModals()
      navigateAppend({props: {teamID}, selected: 'team'})
    },
    [clearModals, navigateAppend]
  )

  const props = {
    description: stateProps.description,
    inline: ownProps.inline,
    isMember: stateProps.isMember,
    isOpen: stateProps.isOpen,
    memberCount: stateProps.memberCount,
    onJoinTeam: () => _onJoinTeam(ownProps.teamName),
    onViewTeam: () => _onViewTeam(stateProps.teamID),
    prefix: ownProps.prefix,
    shouldLoadTeam: ownProps.shouldLoadTeam,
    teamID: stateProps.teamID,
    teamName: ownProps.teamName,
    type: ownProps.type,
    underline: ownProps.underline,
  }
  return <TeamWithPopup {...props} />
}

export default ConnectedTeamWithPopup
