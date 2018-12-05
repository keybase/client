// @flow
import * as React from 'react'
import * as RPCChatTypes from '../../../../../../constants/types/rpc-chat-gen'
import * as Styles from '../../../../../../styles'
import {Box2} from '../../../../../../common-adapters/index'
import UnfurlGeneric from '../generic/container'
import UnfurlGiphy from '../giphy/container'

export type UnfurlListItem = {
  unfurl: RPCChatTypes.UnfurlDisplay,
  url: string,
  onClose?: () => void,
}

export type ListProps = {
  unfurls: Array<UnfurlListItem>,
}

export type UnfurlProps = {
  unfurl: RPCChatTypes.UnfurlDisplay,
  onClose?: () => void,
}

class Unfurl extends React.PureComponent<UnfurlProps> {
  render() {
    switch (this.props.unfurl.unfurlType) {
      case RPCChatTypes.unfurlUnfurlType.generic:
        return this.props.unfurl.generic ? (
          <UnfurlGeneric unfurl={this.props.unfurl.generic} onClose={this.props.onClose} />
        ) : null
      case RPCChatTypes.unfurlUnfurlType.giphy:
        return this.props.unfurl.giphy ? (
          <UnfurlGiphy unfurl={this.props.unfurl.giphy} onClose={this.props.onClose} />
        ) : null
      default:
        return null
    }
  }
}

class UnfurlList extends React.PureComponent<ListProps> {
  render() {
    return (
      <Box2 direction="vertical" gap="tiny" style={styles.container}>
        {this.props.unfurls.map(u => (
          <Unfurl key={u.url} unfurl={u.unfurl} onClose={u.onClose} />
        ))}
      </Box2>
    )
  }
}

const styles = Styles.styleSheetCreate({
  container: Styles.platformStyles({
    common: {
      alignSelf: 'flex-start',
      flex: 1,
      marginTop: Styles.globalMargins.xtiny,
      marginBottom: Styles.globalMargins.xtiny,
    },
  }),
})

export default UnfurlList
