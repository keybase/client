// @flow
import * as Constants from '../../constants/teams'
import * as Types from '../../constants/types/teams'
import * as TeamsGen from '../../actions/teams-gen'
import * as SearchGen from '../../actions/search-gen'
import * as I from 'immutable'
import * as KBFSGen from '../../actions/kbfs-gen'
import * as React from 'react'
import Team, {CustomComponent} from '.'
import {HeaderHoc} from '../../common-adapters'
import {compose, lifecycle, withState} from 'recompose'
import {connect, type TypedState} from '../../util/container'
import {createGetProfile} from '../../actions/tracker-gen'
import {isMobile} from '../../constants/platform'
import {navigateAppend} from '../../actions/route-tree'
import {createShowUserProfile} from '../../actions/profile-gen'
import {anyWaiting} from '../../constants/waiting'

type StateProps = {
  _invites: I.Set<Types.InviteInfo>,
  _requests: I.Set<Types.RequestInfo>,
  _subteams: I.Set<Types.Teamname>,
  _newTeamRequests: I.List<string>,
  loading: boolean,
  name: Types.Teamname,
  openTeam: boolean,
  selectedTab: string,
  you: ?string,
  yourRole: ?Types.TeamRoleType,
  yourOperations: Types.TeamOperations,
}

const mapStateToProps = (state: TypedState, {routeProps, routeState}): StateProps => {
  const teamname = routeProps.get('teamname')
  if (!teamname) {
    throw new Error('There was a problem loading the team page, please report this error.')
  }
  const _subteams = state.entities.getIn(['teams', 'teamNameToSubteams', teamname], I.Set()).sort()

  return {
    _requests: state.entities.getIn(['teams', 'teamNameToRequests', teamname], I.Set()),
    _invites: state.entities.getIn(['teams', 'teamNameToInvites', teamname], I.Set()),
    description: state.entities.getIn(['teams', 'teamNameToPublicitySettings', teamname, 'description'], ''),
    _newTeamRequests: state.entities.getIn(['teams', 'newTeamRequests'], I.List()),
    ignoreAccessRequests: state.entities.getIn(
      ['teams', 'teamNameToPublicitySettings', teamname, 'ignoreAccessRequests'],
      false
    ),
    loading: anyWaiting(state, Constants.teamWaitingKey(teamname)),
    memberCount: state.entities.getIn(['teams', 'teammembercounts', teamname], 0),
    name: teamname,
    openTeam: state.entities.getIn(['teams', 'teamNameToTeamSettings', teamname], {open: false}).open,
    selectedTab: routeState.get('selectedTab') || 'members',
    _subteams,
    waitingForSavePublicity: anyWaiting(
      state,
      Constants.settingsWaitingKey(teamname),
      Constants.teamWaitingKey(teamname)
    ),
    you: state.config.username,
    yourRole: Constants.getRole(state, teamname),
    yourOperations: Constants.getCanPerform(state, teamname),
  }
}

type DispatchProps = {
  _loadTeam: (teamname: Types.Teamname) => void,
  _onOpenFolder: (teamname: Types.Teamname) => void,
  _onAddPeople: (teamname: Types.Teamname) => void,
  _onAddSelf: (teamname: Types.Teamname, you: string) => void,
  _onInviteByEmail: (teamname: Types.Teamname) => void,
  _onManageChat: (teamname: Types.Teamname) => void,
  _onLeaveTeam: (teamname: Types.Teamname) => void,
  onCreateSubteam: () => void,
  setSelectedTab: (tab: string) => void,
  onBack: () => void,
  _onEditDescription: () => void,
}

