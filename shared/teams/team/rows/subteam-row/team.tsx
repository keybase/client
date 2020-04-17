import * as Types from '../../../../constants/types/teams'
import * as FsTypes from '../../../../constants/types/fs'
import * as Constants from '../../../../constants/teams'
import * as Container from '../../../../util/container'
import {TeamRow} from '../../../main'
import TeamRowNew from '../../../main/team-row'
import * as RouteTreeGen from '../../../../actions/route-tree-gen'
import * as FsConstants from '../../../../constants/fs'
import flags from '../../../../util/feature-flags'

type OwnProps = {
  teamID: Types.TeamID
  firstItem: boolean
}

const TeamRowOld = Container.connect(
  (state, {teamID}: OwnProps) => {
    const {isMember, isOpen, memberCount, teamname} = Constants.getTeamMeta(state, teamID)
    return {
      _isMember: isMember,
      _newTeamRequests: state.teams.newTeamRequests,
      isOpen,
      members: memberCount,
      teamname,
      yourRole: Constants.getRole(state, teamID),
    }
  },
  dispatch => ({
    _onManageChat: (teamID: Types.TeamID) =>
      dispatch(RouteTreeGen.createNavigateAppend({path: [{props: {teamID}, selected: 'manageChannels'}]})),
    _onOpenFolder: (teamname: Types.Teamname) =>
      dispatch(
        FsConstants.makeActionForOpenPathInFilesTab(FsTypes.stringToPath(`/keybase/team/${teamname}`))
      ),
    _onViewTeam: (teamID: Types.TeamID) => {
      dispatch(RouteTreeGen.createNavigateAppend({path: [{props: {teamID}, selected: 'team'}]}))
    },
  }),
  (stateProps, dispatchProps, ownProps: OwnProps) => ({
    firstItem: false,
    isNew: false,
    isOpen: !!stateProps.isOpen,
    membercount: stateProps.members,
    name: stateProps.teamname,
    newRequests: stateProps._newTeamRequests.get(ownProps.teamID)?.size ?? 0,
    onManageChat: stateProps._isMember ? () => dispatchProps._onManageChat(ownProps.teamID) : undefined,
    onOpenFolder: () => dispatchProps._onOpenFolder(stateProps.teamname),
    onViewTeam: () => dispatchProps._onViewTeam(ownProps.teamID),
    resetUserCount: 0,
  })
)(TeamRow)

export default flags.teamsRedesign ? TeamRowNew : TeamRowOld
