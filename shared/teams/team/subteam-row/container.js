// @flow
import * as I from 'immutable'
import * as Types from '../../../constants/types/teams'
import * as Constants from '../../../constants/teams'
import {TeamRow} from '../../main/team-list'
import {connect, type TypedState} from '../../../util/container'
import {navigateAppend} from '../../../actions/route-tree'
import * as KBFSGen from '../../../actions/kbfs-gen'

type OwnProps = {
  teamname: string,
}

const mapStateToProps = (state: TypedState, {teamname}: OwnProps) => ({
  _newTeams: state.entities.getIn(['teams', 'newTeams'], I.Set()),
  _newTeamRequests: state.entities.getIn(['teams', 'newTeamRequests'], I.List()),
  _teamNameToIsOpen: state.entities.getIn(['teams', 'teamNameToIsOpen'], I.Map()),
  members: state.entities.getIn(['teams', 'teammembercounts', teamname], 0),
  yourOperations: Constants.getCanPerform(state, teamname),
  yourRole: Constants.getRole(state, teamname),
})

const mapDispatchToProps = (dispatch: Dispatch, ownProps: OwnProps) => ({
  _onManageChat: (teamname: Types.Teamname) =>
    dispatch(navigateAppend([{props: {teamname}, selected: 'manageChannels'}])),
  _onOpenFolder: (teamname: Types.Teamname) =>
    dispatch(KBFSGen.createOpen({path: `/keybase/team/${teamname}`})),
  _onViewTeam: (teamname: Types.Teamname) => {
    dispatch(navigateAppend([{props: {teamname}, selected: 'team'}]))
  },
})

const mergeProps = (stateProps, dispatchProps, ownProps: OwnProps) => {
  const youAreMember = stateProps.yourRole && stateProps.yourRole !== 'none'
  return {
    name: ownProps.teamname,
    membercount: stateProps.members,
    isNew: false,
    isOpen: stateProps._teamNameToIsOpen.toObject()[ownProps.teamname],
    newTeams: stateProps._newTeams.toArray(),
    newRequests: stateProps._newTeamRequests.toArray().filter(team => team === ownProps.teamname).length,
    onOpenFolder: youAreMember ? () => dispatchProps._onOpenFolder(ownProps.teamname) : null,
    onManageChat: youAreMember ? () => dispatchProps._onManageChat(ownProps.teamname) : null,
    onViewTeam: () => dispatchProps._onViewTeam(ownProps.teamname),
    yourOperations: stateProps.yourOperations,
    yourRole: stateProps.yourRole,
  }
}

const ConnectedTeamRow = connect(mapStateToProps, mapDispatchToProps, mergeProps)(TeamRow)
export default ConnectedTeamRow
