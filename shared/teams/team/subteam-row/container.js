// @flow
import * as I from 'immutable'
import * as React from 'react'
import * as Types from '../../../constants/types/teams'
import * as TeamsGen from '../../../actions/teams-gen'
import {TeamRow} from '../../main/team-list'
import {amIFollowing} from '../../../constants/selectors'
import {teamsTab} from '../../../constants/tabs'
import {connect} from 'react-redux'
import {navigateTo} from '../../../actions/route-tree'
import * as KBFSGen from '../../../actions/kbfs-gen'

import type {TypedState} from '../../../constants/reducer'

type OwnProps = {
  teamname: string,
}

type StateProps = {
  members: number,
}

const mapStateToProps = (
  state: TypedState,
  {teamname}: OwnProps
): StateProps => ({
  members: state.entities.getIn(['teams', 'teammembercounts', teamname], 0),
  _newTeams: state.entities.getIn(['teams', 'newTeams'], I.Set()),
  _newTeamRequests: state.entities.getIn(['teams', 'newTeamRequests'], I.List()),
})

type DispatchProps = {
  onClick: () => void,
}

const mapDispatchToProps = (dispatch: Dispatch, ownProps: OwnProps): DispatchProps => ({
  _onManageChat: (teamname: Types.Teamname) =>
  dispatch(navigateTo([{props: {teamname}, selected: 'manageChannels'}])),
  _onOpenFolder: (teamname: Types.Teamname) =>
    dispatch(KBFSGen.createOpen({path: `/keybase/team/${teamname}`})),
  _onViewTeam: (teamname: Types.Teamname) => {
    dispatch(navigateTo([teamsTab, {props: {teamname}, selected: 'team'}]))
  },
})

const mergeProps = (stateProps: StateProps, dispatchProps: DispatchProps, ownProps: OwnProps) => {
  console.warn('members and teamname', stateProps, dispatchProps, ownProps)
  return {
    ...ownProps,
    ...stateProps,
    ...dispatchProps,
    name: ownProps.teamname,
    membercount: stateProps.members,
    isNew: false,
    newTeams: stateProps._newTeams.toArray(),
    newTeamRequests: stateProps._newTeamRequests.toArray(),
    onOpenFolder: () => dispatchProps._onOpenFolder(ownProps.teamname),
    onManageChat: () => dispatchProps._onManageChat(ownProps.teamname),
    onViewTeam: () => dispatchProps._onViewTeam(ownProps.teamname),
  }
}

const ConnectedTeamRow = connect(mapStateToProps, mapDispatchToProps, mergeProps)(TeamRow)

export default function(i: number, props: OwnProps) {
  return <ConnectedTeamRow key={props.teamname} {...props} />
}
