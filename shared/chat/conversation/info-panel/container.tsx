import * as I from 'immutable'
import * as Chat2Gen from '../../../actions/chat2-gen'
import * as FsGen from '../../../actions/fs-gen'
import * as Constants from '../../../constants/chat2'
import * as TeamConstants from '../../../constants/teams'
import * as React from 'react'
import * as RouteTreeGen from '../../../actions/route-tree-gen'
import * as Types from '../../../constants/types/chat2'
import {InfoPanel, Panel, ParticipantTyp} from '.'
import * as Container from '../../../util/container'
import {createShowUserProfile} from '../../../actions/profile-gen'
import {Box} from '../../../common-adapters'
import * as RPCChatTypes from '../../../constants/types/rpc-chat-gen'

type OwnProps = {
  conversationIDKey: Types.ConversationIDKey
  onBack?: () => void
  onCancel?: () => void
  onSelectTab: (t: Panel) => void
  selectedTab: Panel | null
  onSelectAttachmentView: (typ: RPCChatTypes.GalleryItemTyp) => void
  selectedAttachmentView: RPCChatTypes.GalleryItemTyp
}

const getFromMsgID = (info: Types.AttachmentViewInfo): Types.MessageID | null => {
  if (info.last || info.status !== 'success') {
    return null
  }
  const lastMessage = info.messages.size > 0 ? info.messages.last<null>() : null
  return lastMessage ? lastMessage.id : null
}

const mapStateToProps = (state: Container.TypedState, ownProps: OwnProps) => {
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
  } else {
    canDeleteHistory = true
  }
  const isPreview = meta.membershipType === 'youArePreviewing'
  const selectedTab = ownProps.selectedTab || (meta.teamname ? 'members' : 'attachments')
  const selectedAttachmentView = ownProps.selectedAttachmentView || RPCChatTypes.GalleryItemTyp.media
  const attachmentInfo = state.chat2.attachmentViewMap.getIn(
    [conversationIDKey, selectedAttachmentView],
    Constants.makeAttachmentViewInfo()
  )
  const attachmentsLoading = selectedTab === 'attachments' && attachmentInfo.status === 'loading'
  return {
    _attachmentInfo: attachmentInfo,
    _fromMsgID: getFromMsgID(attachmentInfo),
    _infoMap: state.users.infoMap,
    _participantToContactName: meta.participantToContactName,
    _participants: meta.participants,
    _teamMembers: state.teams.teamNameToMembers.get(meta.teamname, I.Map()),
    admin,
    attachmentsLoading,
    canDeleteHistory,
    canEditChannel,
    canSetMinWriterRole,
    canSetRetention,
    channelname: meta.channelname,
    description: meta.descriptionDecorated,
    ignored: meta.status === RPCChatTypes.ConversationStatus.ignored,
    isPreview,
    selectedAttachmentView,
    selectedConversationIDKey: conversationIDKey,
    selectedTab,
    smallTeam: meta.teamType !== 'big',
    spinnerForHide:
      state.waiting.counts.get(Constants.waitingKeyConvStatusChange(ownProps.conversationIDKey), 0) > 0,
    teamname: meta.teamname,
  }
}

