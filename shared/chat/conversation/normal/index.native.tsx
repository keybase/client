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

const Conversation = (props: Props) => {
  return (
    <Box2 direction="vertical" fullWidth={true} fullHeight={true}>
      {props.threadLoadedOffline && <Offline />}
      <HeaderArea onToggleInfoPanel={props.onToggleInfoPanel} conversationIDKey={props.conversationIDKey} />
      <Box2 direction="vertical" fullWidth={true} style={styles.innerContainer}>
        <ThreadLoadStatus conversationIDKey={props.conversationIDKey} />
        <PinnedMessage conversationIDKey={props.conversationIDKey} />
        <ListArea
          scrollListDownCounter={props.scrollListDownCounter}
          scrollListToBottomCounter={props.scrollListToBottomCounter}
          scrollListUpCounter={props.scrollListUpCounter}
          onFocusInput={props.onFocusInput}
          conversationIDKey={props.conversationIDKey}
        />
        {props.showLoader && <LoadingLine />}
      </Box2>
      <Banner conversationIDKey={props.conversationIDKey} />
      <InputArea
        focusInputCounter={props.focusInputCounter}
        jumpToRecent={props.jumpToRecent}
        onRequestScrollDown={props.onRequestScrollDown}
        onRequestScrollToBottom={props.onRequestScrollToBottom}
        onRequestScrollUp={props.onRequestScrollUp}
        conversationIDKey={props.conversationIDKey}
      />
    </Box2>
  )
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
