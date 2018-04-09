// @flow
import * as Constants from '../../constants/teams'
import * as I from 'immutable'
import * as React from 'react'
import * as TeamsGen from '../../actions/teams-gen'
import * as KBFSGen from '../../actions/kbfs-gen'
import * as Chat2Gen from '../../actions/chat2-gen'
import Team, {CustomComponent, type Props} from '.'
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
    memberCount: Constants.getTeamMemberCount(state, teamname),
    _newTeamRequests: state.teams.getIn(['newTeamRequests'], I.List()),
    numInvites: Constants.getTeamInvites(state, teamname).size,
    numRequests: Constants.getTeamRequests(state, teamname).size,
    numSubteams: Constants.getTeamSubteams(state, teamname).size,
    loading: anyWaiting(state, Constants.teamWaitingKey(teamname)),
    resetUserCount: Constants.getTeamResetUsers(state, teamname).size,
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

    onOpenFolder: () => dispatch(KBFSGen.createOpen({path: `/keybase/team/${teamname}`})),
  }
}

const mergeProps = (stateProps, dispatchProps): Props => {
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
    customComponent,
    newTeamRequests: stateProps._newTeamRequests.toArray(),
  }
}

export default compose(
  connect(mapStateToProps, mapDispatchToProps, mergeProps),
  lifecycle({
    componentDidMount() {
      this.props._loadTeam(this.props.teamname)
    },
    componentDidUpdate(prevProps) {
      if (this.props.teamname !== prevProps.teamname) {
        this.props._loadTeam(this.props.teamname)
        this.props.setSelectedTab('members')
      }
    },
  }),
  // TODO remove these branches, lets not send all these props to all possible outcomes
  branch(props => props.selectedTab === 'members', membersListItemsConnector),
  // $FlowIssue passing extra props
  branch(props => props.selectedTab === 'subteams', subteamsListItemsConnector),
  branch(props => props.selectedTab === 'invites', requestsAndInvitesListItemsConnector),
  HeaderHoc
)(Team)
