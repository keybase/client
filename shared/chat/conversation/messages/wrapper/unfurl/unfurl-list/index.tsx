import * as React from 'react'
import * as RPCChatTypes from '../../../../../../constants/types/rpc-chat-gen'
import * as Styles from '../../../../../../styles'
import {Box2} from '../../../../../../common-adapters/index'
import UnfurlGeneric from '../generic/container'
import UnfurlGiphy from '../giphy/container'

export type UnfurlListItem = {
  unfurl: RPCChatTypes.UnfurlDisplay
  url: string
  isCollapsed: boolean
  onClose?: () => void
  onCollapse: () => void
}

export type ListProps = {
  unfurls: Array<UnfurlListItem>
}

export type UnfurlProps = {
  unfurl: RPCChatTypes.UnfurlDisplay
  isCollapsed: boolean
  onClose?: () => void
  onCollapse: () => void
}

class Unfurl extends React.PureComponent<UnfurlProps> {
  render() {
    switch (this.props.unfurl.unfurlType) {
      case RPCChatTypes.UnfurlType.generic:
        return this.props.unfurl.generic ? (
          <UnfurlGeneric
            unfurl={this.props.unfurl.generic}
            isCollapsed={this.props.isCollapsed}
            onClose={this.props.onClose}
            onCollapse={this.props.onCollapse}
          />
        ) : null
      case RPCChatTypes.UnfurlType.giphy:
        return this.props.unfurl.giphy ? (
          <UnfurlGiphy
            unfurl={this.props.unfurl.giphy}
            isCollapsed={this.props.isCollapsed}
            onClose={this.props.onClose}
            onCollapse={this.props.onCollapse}
          />
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
          <Unfurl
            isCollapsed={u.isCollapsed}
            key={u.url}
            unfurl={u.unfurl}
            onClose={u.onClose}
            onCollapse={u.onCollapse}
          />
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
      marginBottom: Styles.globalMargins.xtiny,
      marginTop: Styles.globalMargins.xtiny,
    },
  }),
})

export default UnfurlList
