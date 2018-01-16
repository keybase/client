// @flow
import * as Constants from '../../constants/teams'
import * as Types from '../../constants/types/teams'
import * as RPCTypes from '../../constants/types/rpc-gen'
import * as TeamsGen from '../../actions/teams-gen'
import * as SearchGen from '../../actions/search-gen'
import * as I from 'immutable'
import * as KBFSGen from '../../actions/kbfs-gen'
import * as React from 'react'
import Team, {CustomComponent} from '.'
import {HeaderHoc} from '../../common-adapters'
import {compose, lifecycle, renameProps, withHandlers, withPropsOnChange, withState} from 'recompose'
import {connect, type TypedState} from '../../util/container'
import {createGetProfile} from '../../actions/tracker-gen'
import {isMobile} from '../../constants/platform'
import {anyWaiting} from '../../constants/waiting'
import {navigateAppend} from '../../actions/route-tree'
import {createShowUserProfile} from '../../actions/profile-gen'
import openURL from '../../util/open-url'

const order = {owner: 0, admin: 1, writer: 2, reader: 3}

type StateProps = {
  _invites: I.Set<Types.InviteInfo>,
  _memberInfo: I.Set<Types.MemberInfo>,
  _requests: I.Set<Types.RequestInfo>,
  _newTeamRequests: I.List<string>,
  ignoreAccessRequests: boolean,
  loading: boolean,
  openTeam: boolean,
  openTeamRole: Types.TeamRoleType,
  name: Types.Teamname,
  publicityAnyMember: boolean,
  publicityMember: boolean,
  publicityTeam: boolean,
  selectedTab: string,
  waitingForSavePublicity: boolean,
  you: ?string,
  yourRole: ?Types.TeamRoleType,
  yourOperations: RPCTypes.TeamOperation,
}

const mapStateToProps = (state: TypedState, {routeProps, routeState}): StateProps => {
  const teamname = routeProps.get('teamname')
  if (!teamname) {
    throw new Error('There was a problem loading the team page, please report this error.')
  }
  const memberInfo = state.entities.getIn(['teams', 'teamNameToMembers', teamname], I.Set())

  // We had to request every subteam of the top-level team, rather than just
  // child subteams of the subteam we care about.  Here's where we fix that up.
  const subteams = state.entities
    .getIn(['teams', 'teamNameToSubteams', teamname], I.Set())
    .filter(team => team.startsWith(teamname + '.'))

  return {
    _memberInfo: memberInfo,
    _requests: state.entities.getIn(['teams', 'teamNameToRequests', teamname], I.Set()),
    _invites: state.entities.getIn(['teams', 'teamNameToInvites', teamname], I.Set()),
    description: state.entities.getIn(['teams', 'teamNameToPublicitySettings', teamname, 'description'], ''),
    openTeam: state.entities.getIn(['teams', 'teamNameToTeamSettings', teamname], {open: false}).open,
    _newTeamRequests: state.entities.getIn(['teams', 'newTeamRequests'], I.List()),
    ignoreAccessRequests: state.entities.getIn(
      ['teams', 'teamNameToPublicitySettings', teamname, 'ignoreAccessRequests'],
      false
    ),
    loading: state.entities.getIn(['teams', 'teamNameToLoading', teamname], true),
    memberCount: state.entities.getIn(['teams', 'teammembercounts', teamname], 0),
    name: teamname,
    openTeamRole:
      Constants.teamRoleByEnum[
        state.entities.getIn(['teams', 'teamNameToTeamSettings', teamname], {joinAs: 'reader'}).joinAs
      ],
    publicityAnyMember: state.entities.getIn(
      ['teams', 'teamNameToPublicitySettings', teamname, 'anyMemberShowcase'],
      false
    ),
    publicityMember: state.entities.getIn(
      ['teams', 'teamNameToPublicitySettings', teamname, 'member'],
      false
    ),
    publicityTeam: state.entities.getIn(['teams', 'teamNameToPublicitySettings', teamname, 'team'], false),
    selectedTab: routeState.get('selectedTab') || 'members',
    subteams,
    waitingForSavePublicity: anyWaiting(state, `setPublicity:${teamname}`, `getDetails:${teamname}`),
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
  _onCreateSubteam: (teamname: Types.Teamname) =>
    dispatch(navigateAppend([{props: {name: `${teamname}.`}, selected: 'showNewTeamDialog'}])),
  _onInviteByEmail: (teamname: Types.Teamname) =>
    dispatch(navigateAppend([{props: {teamname}, selected: 'inviteByEmail'}])),
  _onLeaveTeam: (teamname: Types.Teamname) =>
    dispatch(navigateAppend([{props: {teamname}, selected: 'reallyLeaveTeam'}])),
  _onManageChat: (teamname: Types.Teamname) =>
    dispatch(navigateAppend([{props: {teamname}, selected: 'manageChannels'}])),
  _onOpenFolder: (teamname: Types.Teamname) =>
    dispatch(KBFSGen.createOpen({path: `/keybase/team/${teamname}`})),
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
  _onSetOpenTeamRole: (openTeam: boolean, openTeamRole: string) => {
    dispatch(
      navigateAppend([
        {
          props: {
            onComplete: (role: Types.TeamRoleType) => setOpenTeamRole(role),
            selectedRole: newOpenTeamRole,
            allowOwner: false,
            allowAdmin: false,
          },
          selected: 'controlledRolePicker',
        },
      ])
    )
  },
  _savePublicity: (teamname: Types.Teamname, settings: Types.PublicitySettings) =>
    dispatch(TeamsGen.createSetPublicity({teamname, settings})),
  onReadMoreAboutSubteams: () => {
    openURL('https://keybase.io/docs/teams/design')
  },
})

