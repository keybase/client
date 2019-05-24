import * as React from 'react'
import * as RPCChatTypes from '../../../../../../constants/types/rpc-chat-gen'
import UnfurlGeneric from '.'

type Props = {
  unfurl: RPCChatTypes.UnfurlGenericDisplay
  isCollapsed: boolean
  onClose?: () => void
  onCollapse: () => void
}

class Wrapper extends React.PureComponent<Props> {
  render() {
    const {unfurl, isCollapsed, onClose, onCollapse} = this.props
    const props = {
      description: unfurl.description || undefined,
      faviconURL: unfurl.favicon ? unfurl.favicon.url : undefined,
      imageHeight: unfurl.media ? unfurl.media.height : undefined,
      imageIsVideo: unfurl.media ? unfurl.media.isVideo : undefined,
      imageURL: unfurl.media ? unfurl.media.url : undefined,
      imageWidth: unfurl.media ? unfurl.media.width : undefined,
      isCollapsed,
      onClose,
      onCollapse,
      publishTime: unfurl.publishTime ? unfurl.publishTime * 1000 : undefined,
      showImageOnSide: unfurl.media
        ? unfurl.media.height >= unfurl.media.width &&
          !unfurl.media.isVideo &&
          (unfurl.title.length > 0 || !!unfurl.description)
        : false,
      siteName: unfurl.siteName,
      title: unfurl.title,
      url: unfurl.url,
    }
    return <UnfurlGeneric {...props} />
  }
}

export default Wrapper
