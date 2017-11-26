// @flow
import * as Types from '../../constants/types/teams'
import * as Creators from '../../actions/teams/creators'
import * as SearchGen from '../../actions/search-gen'
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
import {createShowUserProfile} from '../../actions/profile-gen'

type StateProps = {
  _invites: I.Set<Types.InviteInfo>,
  _memberInfo: I.Set<Types.MemberInfo>,
  _implicitAdminUsernames: I.Set<string>,
  _requests: I.Set<Types.RequestInfo>,
  _newTeamRequests: I.List<string>,
  isTeamOpen: boolean,
  loading: boolean,
  name: Types.Teamname,
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
    isTeamOpen: state.entities.getIn(['teams', 'teamNameToTeamSettings', teamname], {
      open: false,
    }).open,
    _newTeamRequests: state.entities.getIn(['teams', 'newTeamRequests'], I.List()),
    loading: state.entities.getIn(['teams', 'teamNameToLoading', teamname], true),
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
  _loadTeam: (teamname: Types.Teamname) => void,
  _onOpenFolder: (teamname: Types.Teamname) => void,
  _onAddPeople: (teamname: Types.Teamname) => void,
  _onAddSelf: (teamname: Types.Teamname, you: string) => void,
  _onInviteByEmail: (teamname: Types.Teamname) => void,
  _onManageChat: (teamname: Types.Teamname) => void,
  _onLeaveTeam: (teamname: Types.Teamname) => void,
  setSelectedTab: (tab: string) => void,
  onBack: () => void,
  _onClickOpenTeamSetting: () => void,
}

const mapDispatchToProps = (dispatch: Dispatch, {navigateUp, setRouteState, routeProps}): DispatchProps => ({
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
  _setPublicityMember: (teamname: Types.Teamname, checked: boolean) =>
    dispatch(Creators.setPublicityMember(teamname, checked)),
  _setPublicityTeam: (teamname: Types.Teamname, checked: boolean) =>
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
})

const isExplicitAdmin = (memberInfo: I.Set<Types.MemberInfo>, user: string): boolean => {
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
      .sort((a: Types.MemberInfo, b: Types.MemberInfo) => a.username.localeCompare(b.username)),
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
