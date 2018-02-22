// @flow
import * as I from 'immutable'
import * as Chat2Gen from '../../../actions/chat2-gen'
import * as Constants from '../../../constants/chat2'
import * as React from 'react'
import * as Route from '../../../actions/route-tree'
import * as TeamTypes from '../../../constants/types/teams'
import * as Types from '../../../constants/types/chat2'
import {InfoPanel} from '.'
import {teamsTab} from '../../../constants/tabs'
import {connect, type TypedState} from '../../../util/container'
import {createShowUserProfile} from '../../../actions/profile-gen'
import {getCanPerform} from '../../../constants/teams'

type OwnProps = {
  conversationIDKey: Types.ConversationIDKey,
}

const mapStateToProps = (state: TypedState, ownProps: OwnProps) => {
  const conversationIDKey = ownProps.conversationIDKey
  const meta = Constants.getMeta(state, conversationIDKey)

  let admin = false
  if (meta.teamname) {
    const yourOperations = getCanPerform(state, meta.teamname)
    admin = yourOperations.renameChannel
  }

  return {
    _participants: meta.participants,
    _infoMap: state.users.infoMap,
    admin,
    channelname: meta.channelname,
    isPreview: meta.membershipType === 'youArePreviewing',
    selectedConversationIDKey: conversationIDKey,
    smallTeam: meta.teamType !== 'big',
    teamname: meta.teamname,
  }
}

const mapDispatchToProps = (dispatch: Dispatch, {navigateUp}) => ({
  _onBack: () => dispatch(navigateUp()),
  _navToRootChat: () => dispatch(Chat2Gen.createNavigateToInbox()),
  _onLeaveConversation: (conversationIDKey: Types.ConversationIDKey) =>
    dispatch(Chat2Gen.createLeaveConversation({conversationIDKey})),
  _onJoinChannel: (conversationIDKey: Types.ConversationIDKey) =>
    dispatch(Chat2Gen.createJoinConversation({conversationIDKey})),
  _onShowBlockConversationDialog: (conversationIDKey: Types.ConversationIDKey) => {
    dispatch(
      Route.navigateAppend([
        {
          props: {conversationIDKey},
          selected: 'showBlockConversationDialog',
        },
      ])
    )
  },
  _onShowNewTeamDialog: (conversationIDKey: Types.ConversationIDKey) => {
    dispatch(
      Route.navigateAppend([
        {
          props: {conversationIDKey},
          selected: 'showNewTeamDialog',
        },
      ])
    )
  },
  _onLeaveTeam: (teamname: TeamTypes.Teamname) =>
    dispatch(Route.navigateAppend([{props: {teamname}, selected: 'reallyLeaveTeam'}])),
  _onViewTeam: (teamname: TeamTypes.Teamname) =>
    dispatch(Route.navigateTo([teamsTab, {props: {teamname: teamname}, selected: 'team'}])),
  onShowProfile: (username: string) => dispatch(createShowUserProfile({username})),
})

// state props
const mergeProps = (stateProps, dispatchProps, ownProps) => ({
  ...stateProps,
  participants: stateProps._participants
    .map(p => ({
      fullname: stateProps._infoMap.getIn([p, 'fullname'], ''),
      username: p,
    }))
    .toArray(),
  onBack: ownProps.onBack,
  onJoinChannel: () => dispatchProps._onJoinChannel(stateProps.selectedConversationIDKey),
  onLeaveConversation: () => dispatchProps._onLeaveConversation(stateProps.selectedConversationIDKey),
  onShowBlockConversationDialog: () =>
    dispatchProps._onShowBlockConversationDialog(stateProps.selectedConversationIDKey),
  onShowNewTeamDialog: () => dispatchProps._onShowNewTeamDialog(stateProps.selectedConversationIDKey),
  onShowProfile: dispatchProps.onShowProfile,
  onLeaveTeam: () => dispatchProps._onLeaveTeam(stateProps.teamname),
  onViewTeam: () => dispatchProps._onViewTeam(stateProps.teamname),
})

const ConnectedInfoPanel = connect(mapStateToProps, mapDispatchToProps, mergeProps)(InfoPanel)

type SelectorOwnProps = {
  conversationIDKey: ?Types.ConversationIDKey,
  routeProps?: I.RecordOf<{conversationIDKey: Types.ConversationIDKey}>, // on mobile its a route
  navigateUp?: () => void,
}

const mapStateToSelectorProps = (state: TypedState, ownProps: SelectorOwnProps) => {
  const conversationIDKey =
    ownProps.conversationIDKey || (ownProps.routeProps ? ownProps.routeProps.get('conversationIDKey') : null)
  return {
    conversationIDKey,
  }
}

type SelectorDispatchProps = {
  onBack: () => void,
}

const mapDispatchToSelectorProps = (dispatch: Dispatch, {navigateUp}): SelectorDispatchProps => ({
  // Used by HeaderHoc.
  onBack: () => dispatch(navigateUp()),
})

type Props = {
  conversationIDKey: Types.ConversationIDKey,
  onBack: () => void,
}
class InfoPanelSelector extends React.PureComponent<Props> {
  render() {
    if (!this.props.conversationIDKey) {
      return null
    }

    return <ConnectedInfoPanel onBack={this.props.onBack} conversationIDKey={this.props.conversationIDKey} />
  }
}

export default connect(mapStateToSelectorProps, mapDispatchToSelectorProps)(InfoPanelSelector)
