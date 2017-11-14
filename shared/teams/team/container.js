// @flow
import * as Constants from '../../constants/teams'
import * as Creators from '../../actions/teams/creators'
import * as Search from '../../actions/search/creators'
import * as I from 'immutable'
import * as KBFSGen from '../../actions/kbfs-gen'
import * as React from 'react'
import Team, {CustomComponent} from '.'
import {HeaderHoc} from '../../common-adapters'
import {compose, lifecycle, withState} from 'recompose'
import {connect, type TypedState} from '../../util/container'
import {getProfile} from '../../actions/tracker'
import {isMobile} from '../../constants/platform'
import {navigateAppend} from '../../actions/route-tree'
import {showUserProfile} from '../../actions/profile'

type StateProps = {
  _invites: I.Set<Constants.InviteInfo>,
  _memberInfo: I.Set<Constants.MemberInfo>,
  _implicitAdminUsernames: I.Set<string>,
  _requests: I.Set<Constants.RequestInfo>,
  _newTeamRequests: I.List<string>,
  isTeamOpen: boolean,
  loading: boolean,
  name: Constants.Teamname,
  publicityMember: boolean,
  publicityTeam: boolean,
  selectedTab: string,
  you: ?string,
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
    isTeamOpen: state.entities.getIn(['teams', 'teamNameToTeamSettings', teamname], {
      open: false,
    }).open,
    _newTeamRequests: state.entities.getIn(['teams', 'newTeamRequests'], I.List()),
    loading: state.entities.getIn(['teams', 'teamNameToLoading', teamname], true),
    memberCount: state.entities.getIn(['teams', 'teammembercounts', teamname], 0),
    name: teamname,
    publicityMember: state.entities.getIn(['teams', 'teamNameToPublicitySettings', teamname], {
      member: false,
    }).member,
    publicityTeam: state.entities.getIn(['teams', 'teamNameToPublicitySettings', teamname], {
      team: false,
    }).team,
    selectedTab: routeState.get('selectedTab') || 'members',
    you: state.config.username,
  }
}

type DispatchProps = {
  _loadTeam: (teamname: Constants.Teamname) => void,
  _onOpenFolder: (teamname: Constants.Teamname) => void,
  _onAddPeople: (teamname: Constants.Teamname) => void,
  _onAddSelf: (teamname: Constants.Teamname, you: string) => void,
  _onInviteByEmail: (teamname: Constants.Teamname) => void,
  _onManageChat: (teamname: Constants.Teamname) => void,
  _onLeaveTeam: (teamname: Constants.Teamname) => void,
  setSelectedTab: (tab: string) => void,
  onBack: () => void,
  _onClickOpenTeamSetting: () => void,
  _onEditDescription: () => void,
}

const mapDispatchToProps = (dispatch: Dispatch, {navigateUp, setRouteState, routeProps}): DispatchProps => ({
  _loadTeam: teamname => dispatch(Creators.getDetails(teamname)),
  _onAddPeople: (teamname: Constants.Teamname) =>
    dispatch(navigateAppend([{props: {teamname}, selected: 'addPeople'}])),
  _onAddSelf: (teamname: Constants.Teamname, you: ?string) => {
    if (you) {
      dispatch(navigateAppend([{props: {teamname}, selected: 'addPeople'}]))
      dispatch(Search.addResultsToUserInput('addToTeamSearch', [you]))
    }
  },
  _onCreateSubteam: (teamname: Constants.Teamname) =>
    dispatch(navigateAppend([{props: {name: `${teamname}.`}, selected: 'showNewTeamDialog'}])),
  _onInviteByEmail: (teamname: Constants.Teamname) =>
    dispatch(navigateAppend([{props: {teamname}, selected: 'inviteByEmail'}])),
  _onLeaveTeam: (teamname: Constants.Teamname) =>
    dispatch(navigateAppend([{props: {teamname}, selected: 'reallyLeaveTeam'}])),
  _onManageChat: (teamname: Constants.Teamname) =>
    dispatch(navigateAppend([{props: {teamname}, selected: 'manageChannels'}])),
  _onOpenFolder: (teamname: Constants.Teamname) =>
    dispatch(KBFSGen.createOpen({path: `/keybase/team/${teamname}`})),
  onUsernameClick: (username: string) => {
    isMobile ? dispatch(showUserProfile(username)) : dispatch(getProfile(username, true, true))
  },
  setSelectedTab: selectedTab => setRouteState({selectedTab}),
  _setPublicityMember: (teamname: Constants.Teamname, checked: boolean) =>
    dispatch(Creators.setPublicityMember(teamname, checked)),
  _setPublicityTeam: (teamname: Constants.Teamname, checked: boolean) =>
    dispatch(Creators.setPublicityTeam(teamname, checked)),
  onBack: () => dispatch(navigateUp()),
  _onClickOpenTeamSetting: isTeamOpen =>
    dispatch(
      navigateAppend([
        {
          props: {
            actualTeamName: routeProps.get('teamname'),
          },
          selected: isTeamOpen ? 'openCloseTeamSetting' : 'openTeamSetting',
        },
      ])
    ),
  _onEditDescription: () =>
    dispatch(
      navigateAppend([{props: {teamname: routeProps.get('teamname')}, selected: 'editTeamDescription'}])
    ),
})

