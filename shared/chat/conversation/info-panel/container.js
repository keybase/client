// @flow
import * as I from 'immutable'
import * as Chat2Gen from '../../../actions/chat2-gen'
import * as Constants from '../../../constants/chat2'
import * as TeamConstants from '../../../constants/teams'
import * as React from 'react'
import * as RouteTreeGen from '../../../actions/route-tree-gen'
import * as Types from '../../../constants/types/chat2'
import {InfoPanel} from '.'
import {connect, getRouteProps, isMobile, type RouteProps} from '../../../util/container'
import {createShowUserProfile} from '../../../actions/profile-gen'
import {Box} from '../../../common-adapters'
import * as RPCChatTypes from '../../../constants/types/rpc-chat-gen'

type OwnProps = {|
  conversationIDKey: Types.ConversationIDKey,
  onBack?: () => void,
  onCancel?: () => void,
  onSelectTab: string => void,
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
    const yourOperations = TeamConstants.getCanPerform(state, meta.teamname)
    admin = yourOperations.manageMembers
    canEditChannel = yourOperations.editTeamDescription
    canSetMinWriterRole = yourOperations.setMinWriterRole
    canSetRetention = yourOperations.setRetentionPolicy
    canDeleteHistory = yourOperations.deleteChatHistory
  }
  const isPreview = meta.membershipType === 'youArePreviewing'
  const selectedTab = ownProps.selectedTab || (isPreview ? 'members' : 'attachments')
  return {
    _infoMap: state.users.infoMap,
    _participants: meta.participants,
    _teamMembers: state.teams.teamNameToMembers.get(meta.teamname, I.Map()),
    admin,
    canDeleteHistory,
    canEditChannel,
    canSetMinWriterRole,
    canSetRetention,
    channelname: meta.channelname,
    description: meta.description,
    ignored: meta.status === RPCChatTypes.commonConversationStatus.ignored,
    isPreview,
    selectedConversationIDKey: conversationIDKey,
    selectedTab,
    smallTeam: meta.teamType !== 'big',
    spinnerForHide:
      state.waiting.counts.get(Constants.waitingKeyConvStatusChange(ownProps.conversationIDKey), 0) > 0,
    teamname: meta.teamname,
  }
}

const mapDispatchToProps = (dispatch, {conversationIDKey, onBack}: OwnProps) => ({
  _navToRootChat: () => dispatch(Chat2Gen.createNavigateToInbox({findNewConversation: false})),
  _onEditChannel: (teamname: string) =>
    dispatch(
      RouteTreeGen.createNavigateAppend({
        path: [{props: {conversationIDKey, teamname}, selected: 'chatEditChannel'}],
      })
    ),
  _onShowClearConversationDialog: () => {
    dispatch(Chat2Gen.createNavigateToThread())
    dispatch(
      RouteTreeGen.createNavigateAppend({
        path: [{props: {conversationIDKey}, selected: 'chatDeleteHistoryWarning'}],
      })
    )
  },
  onHideConv: () => dispatch(Chat2Gen.createHideConversation({conversationIDKey})),
  onJoinChannel: () => dispatch(Chat2Gen.createJoinConversation({conversationIDKey})),
  onLeaveConversation: () => dispatch(Chat2Gen.createLeaveConversation({conversationIDKey})),
  onShowBlockConversationDialog: () => {
    dispatch(
      RouteTreeGen.createNavigateAppend({
        path: [
          {
            props: {conversationIDKey},
            selected: 'chatShowBlockConversationDialog',
          },
        ],
      })
    )
  },
  onShowNewTeamDialog: () => {
    dispatch(
      RouteTreeGen.createNavigateAppend({
        path: [
          {
            props: {conversationIDKey},
            selected: 'chatShowNewTeamDialog',
          },
        ],
      })
    )
  },
  onShowProfile: (username: string) => dispatch(createShowUserProfile({username})),
  onUnhideConv: () => dispatch(Chat2Gen.createUnhideConversation({conversationIDKey})),
})