const mapDispatchToProps = (
  dispatch: Container.TypedDispatch,
  {conversationIDKey, onBack, onCancel, onSelectAttachmentView}: OwnProps
) => ({
  _navToRootChat: () => dispatch(Chat2Gen.createNavigateToInbox({findNewConversation: false})),
  _onDocDownload: message => dispatch(Chat2Gen.createAttachmentDownload({message})),
  _onEditChannel: (teamname: string) =>
    dispatch(
      RouteTreeGen.createNavigateAppend({
        path: [{props: {conversationIDKey, teamname}, selected: 'chatEditChannel'}],
      })
    ),
  _onLoadMore: (viewType, fromMsgID) =>
    dispatch(Chat2Gen.createLoadAttachmentView({conversationIDKey, fromMsgID, viewType})),
  _onMediaClick: message => dispatch(Chat2Gen.createAttachmentPreviewSelect({message})),
  _onShowClearConversationDialog: () => {
    dispatch(Chat2Gen.createNavigateToThread())
    dispatch(
      RouteTreeGen.createNavigateAppend({
        path: [{props: {conversationIDKey}, selected: 'chatDeleteHistoryWarning'}],
      })
    )
  },
  _onShowInFinder: message =>
    message.downloadPath &&
    dispatch(FsGen.createOpenLocalPathInSystemFileManager({localPath: message.downloadPath})),
  onAttachmentViewChange: viewType => {
    dispatch(Chat2Gen.createLoadAttachmentView({conversationIDKey, viewType}))
    onSelectAttachmentView(viewType)
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

const ConnectedInfoPanel = Container.connect(
  mapStateToProps,
  mapDispatchToProps,
  (stateProps, dispatchProps, ownProps: OwnProps) => ({
    admin: stateProps.admin,
    attachmentsLoading: stateProps.attachmentsLoading,
    canDeleteHistory: stateProps.canDeleteHistory,
    canEditChannel: stateProps.canEditChannel,
    canSetMinWriterRole: stateProps.canSetMinWriterRole,
    canSetRetention: stateProps.canSetRetention,
    channelname: stateProps.channelname,
    customCancelText: 'Done',
    description: stateProps.description,
    docs:
      stateProps.selectedAttachmentView === RPCChatTypes.GalleryItemTyp.doc
        ? {
            docs: stateProps._attachmentInfo.messages
              .map(m => ({
                author: m.author,
                ctime: m.timestamp,
                downloading: m.transferState === 'downloading',
                fileName: m.fileName,
                message: m,
                name: m.title || m.fileName,
                onDownload:
                  !Container.isMobile && !m.downloadPath ? () => dispatchProps._onDocDownload(m) : () => null,
                onShowInFinder:
                  !Container.isMobile && m.downloadPath ? () => dispatchProps._onShowInFinder(m) : null,
                progress: m.transferProgress,
              }))
              .toArray(),
            onLoadMore: stateProps._fromMsgID
              ? () => dispatchProps._onLoadMore(RPCChatTypes.GalleryItemTyp.doc, stateProps._fromMsgID)
              : null,
            status: stateProps._attachmentInfo.status,
          }
        : {docs: [], onLoadMore: () => {}, status: 'loading'},
    ignored: stateProps.ignored,
    isPreview: stateProps.isPreview,
    links:
      stateProps.selectedAttachmentView === RPCChatTypes.GalleryItemTyp.link
        ? {
            links: stateProps._attachmentInfo.messages.reduce((l, m) => {
              if (!m.unfurls.size) {
                l.push({
                  author: m.author,
                  ctime: m.timestamp,
                  snippet: m.decoratedText.stringValue(),
                })
              } else {
                m.unfurls.toList().map(u => {
                  if (u.unfurl.unfurlType === RPCChatTypes.UnfurlType.generic && u.unfurl.generic) {
                    l.push({
                      author: m.author,
                      ctime: m.timestamp,
                      snippet: m.decoratedText.stringValue(),
                      title: u.unfurl.generic.title,
                      url: u.unfurl.generic.url,
                    })
                  }
                })
              }
              return l
            }, []),
            onLoadMore: stateProps._fromMsgID
              ? () => dispatchProps._onLoadMore(RPCChatTypes.GalleryItemTyp.link, stateProps._fromMsgID)
              : null,
            status: stateProps._attachmentInfo.status,
          }
        : {links: [], onLoadMore: () => {}, status: 'loading'},
    media:
      stateProps.selectedAttachmentView === RPCChatTypes.GalleryItemTyp.media
        ? {
            onLoadMore: stateProps._fromMsgID
              ? () => dispatchProps._onLoadMore(RPCChatTypes.GalleryItemTyp.media, stateProps._fromMsgID)
              : null,
            status: stateProps._attachmentInfo.status,
            thumbs: stateProps._attachmentInfo.messages
              .map(m => ({
                ctime: m.timestamp,
                height: m.previewHeight,
                isVideo: !!m.videoDuration,
                onClick: () => dispatchProps._onMediaClick(m),
                previewURL: m.previewURL,
                width: m.previewWidth,
              }))
              .toArray(),
          }
        : {onLoadMore: () => {}, status: 'loading', thumbs: []},
    onAttachmentViewChange: dispatchProps.onAttachmentViewChange,
    onBack: dispatchProps.onBack,
    onCancel: dispatchProps.onCancel,
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
        fullname:
          stateProps._infoMap.getIn([p, 'fullname'], '') || stateProps._participantToContactName.get(p, ''),
        isAdmin: stateProps.teamname
          ? TeamConstants.userIsRoleInTeamWithInfo(
              // @ts-ignore
              stateProps._teamMembers,
              p,
              'admin'
            )
          : false,
        isOwner: stateProps.teamname
          ? TeamConstants.userIsRoleInTeamWithInfo(
              // @ts-ignore
              stateProps._teamMembers,
              p,
              'owner'
            )
          : false,
        username: p,
      }))
      .sort((l: ParticipantTyp, r: ParticipantTyp) => {
        const leftIsAdmin = l.isAdmin || l.isOwner
        const rightIsAdmin = r.isAdmin || r.isOwner
        if (leftIsAdmin && !rightIsAdmin) {
          return -1
        } else if (!leftIsAdmin && rightIsAdmin) {
          return 1
        }
        return l.username.localeCompare(r.username)
      })
      .toArray(),
    selectedAttachmentView: stateProps.selectedAttachmentView,
    selectedConversationIDKey: stateProps.selectedConversationIDKey,
    selectedTab: stateProps.selectedTab,
    smallTeam: stateProps.smallTeam,
    spinnerForHide: stateProps.spinnerForHide,
    teamname: stateProps.teamname,
  })
  // TODO fix this type
)(InfoPanel) as any

