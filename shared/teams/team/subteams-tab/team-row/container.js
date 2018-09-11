// @flow
import * as I from 'immutable'
import * as Types from '../../../../constants/types/teams'
import * as Constants from '../../../../constants/teams'
import {TeamRow} from '../../../main/team-list'
import {connect, type TypedState} from '../../../../util/container'
import {navigateAppend} from '../../../../actions/route-tree'
import * as KBFSGen from '../../../../actions/kbfs-gen'

type OwnProps = {
  teamname: string,
}

const mapStateToProps = (state: TypedState, {teamname}: OwnProps) => ({
  _newTeamRequests: state.teams.getIn(['newTeamRequests'], I.List()),
  _teamNameToIsOpen: state.teams.getIn(['teamNameToIsOpen'], I.Map()),
  members: Constants.getTeamMemberCount(state, teamname),
  yourRole: Constants.getRole(state, teamname),
})

const mapDispatchToProps = (dispatch, ownProps: OwnProps) => ({
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
    newRequests: stateProps._newTeamRequests.toArray().filter(team => team === ownProps.teamname).length,
    onOpenFolder: youAreMember ? () => dispatchProps._onOpenFolder(ownProps.teamname) : null,
    onManageChat: youAreMember ? () => dispatchProps._onManageChat(ownProps.teamname) : null,
    onViewTeam: () => dispatchProps._onViewTeam(ownProps.teamname),
  }
}

export default connect(mapStateToProps, mapDispatchToProps, mergeProps)(TeamRow)
