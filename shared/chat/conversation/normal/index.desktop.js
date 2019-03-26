// @flow
import * as React from 'react'
import Banner from '../bottom-banner/container'
import HeaderArea from '../header-area/container'
import InputArea from '../input-area/container'
import ListArea from '../list-area/container'
import * as Kb from '../../../common-adapters'
import * as Styles from '../../../styles'
import {readImageFromClipboard} from '../../../util/clipboard.desktop'
import type {Props} from './index.types'
import '../conversation.css'

type State = {|
  showDropOverlay: boolean,
|}

const Offline = () => (
  <Kb.Box style={styles.offline}>
    <Kb.Text type="BodySmallSemibold">
      Couldn't load all chat messages due to network connectivity. Retrying...
    </Kb.Text>
  </Kb.Box>
)

class Conversation extends React.PureComponent<Props, State> {
  _mounted = false
  state = {showDropOverlay: false}

  componentWillUnmount() {
    this._mounted = false
  }

  componentDidMount() {
    this._mounted = true
  }

  _onPaste = e => {
    readImageFromClipboard(e, () => {
      this._mounted && this.setState({showDropOverlay: true})
    }).then(clipboardData => {
      this._mounted && this.setState({showDropOverlay: false})
      if (clipboardData) {
        this.props.onPaste(clipboardData)
      }
    })
  }

  render() {
    return (
      <Kb.Box className="conversation" style={styles.container} onPaste={this._onPaste}>
        <Kb.DragAndDrop onAttach={this.props.onAttach}>
          {this.props.threadLoadedOffline && <Offline />}
          <HeaderArea
            isPending={this.props.isPending}
            onToggleInfoPanel={this.props.onToggleInfoPanel}
            conversationIDKey={this.props.conversationIDKey}
          />
          {this.props.showLoader && <Kb.LoadingLine />}
          <ListArea
            isPending={this.props.isPending}
            onFocusInput={this.props.onFocusInput}
            scrollListDownCounter={this.props.scrollListDownCounter}
            scrollListToBottomCounter={this.props.scrollListToBottomCounter}
            scrollListUpCounter={this.props.scrollListUpCounter}
            conversationIDKey={this.props.conversationIDKey}
          />
          <Banner conversationIDKey={this.props.conversationIDKey} />
          <InputArea
            isPending={this.props.isPending}
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

const styles = Styles.styleSheetCreate({
  container: {
    ...Styles.globalStyles.flexBoxColumn,
    flex: 1,
    position: 'relative',
  },
  offline: {
    ...Styles.globalStyles.flexBoxCenter,
    backgroundColor: Styles.globalColors.black_10,
    flex: 1,
    maxHeight: Styles.globalMargins.medium,
  },
})

export default Conversation
