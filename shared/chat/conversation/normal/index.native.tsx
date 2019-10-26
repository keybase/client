import * as React from 'react'
import * as Types from '../../../constants/types/chat2'
import * as Container from '../../../util/container'
import * as Chat2Gen from '../../../actions/chat2-gen'
import Banner from '../bottom-banner/container'
import HeaderArea from '../header-area/container'
import InputArea from '../input-area/container'
import ListArea from '../list-area/container'
import {Box, Box2, LoadingLine, Text} from '../../../common-adapters'
import {globalStyles, globalColors, globalMargins, styleSheetCreate} from '../../../styles'
import {Props} from '.'
import ThreadLoadStatus from '../load-status/container'
import PinnedMessage from '../pinned-message/container'
import AudioRecorder from '../audio-recorder'
import {AmpTracker} from './amptracker'

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

type InputProps = {
  conversationIDKey: Types.ConversationIDKey
  focusInputCounter: number
  jumpToRecent: () => void
  onRequestScrollDown: () => void
  onRequestScrollToBottom: () => void
  onRequestScrollUp: () => void
}

const Input = (props: InputProps) => {
  const ampTracker = React.useRef<AmpTracker>(new AmpTracker(60)).current
  const dispatch = Container.useDispatch()
  const stopRecording = (stopType: Types.AudioStopType) => {
    dispatch(
      Chat2Gen.createStopAudioRecording({
        amps: ampTracker.getBucketedAmps(),
        conversationIDKey: props.conversationIDKey,
        stopType,
      })
    )
  }
  return (
    <>
      <InputArea
        focusInputCounter={props.focusInputCounter}
        jumpToRecent={props.jumpToRecent}
        onRequestScrollDown={props.onRequestScrollDown}
        onRequestScrollToBottom={props.onRequestScrollToBottom}
        onRequestScrollUp={props.onRequestScrollUp}
        conversationIDKey={props.conversationIDKey}
        onStopAudioRecording={stopRecording}
      />
      <AudioRecorder
        conversationIDKey={props.conversationIDKey}
        onMetering={ampTracker.addAmp}
        onStopRecording={stopRecording}
      />
    </>
  )
}

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
      <Input
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
