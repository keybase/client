import * as React from 'react'
import Banner from '../bottom-banner/container'
import HeaderArea from '../header-area/container'
import InputArea from '../input-area/container'
import ListArea from '../list-area/container'
import {Box, LoadingLine, Text} from '../../../common-adapters'
import {globalStyles, globalColors, globalMargins} from '../../../styles'
import {Props} from './index.types'

const Offline = () => (
  <Box
    style={{
      ...globalStyles.flexBoxCenter,
      backgroundColor: globalColors.greyDark,
      paddingBottom: globalMargins.tiny,
      paddingLeft: globalMargins.medium,
      paddingRight: globalMargins.medium,
      paddingTop: globalMargins.tiny,
      width: '100%',
    }}
  >
    <Text center={true} type="BodySmallSemibold">
      Couldn't load all chat messages due to network connectivity. Retrying...
    </Text>
  </Box>
)

class Conversation extends React.PureComponent<Props> {
  render() {
    return (
      <Box style={containerStyle}>
        {this.props.threadLoadedOffline && <Offline />}
        <HeaderArea
          onToggleInfoPanel={this.props.onToggleInfoPanel}
          conversationIDKey={this.props.conversationIDKey}
        />
        {this.props.showLoader && <LoadingLine />}
        <ListArea
          scrollListDownCounter={this.props.scrollListDownCounter}
          scrollListToBottomCounter={this.props.scrollListToBottomCounter}
          scrollListUpCounter={this.props.scrollListUpCounter}
          onFocusInput={this.props.onFocusInput}
          conversationIDKey={this.props.conversationIDKey}
        />
        <Banner conversationIDKey={this.props.conversationIDKey} />
        <InputArea
          focusInputCounter={this.props.focusInputCounter}
          jumpToRecent={this.props.jumpToRecent}
          onRequestScrollDown={this.props.onRequestScrollDown}
          onRequestScrollToBottom={this.props.onRequestScrollToBottom}
          onRequestScrollUp={this.props.onRequestScrollUp}
          conversationIDKey={this.props.conversationIDKey}
        />
      </Box>
    )
  }
}

const containerStyle = {
  ...globalStyles.flexBoxColumn,
  ...globalStyles.fullHeight,
}

export default Conversation
