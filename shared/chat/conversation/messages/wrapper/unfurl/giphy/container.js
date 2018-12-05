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
    faviconURL: unfurl.favicon ? unfurl.favicon.url : undefined,
    imageHeight: unfurl.image ? unfurl.image.height : unfurl.video ? unfurl.video.height : 0,
    imageURL: unfurl.image ? unfurl.image.url : unfurl.video ? unfurl.video.url : '',
    imageWidth: unfurl.image ? unfurl.image.width : unfurl.video ? unfurl.video.width : 0,
    isVideo: !!unfurl.video,
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
