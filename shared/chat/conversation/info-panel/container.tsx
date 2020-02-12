import * as Chat2Gen from '../../../actions/chat2-gen'
import * as Constants from '../../../constants/chat2'
import * as Container from '../../../util/container'
import * as RPCChatTypes from '../../../constants/types/rpc-chat-gen'
import * as React from 'react'
import * as Types from '../../../constants/types/chat2'
import * as TeamConstants from '../../../constants/teams'
import {InfoPanel, Panel} from '.'

type OwnProps = {
  loadDelay?: number
  conversationIDKey: Types.ConversationIDKey
  onBack?: () => void
  onCancel?: () => void
  onSelectTab: (t: Panel) => void
  selectedTab: Panel | null
}

const ConnectedInfoPanel = Container.connect(
  (state: Container.TypedState, ownProps: OwnProps) => {
    const conversationIDKey = ownProps.conversationIDKey
    const meta = Constants.getMeta(state, conversationIDKey)
    const isPreview = meta.membershipType === 'youArePreviewing'
    return {
      channelname: meta.channelname,
      isPreview,
      selectedConversationIDKey: conversationIDKey,
      smallTeam: meta.teamType !== 'big',
      teamname: meta.teamname,
      yourRole: TeamConstants.getRole(state, meta.teamID),
    }
  },
  (dispatch: Container.TypedDispatch, {conversationIDKey, onBack, onCancel}: OwnProps) => ({
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
    const {channelname, isPreview, selectedConversationIDKey, smallTeam, teamname, yourRole} = stateProps
    const {onSelectTab, selectedTab} = ownProps
    const {onBack, onCancel} = dispatchProps
    return {
      channelname,
      customCancelText: 'Done',
      isPreview,
      onBack,
      onCancel,
      onSelectTab,
      selectedConversationIDKey,
      selectedTab: selectedTab ?? 'members',
      smallTeam,
      teamname,
      yourRole,
    }
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
