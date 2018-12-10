// @flow
import * as RPCChatTypes from '../../../../../../constants/types/rpc-chat-gen'
import {namedConnect} from '../../../../../../util/container'
import UnfurlGeneric from '.'

type OwnProps = {|
  unfurl: RPCChatTypes.UnfurlGenericDisplay,
  onClose?: () => void,
|}

const mapStateToProps = (state, ownProps: OwnProps) => {
  const {unfurl, onClose} = ownProps
  return {
    description: unfurl.description || undefined,
    faviconURL: unfurl.favicon ? unfurl.favicon.url : undefined,
    imageHeight: unfurl.media ? unfurl.media.height : undefined,
    imageURL: unfurl.media ? unfurl.media.url : undefined,
    imageWidth: unfurl.media ? unfurl.media.width : undefined,
    imageIsVideo: unfurl.media ? unfurl.media.isVideo : undefined,
    onClose,
    publishTime: unfurl.publishTime ? unfurl.publishTime * 1000 : undefined,
    showImageOnSide: unfurl.media ? unfurl.media.height >= unfurl.media.width : false,
    siteName: unfurl.siteName,
    title: unfurl.title,
    url: unfurl.url,
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
  'UnfurlGeneric'
)(UnfurlGeneric)
