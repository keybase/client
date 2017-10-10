// @flow
import * as Constants from '../../../constants/teams'
import * as I from 'immutable'
import {connect} from 'react-redux'
import {compose} from 'recompose'
import {HeaderHoc} from '../../../common-adapters'
import {showUserProfile} from '../../../actions/profile'
import {getProfile} from '../../../actions/tracker'
import {startConversation} from '../../../actions/chat'
import {isMobile} from '../../../constants/platform'
import {TeamMember} from '.'

import type {TypedState} from '../../../constants/reducer'

type StateProps = {
  teamname: string,
  _you: ?string,
  _username: string,
  _memberInfo: I.Set<Constants.MemberInfo>,
}

const mapStateToProps = (state: TypedState, {routeProps}): StateProps => ({
  teamname: routeProps.get('teamname'),
  _username: routeProps.get('username'),
  _you: state.config.username,
  _memberInfo: state.entities.getIn(['teams', 'teamNameToMembers', routeProps.get('teamname')], I.Set()),
})

type DispatchProps = {
  onOpenProfile: () => void,
  _onEditMembership: (name: string, username: string) => void,
  _onChat: (string, ?string) => void,
  onBack: () => void,
  // TODO remove member
}

const mapDispatchToProps = (dispatch: Dispatch, {username, navigateAppend, navigateUp}): DispatchProps => ({
  onOpenProfile: () => {
    isMobile ? dispatch(showUserProfile(username)) : dispatch(getProfile(username, true, true))
  },
  _onEditMembership: (name: string, username: string) =>
    dispatch(
      navigateAppend([
        {
          props: {teamname: name, username},
          selected: 'rolePicker',
        },
      ])
    ),
  _onChat: (username, myUsername) => {
    username && myUsername && dispatch(startConversation([username, myUsername]))
  },
  onBack: () => dispatch(navigateUp()),
})

const mergeProps = (stateProps: StateProps, dispatchProps: DispatchProps) => {
  // Gather contextual team membership info
  const yourInfo = stateProps._memberInfo.find(member => member.username === stateProps._you)
  const userInfo = stateProps._memberInfo.find(member => member.username === stateProps._username)
  const you = {
    username: stateProps._you,
    type: yourInfo && yourInfo.type.substring(0, yourInfo.type.length - 1), // De-pluralize type
  }
  const user = {
    username: stateProps._username,
    type: userInfo && userInfo.type.substring(0, userInfo.type.length - 1), // De-pluralize type
  }
  return {
    ...stateProps,
    ...dispatchProps,
    you,
    user,
    onChat: () => dispatchProps._onChat(stateProps._username, stateProps._you),
    onEditMembership: () => dispatchProps._onEditMembership(stateProps.teamname, stateProps._username),
  }
}

export default compose(connect(mapStateToProps, mapDispatchToProps, mergeProps), HeaderHoc)(TeamMember)
