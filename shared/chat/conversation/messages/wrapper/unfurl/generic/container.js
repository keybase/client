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
    imageHeight: unfurl.image ? unfurl.image.height : undefined,
    imageURL: unfurl.image ? unfurl.image.url : undefined,
    imageWidth: unfurl.image ? unfurl.image.width : undefined,
    onClose,
    publishTime: unfurl.publishTime ? unfurl.publishTime * 1000 : undefined,
    showImageOnSide: unfurl.image ? unfurl.image.height >= unfurl.image.width : false,
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
