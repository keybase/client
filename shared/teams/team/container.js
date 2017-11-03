// @flow
import * as Constants from '../../constants/teams'
import * as Creators from '../../actions/teams/creators'
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
  _memberInfo: I.Set<Constants.MemberInfo>,
  loading: boolean,
  _requests: I.Set<Constants.RequestInfo>,
  _invites: I.Set<Constants.InviteInfo>,
  name: Constants.Teamname,
  you: ?string,
  selectedTab: string,
  isTeamOpen: boolean,
}

const mapStateToProps = (state: TypedState, {routeProps, routeState}): StateProps => {
  const teamname = routeProps.get('teamname')
  return {
    _memberInfo: state.entities.getIn(['teams', 'teamNameToMembers', teamname], I.Set()),
    _requests: state.entities.getIn(['teams', 'teamNameToRequests', teamname], I.Set()),
    _invites: state.entities.getIn(['teams', 'teamNameToInvites', teamname], I.Set()),
    loading: state.entities.getIn(['teams', 'teamNameToLoading', teamname], true),
    name: teamname,
    you: state.config.username,
    selectedTab: routeState.get('selectedTab') || 'members',
    isTeamOpen: state.entities.getIn(['teams', 'teamNameToTeamSettings', teamname], {
      open: false,
    }).open,
  }
}

type DispatchProps = {
  _loadTeam: (teamname: Constants.Teamname) => void,
  _onOpenFolder: (teamname: Constants.Teamname) => void,
  _onAddPeople: (teamname: Constants.Teamname) => void,
  _onInviteByEmail: (teamname: Constants.Teamname) => void,
  _onManageChat: (teamname: Constants.Teamname) => void,
  _onLeaveTeam: (teamname: Constants.Teamname) => void,
  setSelectedTab: (tab: string) => void,
  onBack: () => void,
  _onClickOpenTeamSetting: () => void,
}

const mapDispatchToProps = (dispatch: Dispatch, {navigateUp, setRouteState, routeProps}): DispatchProps => ({
  _loadTeam: teamname => dispatch(Creators.getDetails(teamname)),
  _onAddPeople: (teamname: Constants.Teamname) =>
    dispatch(navigateAppend([{props: {teamname}, selected: 'addPeople'}])),
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

const mergeProps = (stateProps, dispatchProps, ownProps) => {
  const onAddPeople = () => dispatchProps._onAddPeople(stateProps.name)
  const onInviteByEmail = () => dispatchProps._onInviteByEmail(stateProps.name)
  const onOpenFolder = () => dispatchProps._onOpenFolder(stateProps.name)
  const onManageChat = () => dispatchProps._onManageChat(stateProps.name)
  const onLeaveTeam = () => dispatchProps._onLeaveTeam(stateProps.name)
  const onClickOpenTeamSetting = () => dispatchProps._onClickOpenTeamSetting(stateProps.isTeamOpen)
  const onCreateSubteam = () => dispatchProps._onCreateSubteam(stateProps.name)
  const yourType = stateProps._memberInfo.find(member => member.username === stateProps.you)
  const youCanAddPeople = yourType && (yourType.type === 'owner' || yourType.type === 'admin')
  const youCanCreateSubteam = youCanAddPeople

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
    onAddPeople,
    onInviteByEmail,
    onCreateSubteam,
    onLeaveTeam,
    onManageChat,
    onOpenFolder,
    onClickOpenTeamSetting,
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
