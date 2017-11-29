// @flow
import * as Constants from '../../constants/teams'
import * as Types from '../../constants/types/teams'
import * as Creators from '../../actions/teams/creators'
import * as SearchGen from '../../actions/search-gen'
import * as I from 'immutable'
import * as KBFSGen from '../../actions/kbfs-gen'
import * as React from 'react'
import Team, {CustomComponent} from '.'
import {HeaderHoc} from '../../common-adapters'
import {compose, lifecycle, renameProps, withHandlers, withPropsOnChange, withState} from 'recompose'
import {connect, type TypedState} from '../../util/container'
import {getProfile} from '../../actions/tracker'
import {isMobile} from '../../constants/platform'
import {anyWaiting} from '../../constants/waiting'
import {navigateAppend} from '../../actions/route-tree'
import {createShowUserProfile} from '../../actions/profile-gen'

type StateProps = {
  _invites: I.Set<Types.InviteInfo>,
  _memberInfo: I.Set<Types.MemberInfo>,
  _implicitAdminUsernames: I.Set<string>,
  _requests: I.Set<Types.RequestInfo>,
  _newTeamRequests: I.List<string>,
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
  yourRole: ?string,
}

const mapStateToProps = (state: TypedState, {routeProps, routeState}): StateProps => {
  const teamname = routeProps.get('teamname')
  if (!teamname) {
    throw new Error('There was a problem loading the team page, please report this error.')
  }
  const memberInfo = state.entities.getIn(['teams', 'teamNameToMembers', teamname], I.Set())
  const implicitAdminUsernames = state.entities.getIn(
    ['teams', 'teamNameToImplicitAdminUsernames', teamname],
    I.Set()
  )
  return {
    _memberInfo: memberInfo,
    _implicitAdminUsernames: implicitAdminUsernames,
    _requests: state.entities.getIn(['teams', 'teamNameToRequests', teamname], I.Set()),
    _invites: state.entities.getIn(['teams', 'teamNameToInvites', teamname], I.Set()),
    description: state.entities.getIn(['teams', 'teamNameToPublicitySettings', teamname, 'description'], ''),
    openTeam: state.entities.getIn(['teams', 'teamNameToTeamSettings', teamname], {open: false}).open,
    _newTeamRequests: state.entities.getIn(['teams', 'newTeamRequests'], I.List()),
    loading: state.entities.getIn(['teams', 'teamNameToLoading', teamname], true),
    memberCount: state.entities.getIn(['teams', 'teammembercounts', teamname], 0),
    name: teamname,
    openTeamRole: Constants.teamRoleByEnum[
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
    waitingForSavePublicity: anyWaiting(state, `setPublicity:${teamname}`, `getDetails:${teamname}`),
    you: state.config.username,
    yourRole: Constants.getRole(state, teamname),
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
  _loadTeam: teamname => dispatch(Creators.getDetails(teamname)),
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
    isMobile ? dispatch(createShowUserProfile({username})) : dispatch(getProfile(username, true, true))
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
    dispatch(Creators.setPublicity(teamname, settings)),
})

const getOrderedMemberArray = (
  memberInfo: I.Set<Types.MemberInfo>,
  you: ?string,
  youImplicitAdmin: boolean
): Array<Types.MemberInfo> => {
  let youInfo
  if (you && !youImplicitAdmin) {
    youInfo = memberInfo.find(member => member.username === you)
    if (youInfo) memberInfo = memberInfo.delete(youInfo)
  }
  let returnArray = memberInfo
    .toArray()
    .sort((a: Types.MemberInfo, b: Types.MemberInfo) => a.username.localeCompare(b.username))
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
  let youExplicitAdmin = false
  let youImplicitAdmin = false
  let youAreMember = false
  if (you) {
    youExplicitAdmin = Constants.isOwner(stateProps.yourRole) || Constants.isAdmin(stateProps.yourRole)
    youImplicitAdmin = stateProps._implicitAdminUsernames.has(you)
    youAreMember = stateProps.yourRole !== '' && stateProps.yourRole !== 'none'
  }
  const youAdmin = youExplicitAdmin || youImplicitAdmin

  const showAddYourselfBanner = !youAreMember && !youExplicitAdmin && youImplicitAdmin
  const youCanAddPeople = youAdmin
  const youCanCreateSubteam = youAdmin

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
  const youCanShowcase = youAdmin || stateProps.publicityAnyMember

  const publicitySettingsChanged =
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
    members: getOrderedMemberArray(stateProps._memberInfo, you, youImplicitAdmin),
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
    showAddYourselfBanner,
    youCanAddPeople,
    youCanCreateSubteam,
    youCanShowcase,
  }
}

export default compose(
  withState('showMenu', 'setShowMenu', false),
  withState('newPublicityAnyMember', 'setPublicityAnyMember', props => props.publicityAnyMember),
  withState('newPublicityMember', 'setPublicityMember', props => props.publicityMember),
  withState('newPublicityTeam', 'setPublicityTeam', props => props.publicityTeam),
  withState('newOpenTeam', 'setOpenTeam', props => props.openTeam),
  withState('newOpenTeamRole', 'setOpenTeamRole', props => props.openTeamRole),
  withState('publicitySettingsChanged', 'setPublicitySettingsChanged', false),
  connect(mapStateToProps, mapDispatchToProps, mergeProps),
  withPropsOnChange(
    ['publicityAnyMember', 'publicityMember', 'publicityTeam', 'openTeam', 'openTeamRole'],
    props => {
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
        publicityAnyMember: props.newPublicityAnyMember,
        publicityMember: props.newPublicityMember,
        publicityTeam: props.newPublicityTeam,
        openTeam: props.newOpenTeam,
        openTeamRole: props.newOpenTeamRole,
      }),
  }),
  lifecycle({
    componentDidMount: function() {
      this.props._loadTeam(this.props.name)
    },
  }),
  // Now that we've calculated old vs. new state (for greying out Save button),
  // we can present just one set of props to the display component.
  renameProps({
    newOpenTeam: 'openTeam',
    newOpenTeamRole: 'openTeamRole',
    newPublicityAnyMember: 'publicityAnyMember',
    newPublicityMember: 'publicityMember',
    newPublicityTeam: 'publicityTeam',
  }),
  HeaderHoc
)(Team)
