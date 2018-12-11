// @flow
import * as React from 'react'
import * as RPCChatTypes from '../../../../../../constants/types/rpc-chat-gen'
import UnfurlGeneric from '.'

type Props = {|
  unfurl: RPCChatTypes.UnfurlGenericDisplay,
  onClose?: () => void,
|}

class Wrapper extends React.PureComponent<Props> {
  render() {
    const {unfurl, onClose} = this.props
    const props = {
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
    return <UnfurlGeneric {...props} />
  }
}

export default Wrapper