const isExplicitAdmin = (memberInfo: I.Set<Constants.MemberInfo>, user: string): boolean => {
  const info = memberInfo.find(member => member.username === user)
  if (!info) {
    return false
  }
  return info.type === 'owner' || info.type === 'admin'
}

const mergeProps = (stateProps, dispatchProps, ownProps) => {
  const onAddPeople = () => dispatchProps._onAddPeople(stateProps.name)
  const onInviteByEmail = () => dispatchProps._onInviteByEmail(stateProps.name)
  const onOpenFolder = () => dispatchProps._onOpenFolder(stateProps.name)
  const onManageChat = () => dispatchProps._onManageChat(stateProps.name)
  const onLeaveTeam = () => dispatchProps._onLeaveTeam(stateProps.name)
  const onClickOpenTeamSetting = () => dispatchProps._onClickOpenTeamSetting(stateProps.isTeamOpen)
  const onEditDescription = () => dispatchProps._onEditDescription()
  const onCreateSubteam = () => dispatchProps._onCreateSubteam(stateProps.name)

  const you = stateProps.you
  let youExplicitAdmin = false
  let youImplicitAdmin = false
  let youAreMember = false
  if (you) {
    youExplicitAdmin = isExplicitAdmin(stateProps._memberInfo, you)
    youImplicitAdmin = stateProps._implicitAdminUsernames.has(you)
    youAreMember = stateProps._memberInfo.some(member => member.username === you)
  }
  const youAdmin = youExplicitAdmin || youImplicitAdmin

  const showAddYourselfBanner = !youAreMember && !youExplicitAdmin && youImplicitAdmin
  const youCanAddPeople = youAdmin
  const youCanCreateSubteam = youAdmin

  const onAddSelf = () => dispatchProps._onAddSelf(stateProps.name, you)
  const setPublicityMember = (checked: boolean) => dispatchProps._setPublicityMember(stateProps.name, checked)
  const setPublicityTeam = (checked: boolean) => dispatchProps._setPublicityTeam(stateProps.name, checked)

  const customComponent = (
    <CustomComponent
      onOpenFolder={onOpenFolder}
      onManageChat={onManageChat}
      onShowMenu={() => ownProps.setShowMenu(true)}
    />
  )
  return {
    ...stateProps,
    ...dispatchProps,
    ...ownProps,
    customComponent,
    headerStyle: {borderBottomWidth: 0},
    invites: stateProps._invites.toJS(),
    members: stateProps._memberInfo
      .toArray()
      .sort((a: Constants.MemberInfo, b: Constants.MemberInfo) => a.username.localeCompare(b.username)),
    requests: stateProps._requests.toJS(),
    newTeamRequests: stateProps._newTeamRequests.toArray(),
    onAddPeople,
    onAddSelf,
    onInviteByEmail,
    onCreateSubteam,
    onLeaveTeam,
    onManageChat,
    onOpenFolder,
    onClickOpenTeamSetting,
    onEditDescription,
    setPublicityMember,
    setPublicityTeam,
    showAddYourselfBanner,
    youCanAddPeople,
    youCanCreateSubteam,
  }
}

export default compose(
  withState('showMenu', 'setShowMenu', false),
  connect(mapStateToProps, mapDispatchToProps, mergeProps),
  lifecycle({
    componentDidMount: function() {
      this.props._loadTeam(this.props.name)
    },
  }),
  HeaderHoc
)(Team)
