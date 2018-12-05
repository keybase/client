// @flow
import * as RPCChatTypes from '../../../../../../constants/types/rpc-chat-gen'
import {namedConnect} from '../../../../../../util/container'
import UnfurlGiphy from '.'

type OwnProps = {|
  unfurl: RPCChatTypes.UnfurlGiphyDisplay,
  onClose?: () => void,
|}

const mapStateToProps = (state, ownProps: OwnProps) => {
  const {unfurl, onClose} = ownProps
  return {
    imageHeight: unfurl.image ? unfurl.image.height : unfurl.video ? unfurl.video.height : 0,
    imageWidth: unfurl.image ? unfurl.image.width : unfurl.video ? unfurl.video.width : 0,
    imageURL: unfurl.image ? unfurl.image.url : unfurl.video ? unfurl.video.url : '',
    isVideo: !!unfurl.video,
    faviconURL: unfurl.favicon ? unfurl.favicon.url : undefined,
    onClose,
  }
}

const mapDispatchToProps = (dispatch, ownProps: OwnProps) => ({})

const mergeProps = (stateProps, dispatchProps, ownProps) => ({
  ...stateProps,
})

export default namedConnect<OwnProps, _, _, _, _>(
  mapStateToProps,
  mapDispatchToProps,
  mergeProps,
  'UnfurlGiphy'
)(UnfurlGiphy)
