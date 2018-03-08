// @flow
import * as Constants from '../../constants/teams'
import * as I from 'immutable'
import * as React from 'react'
import * as TeamsGen from '../../actions/teams-gen'
import * as KBFSGen from '../../actions/kbfs-gen'
import * as Chat2Gen from '../../actions/chat2-gen'
import Team, {CustomComponent} from '.'
import {HeaderHoc} from '../../common-adapters'
import {branch, connect, lifecycle, compose, type TypedState} from '../../util/container'
import {navigateAppend} from '../../actions/route-tree'
import {anyWaiting} from '../../constants/waiting'
import {teamsTab} from '../../constants/tabs'

import {membersListItemsConnector} from './members/container'
import {subteamsListItemsConnector} from './subteams/container'
import {requestsAndInvitesListItemsConnector} from './invites/container'

/**
 * WARNING: Never add a prop here called `listItems`. That is used by the
 * connectors pulled in for switching the tab views.
 */

const mapStateToProps = (state: TypedState, {routeProps, routeState}) => {
  const teamname = routeProps.get('teamname')
  if (!teamname) {
    throw new Error('There was a problem loading the team page, please report this error.')
  }
  const yourOperations = Constants.getCanPerform(state, teamname)

  return {
    teamname,
    admin: yourOperations.manageMembers,
    memberCount: state.entities.getIn(['teams', 'teammembercounts', teamname], 0),
    _newTeamRequests: state.entities.getIn(['teams', 'newTeamRequests'], I.List()),
    numInvites: state.entities.getIn(['teams', 'teamNameToInvites', teamname], I.Set()).size,
    numRequests: state.entities.getIn(['teams', 'teamNameToRequests', teamname], I.Set()).size,
    numSubteams: state.entities.getIn(['teams', 'teamNameToSubteams', teamname], I.Set()).size,
    loading: anyWaiting(state, Constants.teamWaitingKey(teamname)),
    resetUserCount: state.entities.getIn(['teams', 'teamNameToResetUsers', teamname], I.Set()).size,
    selectedTab: routeState.get('selectedTab') || 'members',
    yourOperations,
  }
}

const mapDispatchToProps = (
  dispatch: Dispatch,
  {navigateUp, newOpenTeamRole, setOpenTeamRole, setRouteState, routeProps}
) => {
  const teamname = routeProps.get('teamname')
  return {
    setSelectedTab: selectedTab => setRouteState({selectedTab}),
    onChat: () => dispatch(Chat2Gen.createStartConversation({tlf: `/keybase/team/${teamname}`})),
    _loadTeam: teamname => dispatch(TeamsGen.createGetDetails({teamname})),
    onBack: () => dispatch(navigateUp()),
    onShowMenu: target =>
      dispatch(
        navigateAppend(
          [
            {
              props: {
                teamname,
                position: 'bottom left',
                targetRect: target && target.getBoundingClientRect(),
              },
              selected: 'menu',
            },
          ],
          [teamsTab, 'team']
        )
      ),

    _onOpenFolder: () => dispatch(KBFSGen.createOpen({path: `/keybase/team/${teamname}`})),
  }
}

const mergeProps = (stateProps, dispatchProps, ownProps) => {
  const customComponent = (
    <CustomComponent
      onOpenFolder={dispatchProps.onOpenFolder}
      onChat={dispatchProps.onChat}
      onShowMenu={dispatchProps.onShowMenu}
      canChat={!stateProps.yourOperations.joinTeam}
      canViewFolder={!stateProps.yourOperations.joinTeam}
    />
  )
  return {
    ...stateProps,
    ...dispatchProps,
    ...ownProps,
    customComponent,
    newTeamRequests: stateProps._newTeamRequests.toArray(),
  }
}

export default compose(
  connect(mapStateToProps, mapDispatchToProps, mergeProps),
  lifecycle({
    componentDidMount: function() {
      this.props._loadTeam(this.props.teamname)
    },
    componentWillReceiveProps: function(nextProps) {
      if (this.props.teamname !== nextProps.teamname) {
        this.props._loadTeam(nextProps.teamname)
        this.props.setSelectedTab('members')
      }
    },
  }),
  branch(props => props.selectedTab === 'members', membersListItemsConnector),
  branch(props => props.selectedTab === 'subteams', subteamsListItemsConnector),
  branch(props => props.selectedTab === 'invites', requestsAndInvitesListItemsConnector),
  HeaderHoc
)(Team)
