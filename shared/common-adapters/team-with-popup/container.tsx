import * as Container from '../../util/container'
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

const ConnectedTeamWithPopup = Container.connect(
  (state, {teamName}: OwnProps) => {
    const teamID = TeamsConstants.getTeamID(state, teamName)
    const meta = TeamsConstants.getTeamMeta(state, teamID)
    return {
      description: TeamsConstants.getTeamDetails(state, teamID).description,
      isMember: meta.isMember,
      isOpen: meta.isOpen,
      memberCount: meta.memberCount,
      teamID,
    }
  },
  dispatch => ({
    // TODO: join team by ID
    _onJoinTeam: (teamname: string) => dispatch(TeamsGen.createJoinTeam({teamname})),
    _onViewTeam: (teamID: TeamsTypes.TeamID) => {
      dispatch(RouteTreeGen.createClearModals())
      dispatch(RouteTreeGen.createNavigateAppend({path: [{props: {teamID}, selected: 'team'}]}))
    },
  }),
  (stateProps, dispatchProps, ownProps: OwnProps) => {
    return {
      description: stateProps.description,
      inline: ownProps.inline,
      isMember: stateProps.isMember,
      isOpen: stateProps.isOpen,
      memberCount: stateProps.memberCount,
      onJoinTeam: () => dispatchProps._onJoinTeam(ownProps.teamName),
      onViewTeam: () => dispatchProps._onViewTeam(stateProps.teamID),
      prefix: ownProps.prefix,
      shouldLoadTeam: ownProps.shouldLoadTeam,
      teamID: stateProps.teamID,
      teamName: ownProps.teamName,
      type: ownProps.type,
      underline: ownProps.underline,
    }
  }
)(TeamWithPopup)

export default ConnectedTeamWithPopup
