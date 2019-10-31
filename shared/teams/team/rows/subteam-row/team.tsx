import * as I from 'immutable'
import * as Types from '../../../../constants/types/teams'
import * as FsTypes from '../../../../constants/types/fs'
import * as Constants from '../../../../constants/teams'
import * as Container from '../../../../util/container'
import {TeamRow} from '../../../main'
import * as RouteTreeGen from '../../../../actions/route-tree-gen'
import * as FsConstants from '../../../../constants/fs'

type OwnProps = {
  teamID: Types.TeamID
}

export default Container.connect(
  (state, {teamID}: OwnProps) => {
    const {isMember, isOpen, teamname} = Constants.getTeamDetails(state, teamID)
    return {
      _isMember: isMember,
      _newTeamRequests: state.teams.newTeamRequests,
      _teamNameToIsOpen: state.teams.teamNameToIsOpen || I.Map(),
      isOpen,
      members: Constants.getTeamMemberCount(state, teamname),
      teamname,
      yourRole: Constants.getRole(state, teamname),
    }
  },
  dispatch => ({
    _onManageChat: (teamname: Types.Teamname) =>
      dispatch(RouteTreeGen.createNavigateAppend({path: [{props: {teamname}, selected: 'manageChannels'}]})),
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
    newRequests: stateProps._newTeamRequests.get(ownProps.teamID) || 0,
    onManageChat: stateProps._isMember ? () => dispatchProps._onManageChat(stateProps.teamname) : null,
    onOpenFolder: () => dispatchProps._onOpenFolder(stateProps.teamname),
    onViewTeam: () => dispatchProps._onViewTeam(ownProps.teamID),
    resetUserCount: 0,
  })
)(TeamRow)
