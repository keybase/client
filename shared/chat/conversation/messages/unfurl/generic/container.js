// @flow
import * as RPCChatTypes from '../../../../../constants/types/rpc-chat-gen'
import {namedConnect} from '../../../../../util/container'
import UnfurlGeneric from '.'

type OwnProps = {
  title: string,
  url: string,
  siteName: string,
  description?: string,
  publishTime?: number,
  image?: RPCChatTypes.UnfurlImageDisplay,
  faviconURL?: string,
  onClose?: () => void,
}

const mapStateToProps = (state, ownProps: OwnProps) => ({})
const mapDispatchToProps = (dispatch, ownProps: OwnProps) => ({})

const mergeProps = (stateProps, dispatchProps, ownProps) => {
  return {
    title: ownProps.title,
    url: ownProps.url,
    siteName: ownProps.siteName,
    description: ownProps.description,
    publishTime: ownProps.publishTime,
    faviconURL: ownProps.faviconURL,
    imageURL: ownProps.image ? ownProps.image.url : undefined,
    onClose: ownProps.onClose,
    showImageOnSide: ownProps.image ? ownProps.image.height >= ownProps.image.width : false,
  }
}

export default namedConnect<OwnProps, _, _, _, _>(
  mapStateToProps,
  mapDispatchToProps,
  mergeProps,
  'UnfurlGeneric'
)(UnfurlGeneric)
