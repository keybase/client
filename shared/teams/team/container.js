// @flow
import * as Constants from '../../constants/teams'
import * as I from 'immutable'
import * as React from 'react'
import * as TeamsGen from '../../actions/teams-gen'
import * as KBFSGen from '../../actions/kbfs-gen'
import * as ChatGen from '../../actions/chat-gen'
import Team, {CustomComponent} from '.'
import {HeaderHoc} from '../../common-adapters'
import {branch, connect, withStateHandlers, lifecycle, compose, type TypedState} from '../../util/container'
import {navigateAppend} from '../../actions/route-tree'
import {anyWaiting} from '../../constants/waiting'

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
    onManageChat: () => dispatch(navigateAppend([{props: {teamname}, selected: 'manageChannels'}])),
    onChat: () => dispatch(ChatGen.createOpenTeamConversation({teamname, channelname: 'general'})),
    onLeaveTeam: () => dispatch(navigateAppend([{props: {teamname}, selected: 'reallyLeaveTeam'}])),
    onCreateSubteam: () =>
      dispatch(navigateAppend([{props: {name: teamname}, selected: 'showNewTeamDialog'}])),
    _loadTeam: teamname => dispatch(TeamsGen.createGetDetails({teamname})),
    onBack: () => dispatch(navigateUp()),

    _onOpenFolder: () => dispatch(KBFSGen.createOpen({path: `/keybase/team/${teamname}`})),
  }
}

const mergeProps = (stateProps, dispatchProps, ownProps) => {
  const customComponent = (
    <CustomComponent
      onOpenFolder={dispatchProps.onOpenFolder}
      onChat={dispatchProps.onChat}
      onShowMenu={() => ownProps.setShowMenu(!ownProps.showMenu)}
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
  withStateHandlers({showMenu: false}, {setShowMenu: () => showMenu => ({showMenu})}),
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