type SelectorOwnProps = Container.RouteProps<{
  conversationIDKey: Types.ConversationIDKey
  tab: Panel | null
  attachmentview: RPCChatTypes.GalleryItemTyp
}>

const mapStateToSelectorProps = (state: Container.TypedState, ownProps: SelectorOwnProps) => {
  const conversationIDKey: Types.ConversationIDKey = Container.getRouteProps(
    ownProps,
    'conversationIDKey',
    Constants.noConversationIDKey
  )
  const meta = Constants.getMeta(state, conversationIDKey)
  const selectedTab = Container.getRouteProps(ownProps, 'tab', null)
  const selectedAttachmentView = Container.getRouteProps(
    ownProps,
    'attachmentview',
    RPCChatTypes.GalleryItemTyp.media
  )
  return {
    conversationIDKey,
    selectedAttachmentView,
    selectedTab,
    shouldNavigateOut: meta.conversationIDKey === Constants.noConversationIDKey,
  }
}

const mapDispatchToSelectorProps = (dispatch, {navigation}) => ({
  // Used by HeaderHoc.
  onBack: () => dispatch(Chat2Gen.createToggleInfoPanel()),
  onGoToInbox: () => dispatch(Chat2Gen.createNavigateToInbox({findNewConversation: true})),
  onSelectAttachmentView: view => navigation.setParams({attachmentview: view}),
  onSelectTab: (tab: Panel) => navigation.setParams({tab}),
})

const mergeSelectorProps = (stateProps, dispatchProps, _: SelectorOwnProps) => ({
  conversationIDKey: stateProps.conversationIDKey,
  onBack: dispatchProps.onBack,
  onGoToInbox: dispatchProps.onGoToInbox,
  onSelectAttachmentView: dispatchProps.onSelectAttachmentView,
  onSelectTab: dispatchProps.onSelectTab,
  selectedAttachmentView: stateProps.selectedAttachmentView,
  selectedTab: stateProps.selectedTab,
  shouldNavigateOut: stateProps.shouldNavigateOut,
})

type Props = {
  conversationIDKey: Types.ConversationIDKey
  onBack: () => void
  onGoToInbox: () => void
  onSelectTab: (t: Panel) => void
  selectedTab: Panel | null
  onSelectAttachmentView: (typ: RPCChatTypes.GalleryItemTyp) => void
  selectedAttachmentView: RPCChatTypes.GalleryItemTyp
  shouldNavigateOut: boolean
}

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

    return Container.isMobile ? (
      <ConnectedInfoPanel
        onBack={undefined}
        onCancel={this.props.onBack}
        conversationIDKey={this.props.conversationIDKey}
        onSelectTab={this.props.onSelectTab}
        selectedTab={this.props.selectedTab}
        onSelectAttachmentView={this.props.onSelectAttachmentView}
        selectedAttachmentView={this.props.selectedAttachmentView}
      />
    ) : (
      <Box onClick={this.props.onBack} style={clickCatcherStyle}>
        <Box style={panelContainerStyle} onClick={evt => evt.stopPropagation()}>
          <ConnectedInfoPanel
            onBack={this.props.onBack}
            onSelectTab={this.props.onSelectTab}
            conversationIDKey={this.props.conversationIDKey}
            selectedTab={this.props.selectedTab}
            onSelectAttachmentView={this.props.onSelectAttachmentView}
            selectedAttachmentView={this.props.selectedAttachmentView}
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

const InfoConnected = Container.connect(
  mapStateToSelectorProps,
  mapDispatchToSelectorProps,
  mergeSelectorProps
)(InfoPanelSelector)

export default InfoConnected
