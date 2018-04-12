// @flow
import {connect, type TypedState} from '../../../util/container'
import * as I from 'immutable'
import * as Constants from '../../../constants/teams'
import * as Types from '../../../constants/types/teams'
import {anyWaiting} from '../../../constants/waiting'
import Tabs from '.'

export type OwnProps = {
  selectedTab: Types.TabKey,
  setSelectedTab: Types.TabKey => void,
  teamname: string,
}

const mapStateToProps = (state: TypedState, ownProps: OwnProps) => ({
  _newTeamRequests: state.teams.getIn(['newTeamRequests'], I.List()),
  loading: anyWaiting(state, Constants.teamWaitingKey(ownProps.teamname)),
  memberCount: Constants.getTeamMemberCount(state, ownProps.teamname),
  numInvites: Constants.getTeamInvites(state, ownProps.teamname).size,
  numRequests: Constants.getTeamRequests(state, ownProps.teamname).size,
  numResetUsers: Constants.getTeamResetUsers(state, ownProps.teamname).size,
  numSubteams: Constants.getTeamSubteams(state, ownProps.teamname).size,
  yourOperations: Constants.getCanPerform(state, ownProps.teamname),
})

const mergeProps = (stateProps, _, ownProps: OwnProps) => {
  const numNewRequests = stateProps._newTeamRequests.count(tn => tn === ownProps.teamname)
  return {
    admin: stateProps.yourOperations.manageMembers,
    loading: stateProps.loading,
    memberCount: stateProps.memberCount,
    numInvites: stateProps.numInvites,
    numNewRequests,
    numRequests: stateProps.numRequests,
    numResetUsers: stateProps.numResetUsers,
    numSubteams: stateProps.numSubteams,
    selectedTab: ownProps.selectedTab,
    setSelectedTab: ownProps.setSelectedTab,
    yourOperations: stateProps.yourOperations,
  }
}

export default connect(mapStateToProps, null, mergeProps)(Tabs)
