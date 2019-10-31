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
    const {teamname} = Constants.getTeamDetails(state, teamID)
    return {
      _newTeamRequests: state.teams.newTeamRequests,
      _teamNameToIsOpen: state.teams.teamNameToIsOpen || I.Map(),
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
    _onViewTeam: (teamname: Types.Teamname) => {
      dispatch(RouteTreeGen.createNavigateAppend({path: [{props: {teamname}, selected: 'team'}]}))
    },
  }),
  (stateProps, dispatchProps, ownProps: OwnProps) => {
    const youAreMember = stateProps.yourRole && stateProps.yourRole !== 'none'
    return {
      firstItem: false,
      isNew: false,
      isOpen: stateProps._teamNameToIsOpen.toObject()[stateProps.teamname] || false,
      membercount: stateProps.members,
      name: stateProps.teamname,
      newRequests: stateProps._newTeamRequests.get(ownProps.teamID) || 0,
      onManageChat: youAreMember ? () => dispatchProps._onManageChat(stateProps.teamname) : null,
      onOpenFolder: () => dispatchProps._onOpenFolder(stateProps.teamname),
      onViewTeam: () => dispatchProps._onViewTeam(stateProps.teamname),
      resetUserCount: 0,
    }
  }
)(TeamRow)
