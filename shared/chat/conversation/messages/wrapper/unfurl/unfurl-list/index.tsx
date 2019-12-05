import * as React from 'react'
import * as Types from '../../../../../../constants/types/chat2'
import * as RPCChatTypes from '../../../../../../constants/types/rpc-chat-gen'
import * as Styles from '../../../../../../styles'
import {Box2} from '../../../../../../common-adapters/index'
import UnfurlGeneric from '../generic/container'
import UnfurlGiphy from '../giphy/container'
import UnfurlMap from '../map'
import UnfurlSharingEnded from '../map/ended'

export type UnfurlListItem = {
  unfurl: RPCChatTypes.UnfurlDisplay
  url: string
  isCollapsed: boolean
  onClose?: () => void
  onCollapse: () => void
}

export type ListProps = {
  conversationIDKey: Types.ConversationIDKey
  isAuthor: boolean
  author?: string
  toggleMessagePopup: () => void
  unfurls: Array<UnfurlListItem>
}

export type UnfurlProps = {
  conversationIDKey: Types.ConversationIDKey
  isAuthor: boolean
  author?: string
  isCollapsed: boolean
  onClose?: () => void
  onCollapse: () => void
  toggleMessagePopup: () => void
  unfurl: RPCChatTypes.UnfurlDisplay
}

class Unfurl extends React.PureComponent<UnfurlProps> {
  render() {
    switch (this.props.unfurl.unfurlType) {
      case RPCChatTypes.UnfurlType.generic:
        return this.props.unfurl.generic ? (
          this.props.unfurl.generic.mapInfo ? (
            this.props.unfurl.generic.mapInfo.isLiveLocationDone ? (
              <UnfurlSharingEnded endTime={this.props.unfurl.generic.mapInfo.time} />
            ) : (
              <UnfurlMap
                conversationIDKey={this.props.conversationIDKey}
                coord={this.props.unfurl.generic.mapInfo.coord}
                imageHeight={this.props.unfurl.generic.media ? this.props.unfurl.generic.media.height : 0}
                imageURL={this.props.unfurl.generic.media ? this.props.unfurl.generic.media.url : ''}
                imageWidth={this.props.unfurl.generic.media ? this.props.unfurl.generic.media.width : 0}
                isAuthor={this.props.isAuthor}
                author={this.props.author}
                isLiveLocationDone={this.props.unfurl.generic.mapInfo.isLiveLocationDone}
                liveLocationEndTime={this.props.unfurl.generic.mapInfo.liveLocationEndTime || undefined}
                time={this.props.unfurl.generic.mapInfo.time}
                toggleMessagePopup={this.props.toggleMessagePopup}
                url={this.props.unfurl.generic.url}
              />
            )
          ) : (
            <UnfurlGeneric
              unfurl={this.props.unfurl.generic}
              isCollapsed={this.props.isCollapsed}
              onClose={this.props.onClose}
              onCollapse={this.props.onCollapse}
            />
          )
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
            conversationIDKey={this.props.conversationIDKey}
            isAuthor={this.props.isAuthor}
            author={this.props.author}
            isCollapsed={u.isCollapsed}
            key={u.url}
            unfurl={u.unfurl}
            onClose={u.onClose}
            onCollapse={u.onCollapse}
            toggleMessagePopup={this.props.toggleMessagePopup}
          />
        ))}
      </Box2>
    )
  }
}

const styles = Styles.styleSheetCreate(
  () =>
    ({
      container: Styles.platformStyles({
        common: {
          alignSelf: 'flex-start',
          flex: 1,
          marginBottom: Styles.globalMargins.xtiny,
          marginTop: Styles.globalMargins.xtiny,
        },
      }),
    } as const)
)

export default UnfurlList
