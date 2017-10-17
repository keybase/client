// @flow
import * as React from 'react'
import {connect, type TypedState} from '../../util/container'
import {compose, lifecycle, withState} from 'recompose'
import {HeaderHoc} from '../../common-adapters'
import * as Creators from '../../actions/teams/creators'
import * as Constants from '../../constants/teams'
import * as I from 'immutable'
import Team, {CustomComponent} from '.'
import {openInKBFS} from '../../actions/kbfs'
import {navigateAppend} from '../../actions/route-tree'
import {showUserProfile} from '../../actions/profile'
import {getProfile} from '../../actions/tracker'
import {isMobile} from '../../constants/platform'

type StateProps = {
  _memberInfo: I.Set<Constants.MemberInfo>,
  loading: boolean,
  _requests: I.Set<Constants.RequestInfo>,
  name: Constants.Teamname,
  you: ?string,
  selectedTab: string,
}

const mapStateToProps = (state: TypedState, {routeProps, routeState}): StateProps => ({
  _memberInfo: state.entities.getIn(['teams', 'teamNameToMembers', routeProps.get('teamname')], I.Set()),
  _requests: state.entities.getIn(['teams', 'teamNameToRequests', routeProps.get('teamname')], I.Set()),
  loading: state.entities.getIn(['teams', 'teamNameToLoading', routeProps.get('teamname')], true),
  name: routeProps.get('teamname'),
  you: state.config.username,
  selectedTab: routeState.get('selectedTab') || 'members',
})

type DispatchProps = {
  _loadTeam: (teamname: Constants.Teamname) => void,
  _onOpenFolder: (teamname: Constants.Teamname) => void,
  _onAddPeople: (teamname: Constants.Teamname) => void,
  _onInviteByEmail: (teamname: Constants.Teamname) => void,
  _onManageChat: (teamname: Constants.Teamname) => void,
  _onLeaveTeam: (teamname: Constants.Teamname) => void,
  setSelectedTab: (tab: string) => void,
  onBack: () => void,
}

const mapDispatchToProps = (dispatch: Dispatch, {navigateUp, setRouteState}): DispatchProps => ({
  _loadTeam: teamname => dispatch(Creators.getDetails(teamname)),
  _onAddPeople: (teamname: Constants.Teamname) =>
    dispatch(navigateAppend([{props: {teamname}, selected: 'addPeople'}])),
  _onInviteByEmail: (teamname: Constants.Teamname) =>
    dispatch(navigateAppend([{props: {teamname}, selected: 'inviteByEmail'}])),
  _onLeaveTeam: (teamname: Constants.Teamname) =>
    dispatch(navigateAppend([{props: {teamname}, selected: 'reallyLeaveTeam'}])),
  _onManageChat: (teamname: Constants.Teamname) =>
    dispatch(navigateAppend([{props: {teamname}, selected: 'manageChannels'}])),
  _onOpenFolder: (teamname: Constants.Teamname) => dispatch(openInKBFS(`/keybase/team/${teamname}`)),
  onUsernameClick: (username: string) => {
    isMobile ? dispatch(showUserProfile(username)) : dispatch(getProfile(username, true, true))
  },
  setSelectedTab: selectedTab => setRouteState({selectedTab}),
  onBack: () => dispatch(navigateUp()),
})

const mergeProps = (stateProps, dispatchProps, ownProps) => {
  const onAddPeople = () => dispatchProps._onAddPeople(stateProps.name)
  const onInviteByEmail = () => dispatchProps._onInviteByEmail(stateProps.name)
  const onOpenFolder = () => dispatchProps._onOpenFolder(stateProps.name)
  const onManageChat = () => dispatchProps._onManageChat(stateProps.name)
  const onLeaveTeam = () => dispatchProps._onLeaveTeam(stateProps.name)

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
    members: stateProps._memberInfo
      .toArray()
      .sort((a: Constants.MemberInfo, b: Constants.MemberInfo) => a.username.localeCompare(b.username)),
    requests: stateProps._requests.toJS(),
    onAddPeople,
    onInviteByEmail,
    onLeaveTeam,
    onManageChat,
    onOpenFolder,
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