const mapDispatchToProps = (
  dispatch: Dispatch,
  {navigateUp, newOpenTeamRole, setOpenTeamRole, setRouteState, routeProps}
): DispatchProps => ({
  _loadTeam: teamname => dispatch(TeamsGen.createGetDetails({teamname})),
  _onAddPeople: (teamname: Types.Teamname) =>
    dispatch(navigateAppend([{props: {teamname}, selected: 'addPeople'}])),
  _onAddSelf: (teamname: Types.Teamname, you: ?string) => {
    if (you) {
      dispatch(navigateAppend([{props: {teamname}, selected: 'addPeople'}]))
      dispatch(SearchGen.createAddResultsToUserInput({searchKey: 'addToTeamSearch', searchResults: [you]}))
    }
  },
  _onInviteByEmail: (teamname: Types.Teamname) =>
    dispatch(navigateAppend([{props: {teamname}, selected: 'inviteByEmail'}])),
  _onLeaveTeam: (teamname: Types.Teamname) =>
    dispatch(navigateAppend([{props: {teamname}, selected: 'reallyLeaveTeam'}])),
  _onManageChat: (teamname: Types.Teamname) =>
    dispatch(navigateAppend([{props: {teamname}, selected: 'manageChannels'}])),
  _onOpenFolder: (teamname: Types.Teamname) =>
    dispatch(KBFSGen.createOpen({path: `/keybase/team/${teamname}`})),
  onCreateSubteam: () =>
    dispatch(
      navigateAppend([{props: {name: `${routeProps.get('teamname')}.`}, selected: 'showNewTeamDialog'}])
    ),
  onUsernameClick: (username: string) => {
    isMobile
      ? dispatch(createShowUserProfile({username}))
      : dispatch(createGetProfile({username, ignoreCache: true, forceDisplay: true}))
  },
  setSelectedTab: selectedTab => setRouteState({selectedTab}),
  onBack: () => dispatch(navigateUp()),
  _onEditDescription: () =>
    dispatch(
      navigateAppend([{props: {teamname: routeProps.get('teamname')}, selected: 'editTeamDescription'}])
    ),
})

const mergeProps = (stateProps, dispatchProps, ownProps) => {
  const onAddPeople = () => dispatchProps._onAddPeople(stateProps.name)
  const onInviteByEmail = () => dispatchProps._onInviteByEmail(stateProps.name)
  const onOpenFolder = () => dispatchProps._onOpenFolder(stateProps.name)
  const onManageChat = () => dispatchProps._onManageChat(stateProps.name)
  const onLeaveTeam = () => dispatchProps._onLeaveTeam(stateProps.name)
  const onEditDescription = () => dispatchProps._onEditDescription()

  const you = stateProps.you
  const yourOperations = stateProps.yourOperations

  const onAddSelf = () => dispatchProps._onAddSelf(stateProps.name, you)

  const customComponent = (
    <CustomComponent
      onOpenFolder={onOpenFolder}
      onManageChat={onManageChat}
      onShowMenu={() => ownProps.setShowMenu(true)}
      canManageChat={yourOperations.leaveTeam}
    />
  )

  return {
    ...stateProps,
    ...dispatchProps,
    ...ownProps,
    customComponent,
    headerStyle: {borderBottomWidth: 0},
    numInvites: stateProps._invites.size,
    numRequests: stateProps._requests.size,
    numSubteams: stateProps._subteams.size,
    newTeamRequests: stateProps._newTeamRequests.toArray(),
    onAddPeople,
    onAddSelf,
    onInviteByEmail,
    onLeaveTeam,
    onManageChat,
    onOpenFolder,
    onEditDescription,
    yourOperations,
  }
}

export default compose(
  withState('showMenu', 'setShowMenu', false),
  connect(mapStateToProps, mapDispatchToProps, mergeProps),
  lifecycle({
    componentDidMount: function() {
      this.props._loadTeam(this.props.name)
    },
    componentWillReceiveProps: function(nextProps) {
      if (this.props.name !== nextProps.name) {
        this.props._loadTeam(nextProps.name)
        this.props.setSelectedTab('members')
      }
    },
  }),
  HeaderHoc
)(Team)
