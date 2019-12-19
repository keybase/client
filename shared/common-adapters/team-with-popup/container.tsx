import * as Container from '../../util/container'
import * as TeamsConstants from '../../constants/teams'
import * as TeamsTypes from '../../constants/types/teams'
import * as RouteTreeGen from '../../actions/route-tree-gen'
import * as TeamsGen from '../../actions/teams-gen'
import {TeamWithPopup} from './'
import {TextType} from '../text'

type OwnProps = {
  inline?: boolean
  prefix?: string
  teamName: string
  type: TextType
  underline?: boolean
}

const ConnectedTeamWithPopup = Container.connect(
  (state, {teamName}: OwnProps) => {
    const _teamID = TeamsConstants.getTeamID(state, teamName)
    const details: TeamsTypes.TeamDetails = TeamsConstants.getTeamDetails(state, _teamID)
    return {
      _teamID,
      description: TeamsConstants.getTeamPublicitySettings(state, teamName).description,
      isMember: details.isMember,
      isOpen: details.isOpen,
      memberCount: details.memberCount,
    }
  },
  dispatch => ({
    _onJoinTeam: (teamname: string) => dispatch(TeamsGen.createJoinTeam({teamname})),
    _onLoadTeam: (teamname: string) => {
      dispatch(TeamsGen.createGetDetails({teamname}))
    },
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
      loadTeam: () => dispatchProps._onLoadTeam(ownProps.teamName),
      memberCount: stateProps.memberCount,
      onJoinTeam: () => dispatchProps._onJoinTeam(ownProps.teamName),
      onViewTeam: () => dispatchProps._onViewTeam(stateProps._teamID),
      prefix: ownProps.prefix,
      teamName: ownProps.teamName,
      type: ownProps.type,
      underline: ownProps.underline,
    }
  }
)(TeamWithPopup)

export default ConnectedTeamWithPopup
