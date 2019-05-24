import * as React from 'react'
import * as RPCChatTypes from '../../../../../../constants/types/rpc-chat-gen'
import UnfurlGiphy from '.'

type Props = {
  unfurl: RPCChatTypes.UnfurlGiphyDisplay
  isCollapsed: boolean
  onClose?: () => void
  onCollapse: () => void
}

class Wrapper extends React.PureComponent<Props> {
  render() {
    const {unfurl, isCollapsed, onClose, onCollapse} = this.props
    const props = {
      faviconURL: unfurl.favicon ? unfurl.favicon.url : undefined,
      imageHeight: unfurl.image ? unfurl.image.height : unfurl.video ? unfurl.video.height : 0,
      imageURL: unfurl.image ? unfurl.image.url : unfurl.video ? unfurl.video.url : '',
      imageWidth: unfurl.image ? unfurl.image.width : unfurl.video ? unfurl.video.width : 0,
      isCollapsed,
      isVideo: !!unfurl.video,
      onClose,
      onCollapse,
    }
    return <UnfurlGiphy {...props} />
  }
}

export default Wrapper
