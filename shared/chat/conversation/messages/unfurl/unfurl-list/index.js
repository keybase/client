// @flow
import * as React from 'react'
import * as RPCChatTypes from '../../../../../constants/types/rpc-chat-gen'
import {Box2} from '../../../../../common-adapters/index'
import UnfurlGeneric from '../generic/container'

export type UnfurlListItem = {
  unfurl: RPCChatTypes.UnfurlDisplay,
  onClose: () => void,
}

export type ListProps = {
  unfurls: Array<UnfurlListItem>,
}

export type UnfurlProps = {
  unfurl: RPCChatTypes.UnfurlDisplay,
  onClose: () => void,
}

class Unfurl extends React.PureComponent<UnfurlProps> {
  render() {
    switch (this.props.unfurl.unfurlType) {
      case RPCChatTypes.unfurlUnfurlType.generic:
        return this.props.unfurl.generic ? (
          <UnfurlGeneric
            title={this.props.unfurl.generic.title}
            url={this.props.unfurl.generic.url}
            siteName={this.props.unfurl.generic.siteName}
            description={this.props.unfurl.generic.description || undefined}
            publishTime={this.props.unfurl.generic.publishTime || undefined}
            image={this.props.unfurl.generic.image || undefined}
            faviconURL={this.props.unfurl.generic.favicon ? this.props.unfurl.generic.favicon.url : undefined}
          />
        ) : null
      default:
        return null
    }
  }
}

class UnfurlList extends React.PureComponent<ListProps> {
  render() {
    const unfurls = []
    for (let u of this.props.unfurls) {
      unfurls.push(<Unfurl unfurl={u.unfurl} onClose={u.onClose} />)
    }
    return (
      <Box2 direction="vertical" gap="tiny" fullWidth={true}>
        {unfurls}
      </Box2>
    )
  }
}

export default UnfurlList
