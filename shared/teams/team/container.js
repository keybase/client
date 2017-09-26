// @flow
import * as React from 'react'
import {connect} from 'react-redux'
import {compose, lifecycle, withState} from 'recompose'
import {HeaderHoc} from '../../common-adapters'
import * as Creators from '../../actions/teams/creators'
import * as Constants from '../../constants/teams'
import * as I from 'immutable'
import Team, {CustomComponent} from '.'
import {openInKBFS} from '../../actions/kbfs'
import {navigateAppend} from '../../actions/route-tree'

import type {TypedState} from '../../constants/reducer'

type StateProps = {
  _memberInfo: I.Set<Constants.MemberInfo>,
  name: Constants.Teamname,
  you: ?string,
}

const mapStateToProps = (state: TypedState, {routeProps}): StateProps => ({
  _memberInfo: state.entities.getIn(['teams', 'teamNameToMembers', routeProps.get('teamname')], I.Set()),
  name: routeProps.get('teamname'),
  you: state.config.username,
})

type DispatchProps = {
  _loadTeam: (teamname: Constants.Teamname) => void,
  _onOpenFolder: (teamname: Constants.Teamname) => void,
  _onManageChat: (teamname: Constants.Teamname) => void,
  _onLeaveTeam: (teamname: Constants.Teamname) => void,
  onBack: () => void,
}

const mapDispatchToProps = (dispatch: Dispatch, {navigateUp}): DispatchProps => ({
  _loadTeam: teamname => dispatch(Creators.getDetails(teamname)),
  _onLeaveTeam: (teamname: Constants.Teamname) =>
    dispatch(navigateAppend([{props: {teamname}, selected: 'reallyLeaveTeam'}])),
  _onManageChat: (teamname: Constants.Teamname) =>
    dispatch(navigateAppend([{props: {teamname}, selected: 'manageChannels'}])),
  _onOpenFolder: (teamname: Constants.Teamname) => dispatch(openInKBFS(`/keybase/team/${teamname}`)),
  onBack: () => dispatch(navigateUp()),
})

const mergeProps = (stateProps, dispatchProps, ownProps) => {
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
    members: stateProps._memberInfo.toJS().sort((a, b) => a.username.localeCompare(b.username)),
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