const getOrderedMemberArray = (
  memberInfo: I.Set<Types.MemberInfo>,
  you: ?string,
  listYouFirst: boolean
): Array<Types.MemberInfo> => {
  let youInfo
  let info = memberInfo
  if (you && !listYouFirst) {
    youInfo = memberInfo.find(member => member.username === you)
    if (youInfo) {
      info = memberInfo.delete(youInfo)
    }
  }
  let returnArray = info
    .toArray()
    .sort(
      (a, b) =>
        !a.type || !b.type || a.type === b.type
          ? a.username.localeCompare(b.username)
          : order[a.type] - order[b.type]
    )

  if (youInfo) {
    returnArray.unshift(youInfo)
  }
  return returnArray
}

const mergeProps = (stateProps, dispatchProps, ownProps) => {
  const onAddPeople = () => dispatchProps._onAddPeople(stateProps.name)
  const onInviteByEmail = () => dispatchProps._onInviteByEmail(stateProps.name)
  const onOpenFolder = () => dispatchProps._onOpenFolder(stateProps.name)
  const onManageChat = () => dispatchProps._onManageChat(stateProps.name)
  const onLeaveTeam = () => dispatchProps._onLeaveTeam(stateProps.name)
  const onEditDescription = () => dispatchProps._onEditDescription()
  const onCreateSubteam = () => dispatchProps._onCreateSubteam(stateProps.name)

  const you = stateProps.you
  const yourOperations = stateProps.yourOperations

  const onAddSelf = () => dispatchProps._onAddSelf(stateProps.name, you)
  const onSetOpenTeamRole = () =>
    dispatchProps._onSetOpenTeamRole(stateProps.openTeam, stateProps.openTeamRole)

  const savePublicity = settings => dispatchProps._savePublicity(stateProps.name, settings)

  const customComponent = (
    <CustomComponent
      onOpenFolder={onOpenFolder}
      onManageChat={onManageChat}
      onShowMenu={() => ownProps.setShowMenu(true)}
    />
  )
  const publicitySettingsChanged =
    ownProps.newIgnoreAccessRequests !== stateProps.ignoreAccessRequests ||
    ownProps.newPublicityAnyMember !== stateProps.publicityAnyMember ||
    ownProps.newPublicityMember !== stateProps.publicityMember ||
    ownProps.newPublicityTeam !== stateProps.publicityTeam ||
    ownProps.newOpenTeam !== stateProps.openTeam ||
    (ownProps.newOpenTeam && ownProps.newOpenTeamRole !== stateProps.openTeamRole)

  return {
    ...stateProps,
    ...dispatchProps,
    ...ownProps,
    customComponent,
    headerStyle: {borderBottomWidth: 0},
    invites: stateProps._invites.toJS(),
    members: getOrderedMemberArray(stateProps._memberInfo, you, yourOperations.listFirst),
    requests: stateProps._requests.toJS(),
    newTeamRequests: stateProps._newTeamRequests.toArray(),
    onAddPeople,
    onAddSelf,
    onInviteByEmail,
    onCreateSubteam,
    onLeaveTeam,
    onManageChat,
    onOpenFolder,
    onEditDescription,
    onSetOpenTeamRole,
    publicitySettingsChanged,
    savePublicity,
    yourOperations,
  }
}

export default compose(
  withState('showMenu', 'setShowMenu', false),
  withState('newIgnoreAccessRequests', 'setIgnoreAccessRequests', props => props.ignoreAccessRequests),
  withState('newPublicityAnyMember', 'setPublicityAnyMember', props => props.publicityAnyMember),
  withState('newPublicityMember', 'setPublicityMember', props => props.publicityMember),
  withState('newPublicityTeam', 'setPublicityTeam', props => props.publicityTeam),
  withState('newOpenTeam', 'setOpenTeam', props => props.openTeam),
  withState('newOpenTeamRole', 'setOpenTeamRole', props => props.openTeamRole),
  withState('publicitySettingsChanged', 'setPublicitySettingsChanged', false),
  connect(mapStateToProps, mapDispatchToProps, mergeProps),
  withPropsOnChange(
    [
      'ignoreAccessRequests',
      'publicityAnyMember',
      'publicityMember',
      'publicityTeam',
      'openTeam',
      'openTeamRole',
    ],
    props => {
      props.setIgnoreAccessRequests(props.ignoreAccessRequests)
      props.setPublicityAnyMember(props.publicityAnyMember)
      props.setPublicityMember(props.publicityMember)
      props.setPublicityTeam(props.publicityTeam)
      props.setOpenTeam(props.openTeam)
      props.setOpenTeamRole(props.openTeamRole)
    }
  ),
  withHandlers({
    onSavePublicity: props => () =>
      props.savePublicity({
        ignoreAccessRequests: props.newIgnoreAccessRequests,
        openTeam: props.newOpenTeam,
        openTeamRole: props.newOpenTeamRole,
        publicityAnyMember: props.newPublicityAnyMember,
        publicityMember: props.newPublicityMember,
        publicityTeam: props.newPublicityTeam,
      }),
  }),
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
  // Now that we've calculated old vs. new state (for greying out Save button),
  // we can present just one set of props to the display component.
  renameProps({
    newIgnoreAccessRequests: 'ignoreAccessRequests',
    newOpenTeam: 'openTeam',
    newOpenTeamRole: 'openTeamRole',
    newPublicityAnyMember: 'publicityAnyMember',
    newPublicityMember: 'publicityMember',
    newPublicityTeam: 'publicityTeam',
  }),
  HeaderHoc
)(Team)
