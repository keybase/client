import * as Container from '../../util/container'
import * as React from 'react'
import * as TeamsConstants from '../../constants/teams'
import type * as TeamsTypes from '../../constants/types/teams'
import * as RouteTreeGen from '../../actions/route-tree-gen'
import * as TeamsGen from '../../actions/teams-gen'
import {TeamWithPopup} from './'
import type {TextType} from '../text'

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

  const dispatch = Container.useDispatch()
  const _onJoinTeam = React.useCallback(
    (teamname: string) => dispatch(TeamsGen.createJoinTeam({teamname})),
    [dispatch]
  )
  const _onViewTeam = React.useCallback(
    (teamID: TeamsTypes.TeamID) => {
      dispatch(RouteTreeGen.createClearModals())
      dispatch(RouteTreeGen.createNavigateAppend({path: [{props: {teamID}, selected: 'team'}]}))
    },
    [dispatch]
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
