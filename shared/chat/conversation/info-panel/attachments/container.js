// @flow
import * as Types from '../../../../constants/types/chat2'
import * as RPCChatTypes from '../../../../constants/types/rpc-chat-gen'
import * as Constants from '../../../../constants/chat2'
import * as Chat2Gen from '../../../../actions/chat2-gen'
import * as FsGen from '../../../../actions/fs-gen'
import {isMobile, namedConnect} from '../../../../util/container'
import AttachmentPanel from '.'

type OwnProps = {|
  conversationIDKey: Types.ConversationIDKey,
|}

const mapStateToProps = (state, {conversationIDKey}) => {
  const media = state.chat2.attachmentViewMap.getIn(
    [conversationIDKey, RPCChatTypes.localGalleryItemTyp.media],
    Constants.makeAttachmentViewInfo()
  )
  const docs = state.chat2.attachmentViewMap.getIn(
    [conversationIDKey, RPCChatTypes.localGalleryItemTyp.doc],
    Constants.makeAttachmentViewInfo()
  )
  return {
    _docs: docs,
    _media: media,
  }
}

const mapDispatchToProps = (dispatch, {conversationIDKey}) => ({
  _onDocDownload: message => dispatch(Chat2Gen.createAttachmentDownload({message})),
  _onMediaClick: message => dispatch(Chat2Gen.createAttachmentPreviewSelect({message})),
  _onShowInFinder: message =>
    message.downloadPath &&
    dispatch(FsGen.createOpenLocalPathInSystemFileManager({localPath: message.downloadPath})),
  onViewChange: (viewType, num) =>
    dispatch(Chat2Gen.createLoadAttachmentView({conversationIDKey, num, viewType})),
})

const mergeProps = (stateProps, dispatchProps, {conversationIDKey}) => ({
  docs: {
    docs: stateProps._docs.messages
      .map(m => ({
        author: m.author,
        ctime: m.timestamp,
        downloading: m.transferState === 'downloading',
        name: m.title || m.fileName,
        progress: m.transferProgress,
        onDownload: !isMobile && !m.downloadPath ? () => dispatchProps._onDocDownload(m) : null,
        onShowInFinder: !isMobile && m.downloadPath ? () => dispatchProps._onShowInFinder(m) : null,
      }))
      .toArray(),
    status: stateProps._docs.status,
  },
  media: {
    status: stateProps._media.status,
    thumbs: stateProps._media.messages
      .map(m => ({
        ctime: m.timestamp,
        duration: m.videoDuration,
        height: m.previewHeight,
        onClick: () => dispatchProps._onMediaClick(m),
        previewURL: m.previewURL,
        width: m.previewWidth,
      }))
      .toArray(),
  },
  onViewChange: dispatchProps.onViewChange,
})

export default namedConnect<OwnProps, _, _, _, _>(
  mapStateToProps,
  mapDispatchToProps,
  mergeProps,
  'AttachmentPanel'
)(AttachmentPanel)
