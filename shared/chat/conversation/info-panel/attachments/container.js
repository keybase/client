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
  selectedView: RPCChatTypes.GalleryItemTyp,
  setAttachmentView: (viewType: RPCChatTypes.GalleryItemTyp) => void,
|}

const getFromMsgID = info => {
  if (info.last || info.status !== 'success') {
    return null
  }
  return info.messages.size > 0 ? info.messages.last().id : null
}

const mapStateToProps = (state, {conversationIDKey}) => {
  const media = state.chat2.attachmentViewMap.getIn(
    [conversationIDKey, RPCChatTypes.localGalleryItemTyp.media],
    Constants.makeAttachmentViewInfo()
  )
  const docs = state.chat2.attachmentViewMap.getIn(
    [conversationIDKey, RPCChatTypes.localGalleryItemTyp.doc],
    Constants.makeAttachmentViewInfo()
  )
  const links = state.chat2.attachmentViewMap.getIn(
    [conversationIDKey, RPCChatTypes.localGalleryItemTyp.link],
    Constants.makeAttachmentViewInfo()
  )
  return {
    _docs: docs,
    _docsFromMsgID: getFromMsgID(docs),
    _links: links,
    _linksFromMsgID: getFromMsgID(links),
    _media: media,
    _mediaFromMsgID: getFromMsgID(media),
  }
}

const mapDispatchToProps = (dispatch, {conversationIDKey, setAttachmentView}) => ({
  _onDocDownload: message => dispatch(Chat2Gen.createAttachmentDownload({message})),
  _onLoadMore: (viewType, fromMsgID) =>
    dispatch(Chat2Gen.createLoadAttachmentView({conversationIDKey, fromMsgID, viewType})),
  _onMediaClick: message => dispatch(Chat2Gen.createAttachmentPreviewSelect({message})),
  _onShowInFinder: message =>
    message.downloadPath &&
    dispatch(FsGen.createOpenLocalPathInSystemFileManager({localPath: message.downloadPath})),
  onViewChange: viewType => {
    dispatch(Chat2Gen.createLoadAttachmentView({conversationIDKey, viewType}))
    setAttachmentView(viewType)
  },
})

const mergeProps = (stateProps, dispatchProps, {conversationIDKey, selectedView}) => ({
  docs: {
    docs: stateProps._docs.messages
      .map(m => ({
        author: m.author,
        ctime: m.timestamp,
        downloading: m.transferState === 'downloading',
        name: m.title || m.fileName,
        onDownload: !isMobile && !m.downloadPath ? () => dispatchProps._onDocDownload(m) : null,
        onShowInFinder: !isMobile && m.downloadPath ? () => dispatchProps._onShowInFinder(m) : null,
        progress: m.transferProgress,
      }))
      .toArray(),
    onLoadMore: stateProps._docsFromMsgID
      ? () => dispatchProps._onLoadMore(RPCChatTypes.localGalleryItemTyp.doc, stateProps._docsFromMsgID)
      : null,
    status: stateProps._docs.status,
  },
  links: {
    links: stateProps._links.messages.reduce((l, m) => {
      m.unfurls.toList().map(u => {
        if (u.unfurl.unfurlType === RPCChatTypes.unfurlUnfurlType.generic && u.unfurl.generic) {
          l.push({
            author: m.author,
            ctime: m.timestamp,
            snippet: m.bodySummary.stringValue(),
            title: u.unfurl.generic.title,
            url: u.unfurl.generic.url,
          })
        }
      })
      return l
    }, []),
    onLoadMore: stateProps._linksFromMsgID
      ? () => dispatchProps._onLoadMore(RPCChatTypes.localGalleryItemTyp.link, stateProps._linksFromMsgID)
      : null,
    status: stateProps._links.status,
  },
  media: {
    onLoadMore: stateProps._mediaFromMsgID
      ? () => dispatchProps._onLoadMore(RPCChatTypes.localGalleryItemTyp.media, stateProps._mediaFromMsgID)
      : null,
    status: stateProps._media.status,
    thumbs: stateProps._media.messages
      .map(m => ({
        ctime: m.timestamp,
        height: m.previewHeight,
        isVideo: !!m.videoDuration,
        onClick: () => dispatchProps._onMediaClick(m),
        previewURL: m.previewURL,
        width: m.previewWidth,
      }))
      .toArray(),
  },
  onViewChange: dispatchProps.onViewChange,
  selectedView,
})

export default namedConnect<OwnProps, _, _, _, _>(
  mapStateToProps,
  mapDispatchToProps,
  mergeProps,
  'AttachmentPanel'
)(AttachmentPanel)
