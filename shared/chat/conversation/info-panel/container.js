// @flow
import * as I from 'immutable'
import * as Chat2Gen from '../../../actions/chat2-gen'
import * as Constants from '../../../constants/chat2'
import * as React from 'react'
import * as Route from '../../../actions/route-tree'
import * as Types from '../../../constants/types/chat2'
import {InfoPanel} from '.'
import {connect, isMobile} from '../../../util/container'
import {createShowUserProfile} from '../../../actions/profile-gen'
import {getCanPerform} from '../../../constants/teams'
import {Box} from '../../../common-adapters'

type OwnProps = {|
  conversationIDKey: Types.ConversationIDKey,
  onBack: () => void,
|}

const mapStateToProps = (state, ownProps: OwnProps) => {
  const conversationIDKey = ownProps.conversationIDKey
  const meta = Constants.getMeta(state, conversationIDKey)

  let admin = false
  let canEditChannel = false
  let canSetMinWriterRole = false
  let canSetRetention = false
  let canDeleteHistory = false
  if (meta.teamname) {
    const yourOperations = getCanPerform(state, meta.teamname)
    admin = yourOperations.manageMembers
    canEditChannel = yourOperations.editChannelDescription
    canSetMinWriterRole = yourOperations.setMinWriterRole
    canSetRetention = yourOperations.setRetentionPolicy
    canDeleteHistory = yourOperations.deleteChatHistory
  }

  return {
    _participants: meta.participants,
    _infoMap: state.users.infoMap,
    admin,
    canEditChannel,
    canSetMinWriterRole,
    canSetRetention,
    canDeleteHistory,
    channelname: meta.channelname,
    description: meta.description,
    isPreview: meta.membershipType === 'youArePreviewing',
    selectedConversationIDKey: conversationIDKey,
    smallTeam: meta.teamType !== 'big',
    teamname: meta.teamname,
  }
}

const mapDispatchToProps = (dispatch, {conversationIDKey, onBack}: OwnProps) => ({
  _navToRootChat: () => dispatch(Chat2Gen.createNavigateToInbox({findNewConversation: false})),
  onLeaveConversation: () => dispatch(Chat2Gen.createLeaveConversation({conversationIDKey})),
  onJoinChannel: () => dispatch(Chat2Gen.createJoinConversation({conversationIDKey})),
  _onShowClearConversationDialog: () => {
    dispatch(Chat2Gen.createNavigateToThread())
    dispatch(Route.navigateAppend([{props: {conversationIDKey}, selected: 'deleteHistoryWarning'}]))
  },
  onShowBlockConversationDialog: () => {
    dispatch(
      Route.navigateAppend([
        {
          props: {conversationIDKey},
          selected: 'showBlockConversationDialog',
        },
      ])
    )
  },
  onShowNewTeamDialog: () => {
    dispatch(
      Route.navigateAppend([
        {
          props: {conversationIDKey},
          selected: 'showNewTeamDialog',
        },
      ])
    )
  },
  _onEditChannel: (teamname: string) =>
    dispatch(Route.navigateAppend([{selected: 'editChannel', props: {conversationIDKey, teamname}}])),
  onShowProfile: (username: string) => dispatch(createShowUserProfile({username})),
})

// state props
const mergeProps = (stateProps, dispatchProps, ownProps: OwnProps) => ({
  admin: stateProps.admin,
  canDeleteHistory: stateProps.canDeleteHistory,
  canEditChannel: stateProps.canEditChannel,
  canSetMinWriterRole: stateProps.canSetMinWriterRole,
  canSetRetention: stateProps.canSetRetention,
  channelname: stateProps.channelname,
  description: stateProps.description,
  isPreview: stateProps.isPreview,
  onBack: ownProps.onBack,
  onEditChannel: () => dispatchProps._onEditChannel(stateProps.teamname),
  onJoinChannel: dispatchProps.onJoinChannel,
  onLeaveConversation: dispatchProps.onLeaveConversation,
  onShowBlockConversationDialog: dispatchProps.onShowBlockConversationDialog,
  onShowClearConversationDialog: () => dispatchProps._onShowClearConversationDialog(),
  onShowNewTeamDialog: dispatchProps.onShowNewTeamDialog,
  onShowProfile: dispatchProps.onShowProfile,
  participants: stateProps._participants
    .map(p => ({
      fullname: stateProps._infoMap.getIn([p, 'fullname'], ''),
      username: p,
    }))
    .toArray(),
  selectedConversationIDKey: stateProps.selectedConversationIDKey,
  smallTeam: stateProps.smallTeam,
  teamname: stateProps.teamname,
})

const ConnectedInfoPanel = connect(
  mapStateToProps,
  mapDispatchToProps,
  mergeProps
)(InfoPanel)

type SelectorOwnProps = {|
  routeProps: I.RecordOf<{conversationIDKey: Types.ConversationIDKey}>,
  navigateUp: typeof Route.navigateUp,
|}

const mapStateToSelectorProps = (state, ownProps: SelectorOwnProps) => {
  const conversationIDKey: Types.ConversationIDKey = ownProps.routeProps.get('conversationIDKey')
  return {
    conversationIDKey,
  }
}

const mapDispatchToSelectorProps = (dispatch, {navigateUp}: SelectorOwnProps) => ({
  // Used by HeaderHoc.
  onBack: () => navigateUp && dispatch(navigateUp()),
})

const mergeSelectorProps = (stateProps, dispatchProps) => ({
  conversationIDKey: stateProps.conversationIDKey,
  onBack: dispatchProps.onBack,
})

type Props = {|
  conversationIDKey: Types.ConversationIDKey,
  onBack: () => void,
|}

class InfoPanelSelector extends React.PureComponent<Props> {
  render() {
    if (!this.props.conversationIDKey) {
      return null
    }

    return isMobile ? (
      <ConnectedInfoPanel onBack={this.props.onBack} conversationIDKey={this.props.conversationIDKey} />
    ) : (
      <Box onClick={this.props.onBack} style={clickCatcherStyle}>
        <Box style={panelContainerStyle} onClick={evt => evt.stopPropagation()}>
          <ConnectedInfoPanel onBack={this.props.onBack} conversationIDKey={this.props.conversationIDKey} />
        </Box>
      </Box>
    )
  }
}

const clickCatcherStyle = {position: 'absolute', top: 38, right: 0, bottom: 0, left: 80}
const panelContainerStyle = {
  position: 'absolute',
  right: 0,
  top: 0,
  bottom: 0,
  width: 320,
  display: 'flex',
  flexDirection: 'column',
}

export default connect(
  mapStateToSelectorProps,
  mapDispatchToSelectorProps,
  mergeSelectorProps
)(InfoPanelSelector)
