import * as Constants from '../../../constants/chat2'
import * as Container from '../../../util/container'
import * as Kb from '../../../common-adapters'
import * as React from 'react'
import * as Styles from '../../../styles'
import * as WaitingConstants from '../../../constants/waiting'
import Banner from '../bottom-banner/container'
import InputArea from '../input-area/container'
import InvitationToBlock from '../../blocking/invitation-to-block'
import ListArea from '../list-area'
import PinnedMessage from '../pinned-message/container'
import ThreadLoadStatus from '../load-status/container'
import ThreadSearch from '../search/container'
import type * as Types from '../../../constants/types/chat2'
import type {Props} from '.'
import {readImageFromClipboard} from '../../../util/clipboard.desktop'
import '../conversation.css'

const Offline = () => (
  <Kb.Banner color="grey" small={true} style={styles.offline}>
    Couldn't load all chat messages due to network connectivity. Retrying...
  </Kb.Banner>
)

const LoadingLine = (p: {conversationIDKey: Types.ConversationIDKey}) => {
  const {conversationIDKey} = p
  const showLoader = Container.useSelector(state =>
    WaitingConstants.anyWaiting(
      state,
      Constants.waitingKeyThreadLoad(conversationIDKey),
      Constants.waitingKeyInboxSyncStarted
    )
  )
  return showLoader ? <Kb.LoadingLine /> : null
}

class Conversation extends React.PureComponent<Props> {
  private onPaste = (e: React.SyntheticEvent) => {
    readImageFromClipboard(e)
      .then(clipboardData => {
        if (clipboardData) {
          this.props.onPaste(clipboardData)
        }
      })
      .catch(() => {})
  }

  private hotKeys = ['mod+f']
  private onHotKey = () => {
    this.props.onToggleThreadSearch()
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
              requestScrollUpRef={this.props.requestScrollUpRef}
              requestScrollToBottomRef={this.props.requestScrollToBottomRef}
              requestScrollDownRef={this.props.requestScrollDownRef}
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
            <LoadingLine conversationIDKey={this.props.conversationIDKey} />
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
        padding: Styles.globalMargins.xxtiny,
      },
      threadSearchStyle: {
        position: 'absolute' as const,
        top: 0,
      },
    } as const)
)

export default Conversation
