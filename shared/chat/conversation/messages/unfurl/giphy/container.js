// @flow
import * as RPCChatTypes from '../../../../../constants/types/rpc-chat-gen'
import {namedConnect} from '../../../../../util/container'
import {clamp} from 'lodash-es'
import {imgMaxWidth} from '../../../../../chat/conversation/messages/attachment/image/image-render'
import UnfurlGiphy from '.'

type OwnProps = {|
  unfurl: RPCChatTypes.UnfurlGiphyDisplay,
  onClose?: () => void,
|}

const clampImageSize = ({width = 0, height = 0}, maxWidth, maxHeight) =>
  height > width
    ? {
        height: clamp(height || 0, 0, maxSize),
        width: (clamp(height || 0, 0, maxSize) * width) / (height || 1),
      }
    : {
        height: (clamp(width || 0, 0, maxSize) * height) / (width || 1),
        width: clamp(width || 0, 0, maxSize),
      }

const mapStateToProps = (state, ownProps: OwnProps) => {
  const {unfurl, onClose} = ownProps
  const {height, width} = clampImageSize({
    width: unfurl.image.width,
    height: unfurl.image.height,
  })
  return {
    imageHeight: height,
    imageWidth: Math.min(imgMaxWidth(), width),
    imageURL: unfurl.image.url,
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
