import * as Kb from '../../../common-adapters'
import * as React from 'react'
import * as Styles from '../../../styles'
import Banner from '../bottom-banner/container'
import InputArea from '../input-area/container'
import InvitationToBlock from '../../blocking/invitation-to-block'
import ListArea from '../list-area/container'
import PinnedMessage from '../pinned-message/container'
import ThreadLoadStatus from '../load-status/container'
import ThreadSearch from '../search/container'
import {Props} from '.'
import {isDarwin} from '../../../constants/platform'
import {readImageFromClipboard} from '../../../util/clipboard.desktop'
import '../conversation.css'

const Offline = () => (
  <Kb.Box style={styles.offline}>
    <Kb.Text type="BodySmallSemibold">
      Couldn't load all chat messages due to network connectivity. Retrying...
    </Kb.Text>
  </Kb.Box>
)

class Conversation extends React.PureComponent<Props> {
  private onPaste = (e: React.SyntheticEvent) => {
    readImageFromClipboard(e, () => {}).then(clipboardData => {
      if (clipboardData) {
        this.props.onPaste(clipboardData)
      }
    })
  }

  private hotKeys = [`${isDarwin ? 'command' : 'ctrl'}+f`]
  private onHotKey = (cmd: string) => {
    if (cmd.replace(/(command|ctrl)\+/, '') === 'f') {
      this.props.onToggleThreadSearch()
    }
  }

  render() {
    return (
      <Kb.Box className="conversation" style={styles.container} onPaste={this.onPaste}>
        <Kb.HotKey hotKeys={this.hotKeys} onHotKey={this.onHotKey} />
        <Kb.DragAndDrop
          onAttach={this.props.onAttach}
          fullHeight={true}
          fullWidth={true}
          rejectReason={this.props.dragAndDropRejectReason}
        >
          {this.props.threadLoadedOffline && <Offline />}
          <Kb.Box2 direction="vertical" fullWidth={true} fullHeight={true} style={styles.innerContainer}>
            <ListArea
              onFocusInput={this.props.onFocusInput}
              scrollListDownCounter={this.props.scrollListDownCounter}
              scrollListToBottomCounter={this.props.scrollListToBottomCounter}
              scrollListUpCounter={this.props.scrollListUpCounter}
              conversationIDKey={this.props.conversationIDKey}
            />
            <Kb.Box2 direction="vertical" fullWidth={true} style={{left: 0, position: 'absolute', top: 0}}>
              <ThreadLoadStatus conversationIDKey={this.props.conversationIDKey} />
              {!this.props.showThreadSearch && (
                <PinnedMessage conversationIDKey={this.props.conversationIDKey} />
              )}
            </Kb.Box2>
            {this.props.showThreadSearch && (
              <ThreadSearch
                style={styles.threadSearchStyle}
                conversationIDKey={this.props.conversationIDKey}
              />
            )}
            {this.props.showLoader && <Kb.LoadingLine />}
          </Kb.Box2>
          <InvitationToBlock conversationID={this.props.conversationIDKey} />
          <Banner conversationIDKey={this.props.conversationIDKey} />
          <InputArea
            focusInputCounter={this.props.focusInputCounter}
            jumpToRecent={this.props.jumpToRecent}
            onRequestScrollDown={this.props.onRequestScrollDown}
            onRequestScrollToBottom={this.props.onRequestScrollToBottom}
            onRequestScrollUp={this.props.onRequestScrollUp}
            conversationIDKey={this.props.conversationIDKey}
          />
        </Kb.DragAndDrop>
      </Kb.Box>
    )
  }
}

const styles = Styles.styleSheetCreate(
  () =>
    ({
      container: {
        ...Styles.globalStyles.flexBoxColumn,
        flex: 1,
        position: 'relative',
      },
      innerContainer: {
        flex: 1,
        position: 'relative',
      },
      offline: {
        ...Styles.globalStyles.flexBoxCenter,
        backgroundColor: Styles.globalColors.black_10,
        flex: 1,
        maxHeight: Styles.globalMargins.medium,
      },
      threadSearchStyle: {
        position: 'absolute' as const,
        top: 0,
      },
    } as const)
)

export default Conversation
