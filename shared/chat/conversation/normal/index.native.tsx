import * as React from 'react'
import Banner from '../bottom-banner/container'
import HeaderArea from '../header-area/container'
import InputArea from '../input-area/container'
import ListArea from '../list-area/container'
import {Box, Box2, LoadingLine, Text} from '../../../common-adapters'
import {globalStyles, globalColors, globalMargins, styleSheetCreate} from '../../../styles'
import {Props} from '.'
import ThreadLoadStatus from '../load-status/container'
import PinnedMessage from '../pinned-message/container'
import {GatewayDest} from 'react-gateway'
import InvitationToBlock from '../../blocking/invitation-to-block'

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
      <>
        <Box2 direction="vertical" fullWidth={true} fullHeight={true}>
          {this.props.threadLoadedOffline && <Offline />}
          <HeaderArea
            onToggleInfoPanel={this.props.onToggleInfoPanel}
            conversationIDKey={this.props.conversationIDKey}
          />
          <Box2 direction="vertical" fullWidth={true} style={styles.innerContainer}>
            <ThreadLoadStatus conversationIDKey={this.props.conversationIDKey} />
            <PinnedMessage conversationIDKey={this.props.conversationIDKey} />
            <ListArea
              scrollListDownCounter={this.props.scrollListDownCounter}
              scrollListToBottomCounter={this.props.scrollListToBottomCounter}
              scrollListUpCounter={this.props.scrollListUpCounter}
              onFocusInput={this.props.onFocusInput}
              conversationIDKey={this.props.conversationIDKey}
            />
            {this.props.showLoader && <LoadingLine />}
          </Box2>
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
        </Box2>
        <GatewayDest name="convOverlay" component={Box} />
      </>
    )
  }
}

const styles = styleSheetCreate(
  () =>
    ({
      innerContainer: {
        flex: 1,
        position: 'relative',
      },
    } as const)
)

export default Conversation
