// @flow
import * as Types from '../../../../constants/types/chat2'
import * as RPCChatTypes from '../../../../constants/types/rpc-chat-gen'
import * as Constants from '../../../../constants/chat2'
import * as Chat2Gen from '../../../../actions/chat2-gen'
import {namedConnect} from '../../../../util/container'
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
  const selectedView = state.chat2.attachmentViewSelectionMap.get(
    conversationIDKey,
    RPCChatTypes.localGalleryItemTyp.media
  )
  return {
    _media: media,
    _docs: docs,
    selectedView,
  }
}

const mapDispatchToProps = (dispatch, {conversationIDKey}) => ({
  _onMediaClick: message => dispatch(Chat2Gen.createAttachmentPreviewSelect({message})),
  _onDocDownload: message => dispatch(Chat2Gen.createAttachmentDownload({message})),
  onViewChange: viewType => dispatch(Chat2Gen.createLoadAttachmentView({conversationIDKey, viewType})),
})

const mergeProps = (stateProps, dispatchProps, {conversationIDKey}) => ({
  docs: {
    status: stateProps._docs.status,
    docs: stateProps._docs.messages.map(m => ({
      author: m.author,
      ctime: m.timestamp,
      name: m.fileName,
      onDownload: () => dispatchProps._onDocDownload(m),
    })),
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
  selectedView: stateProps.selectedView,
})

export default namedConnect<OwnProps, _, _, _, _>(
  mapStateToProps,
  mapDispatchToProps,
  mergeProps,
  'AttachmentPanel'
)(AttachmentPanel)