// state props
const mergeProps = (stateProps, dispatchProps, ownProps: OwnProps) => ({
  admin: stateProps.admin,
  canDeleteHistory: stateProps.canDeleteHistory,
  canEditChannel: stateProps.canEditChannel,
  canSetMinWriterRole: stateProps.canSetMinWriterRole,
  canSetRetention: stateProps.canSetRetention,
  channelname: stateProps.channelname,
  customCancelText: 'Done',
  description: stateProps.description,
  ignored: stateProps.ignored,
  isPreview: stateProps.isPreview,
  onBack: ownProps.onBack,
  onCancel: ownProps.onCancel,
  onEditChannel: () => dispatchProps._onEditChannel(stateProps.teamname),
  onHideConv: dispatchProps.onHideConv,
  onJoinChannel: dispatchProps.onJoinChannel,
  onLeaveConversation: dispatchProps.onLeaveConversation,
  onSelectTab: ownProps.onSelectTab,
  onShowBlockConversationDialog: dispatchProps.onShowBlockConversationDialog,
  onShowClearConversationDialog: () => dispatchProps._onShowClearConversationDialog(),
  onShowNewTeamDialog: dispatchProps.onShowNewTeamDialog,
  onShowProfile: dispatchProps.onShowProfile,
  onUnhideConv: dispatchProps.onUnhideConv,
  participants: stateProps._participants
    .map(p => ({
      fullname: stateProps._infoMap.getIn([p, 'fullname'], ''),
      isAdmin: stateProps.teamname
        ? TeamConstants.userIsRoleInTeamWithInfo(stateProps._teamMembers, p, 'admin')
        : false,
      isOwner: stateProps.teamname
        ? TeamConstants.userIsRoleInTeamWithInfo(stateProps._teamMembers, p, 'owner')
        : false,
      username: p,
    }))
    .toArray(),
  selectedConversationIDKey: stateProps.selectedConversationIDKey,
  selectedTab: stateProps.selectedTab,
  smallTeam: stateProps.smallTeam,
  spinnerForHide: stateProps.spinnerForHide,
  teamname: stateProps.teamname,
})

const ConnectedInfoPanel = connect<OwnProps, _, _, _, _>(
  mapStateToProps,
  mapDispatchToProps,
  mergeProps
)(InfoPanel)

type SelectorOwnProps = RouteProps<{conversationIDKey: Types.ConversationIDKey}, {}>

const mapStateToSelectorProps = (state, ownProps: SelectorOwnProps) => {
  const conversationIDKey: Types.ConversationIDKey = getRouteProps(ownProps, 'conversationIDKey')
  const meta = Constants.getMeta(state, conversationIDKey)
  const selectedTab = ownProps.navigation.getParam('tab')
  return {
    conversationIDKey,
    selectedTab,
    shouldNavigateOut: meta.conversationIDKey === Constants.noConversationIDKey,
  }
}

const mapDispatchToSelectorProps = (dispatch, {navigation}) => ({
  // Used by HeaderHoc.
  onBack: () => dispatch(Chat2Gen.createToggleInfoPanel()),
  onGoToInbox: () => dispatch(Chat2Gen.createNavigateToInbox({findNewConversation: true})),
  onSelectTab: tab => navigation.setParams({tab}),
})

const mergeSelectorProps = (stateProps, dispatchProps) => ({
  conversationIDKey: stateProps.conversationIDKey,
  onBack: dispatchProps.onBack,
  onGoToInbox: dispatchProps.onGoToInbox,
  onSelectTab: dispatchProps.onSelectTab,
  selectedTab: stateProps.selectedTab,
  shouldNavigateOut: stateProps.shouldNavigateOut,
})

type Props = {|
  conversationIDKey: Types.ConversationIDKey,
  onBack: () => void,
  onGoToInbox: () => void,
  onSelectTab: string => void,
  selectedTab: ?string,
  shouldNavigateOut: boolean,
|}

class InfoPanelSelector extends React.PureComponent<Props> {
  componentDidUpdate(prevProps) {
    if (!prevProps.shouldNavigateOut && this.props.shouldNavigateOut) {
      this.props.onGoToInbox()
    }
  }
  render() {
    if (!this.props.conversationIDKey) {
      return null
    }

    return isMobile ? (
      <ConnectedInfoPanel
        onBack={undefined}
        onCancel={this.props.onBack}
        conversationIDKey={this.props.conversationIDKey}
        onSelectTab={this.props.onSelectTab}
        selectedTab={this.props.selectedTab}
      />
    ) : (
      <Box onClick={this.props.onBack} style={clickCatcherStyle}>
        <Box style={panelContainerStyle} onClick={evt => evt.stopPropagation()}>
          <ConnectedInfoPanel
            onBack={this.props.onBack}
            onSelectTab={this.props.onSelectTab}
            conversationIDKey={this.props.conversationIDKey}
            selectedTab={this.props.selectedTab}
          />
        </Box>
      </Box>
    )
  }
}

const clickCatcherStyle = {
  bottom: 0,
  left: 0,
  position: 'absolute',
  right: 0,
  top: 39,
}
const panelContainerStyle = {
  bottom: 0,
  display: 'flex',
  flexDirection: 'column',
  position: 'absolute',
  right: 0,
  top: 40,
  width: 320,
}

const InfoConnected = connect<SelectorOwnProps, _, _, _, _>(
  mapStateToSelectorProps,
  mapDispatchToSelectorProps,
  mergeSelectorProps
)(InfoPanelSelector)

export default InfoConnected
