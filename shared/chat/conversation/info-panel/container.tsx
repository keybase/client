import * as Chat2Gen from '../../../actions/chat2-gen'
import * as Constants from '../../../constants/chat2'
import * as Container from '../../../util/container'
import * as RPCChatTypes from '../../../constants/types/rpc-chat-gen'
import * as React from 'react'
import * as RouteTreeGen from '../../../actions/route-tree-gen'
import * as TeamConstants from '../../../constants/teams'
import * as TeamTypes from '../../../constants/types/teams'
import * as Types from '../../../constants/types/chat2'
import {InfoPanel, Panel, InfoPanelProps} from '.'

type OwnProps = {
  loadDelay?: number
  conversationIDKey: Types.ConversationIDKey
  onBack?: () => void
  onCancel?: () => void
  onSelectTab: (t: Panel) => void
  selectedTab: Panel | null
}

// const loading: Types.AttachmentViewStatus = 'loading'
const noTeamMembers = new Map<string, TeamTypes.MemberInfo>()

const ConnectedInfoPanel = Container.connect(
  (state: Container.TypedState, ownProps: OwnProps) => {
    const conversationIDKey = ownProps.conversationIDKey
    const meta = Constants.getMeta(state, conversationIDKey)

    let canSetMinWriterRole = false
    let canSetRetention = false
    if (meta.teamname) {
      const yourOperations = TeamConstants.getCanPerformByID(state, meta.teamID)
      canSetMinWriterRole = yourOperations.setMinWriterRole
      canSetRetention = yourOperations.setRetentionPolicy
    } else {
    }
    const isPreview = meta.membershipType === 'youArePreviewing'
    const selectedTab = ownProps.selectedTab || 'members'
    const _teamMembers = state.teams.teamIDToMembers.get(meta.teamID) || noTeamMembers
    const _participantInfo = Constants.getParticipantInfo(state, conversationIDKey)
    return {
      _infoMap: state.users.infoMap,
      _participantInfo,
      _team: meta.teamname,
      _teamMembers,
      _username: state.config.username,
      adhocTeam: meta.teamType === 'adhoc',
      canSetMinWriterRole,
      canSetRetention,
      channelname: meta.channelname,
      description: meta.descriptionDecorated,
      isPreview,
      selectedConversationIDKey: conversationIDKey,
      selectedTab,
      smallTeam: meta.teamType !== 'big',
      teamID: meta.teamID,
      teamname: meta.teamname,
    }
  },
  (dispatch: Container.TypedDispatch, {conversationIDKey, onBack, onCancel}: OwnProps) => ({
    _navToRootChat: () => dispatch(Chat2Gen.createNavigateToInbox()),
    _onEditChannel: (teamID: string) =>
      dispatch(
        RouteTreeGen.createNavigateAppend({
          path: [{props: {conversationIDKey, teamID}, selected: 'chatEditChannel'}],
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
    onBack: onBack
      ? () => {
          onBack()
          dispatch(Chat2Gen.createClearAttachmentView({conversationIDKey}))
        }
      : undefined,
    onCancel: onCancel
      ? () => {
          onCancel()
          dispatch(Chat2Gen.createClearAttachmentView({conversationIDKey}))
        }
      : undefined,
  }),
  (stateProps, dispatchProps, ownProps: OwnProps) => {
    const p: InfoPanelProps = {
      channelname: stateProps.channelname,
      customCancelText: 'Done',
      isPreview: stateProps.isPreview,
      onBack: dispatchProps.onBack,
      onCancel: dispatchProps.onCancel,
      onSelectTab: ownProps.onSelectTab,
      selectedConversationIDKey: stateProps.selectedConversationIDKey,
      selectedTab: stateProps.selectedTab,
      smallTeam: stateProps.smallTeam,
      teamname: stateProps.teamname,
    }
    return p
  }
)(InfoPanel)

type SelectorOwnProps =
  | Container.RouteProps<{
      conversationIDKey: Types.ConversationIDKey
      tab: Panel | null
      attachmentview: RPCChatTypes.GalleryItemTyp
    }>
  | {}

type Props = {
  conversationIDKey: Types.ConversationIDKey
  initialTab: Panel | null
  onBack: () => void
  onGoToInbox: () => void
  shouldNavigateOut: boolean
}

const InfoPanelSelector = (props: Props) => {
  const {shouldNavigateOut, onGoToInbox} = props
  const prevShouldNavigateOut = Container.usePrevious(props.shouldNavigateOut)
  React.useEffect(() => {
    !prevShouldNavigateOut && shouldNavigateOut && onGoToInbox()
  }, [prevShouldNavigateOut, shouldNavigateOut, onGoToInbox])
  const [selectedTab, onSelectTab] = React.useState<Panel | null>(props.initialTab)
  if (!props.conversationIDKey) {
    return null
  }

  return (
    <ConnectedInfoPanel
      onBack={undefined}
      onCancel={props.onBack}
      conversationIDKey={props.conversationIDKey}
      onSelectTab={onSelectTab}
      selectedTab={selectedTab}
    />
  )
}

const InfoConnected = Container.connect(
  (state, ownProps: SelectorOwnProps) => {
    const conversationIDKey: Types.ConversationIDKey =
      // @ts-ignore
      typeof ownProps.navigation !== 'undefined'
        ? Container.getRouteProps(ownProps as any, 'conversationIDKey', Constants.noConversationIDKey)
        : state.chat2.selectedConversation

    const meta = Constants.getMeta(state, conversationIDKey)
    return {
      _panel: state.chat2.infoPanelSelectedTab,
      conversationIDKey,
      shouldNavigateOut: meta.conversationIDKey === Constants.noConversationIDKey,
    }
  },
  dispatch => ({
    // Used by HeaderHoc.
    onBack: () => dispatch(Chat2Gen.createShowInfoPanel({show: false})),
    onGoToInbox: () => dispatch(Chat2Gen.createNavigateToInbox()),
  }),
  (stateProps, dispatchProps, ownProps: SelectorOwnProps) => ({
    conversationIDKey: stateProps.conversationIDKey,
    initialTab:
      // @ts-ignore
      typeof ownProps.navigation !== 'undefined'
        ? Container.getRouteProps(
            // @ts-ignore
            ownProps,
            'tab',
            null
          )
        : stateProps._panel,
    onBack: dispatchProps.onBack,
    onGoToInbox: dispatchProps.onGoToInbox,
    shouldNavigateOut: stateProps.shouldNavigateOut,
  })
)(InfoPanelSelector)

export default InfoConnected
