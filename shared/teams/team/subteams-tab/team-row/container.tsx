import * as I from 'immutable'
import * as Types from '../../../../constants/types/teams'
import * as FsTypes from '../../../../constants/types/fs'
import * as Constants from '../../../../constants/teams'
import {TeamRow} from '../../../main'
import {connect} from '../../../../util/container'
import * as RouteTreeGen from '../../../../actions/route-tree-gen'
import * as FsConstants from '../../../../constants/fs'

type OwnProps = {
  teamname: string
}

export default connect(
  (state, {teamname}: OwnProps) => ({
    _newTeamRequests: state.teams.newTeamRequests,
    _teamNameToIsOpen: state.teams.teamNameToIsOpen || I.Map(),
    members: Constants.getTeamMemberCount(state, teamname),
    yourRole: Constants.getRole(state, teamname),
  }),
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
      isNew: false,
      isOpen: stateProps._teamNameToIsOpen.toObject()[ownProps.teamname],
      membercount: stateProps.members,
      name: ownProps.teamname,
      newRequests: stateProps._newTeamRequests.filter(team => team === ownProps.teamname).length,
      onManageChat: youAreMember ? () => dispatchProps._onManageChat(ownProps.teamname) : null,
      onOpenFolder: youAreMember ? () => dispatchProps._onOpenFolder(ownProps.teamname) : null,
      onViewTeam: () => dispatchProps._onViewTeam(ownProps.teamname),
    }
  }
)(TeamRow)
