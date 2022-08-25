import * as React from 'react'
import Banner from '../bottom-banner/container'
import InputArea from '../input-area/container'
import ListArea from '../list-area'
import * as Kb from '../../../common-adapters/mobile.native'
import type {LayoutEvent} from '../../../common-adapters/box'
import * as Styles from '../../../styles'
import type {Props} from '.'
import ThreadLoadStatus from '../load-status/container'
import PinnedMessage from '../pinned-message/container'
import {PortalHost} from '@gorhom/portal'
import InvitationToBlock from '../../blocking/invitation-to-block'

const Offline = () => (
  <Kb.Banner color="grey" small={true} style={styles.offline}>
    Couldn't load all chat messages due to network connectivity. Retrying...
  </Kb.Banner>
)

const Conversation = React.memo((props: Props) => {
  const [maxInputArea, setMaxInputArea] = React.useState<number | undefined>(undefined)
  const onLayout = React.useCallback((e: LayoutEvent) => {
    setMaxInputArea(e.nativeEvent.layout.height)
  }, [])

  const innerComponent = (
    <Kb.BoxGrow onLayout={onLayout}>
      <Kb.Box2 direction="vertical" fullWidth={true} style={styles.innerContainer}>
        <ThreadLoadStatus conversationIDKey={props.conversationIDKey} />
        <PinnedMessage conversationIDKey={props.conversationIDKey} />
        <ListArea
          requestScrollToBottomRef={props.requestScrollToBottomRef}
          requestScrollDownRef={props.requestScrollDownRef}
          requestScrollUpRef={props.requestScrollUpRef}
          onFocusInput={props.onFocusInput}
          conversationIDKey={props.conversationIDKey}
        />
        {props.showLoader && <Kb.LoadingLine />}
      </Kb.Box2>
      <InvitationToBlock conversationID={props.conversationIDKey} />
      <Banner conversationIDKey={props.conversationIDKey} />
      <InputArea
        focusInputCounter={props.focusInputCounter}
        jumpToRecent={props.jumpToRecent}
        onRequestScrollDown={props.onRequestScrollDown}
        onRequestScrollToBottom={props.onRequestScrollToBottom}
        onRequestScrollUp={props.onRequestScrollUp}
        conversationIDKey={props.conversationIDKey}
        maxInputArea={maxInputArea}
      />
    </Kb.BoxGrow>
  )
  return (
    <Kb.Box style={styles.innerContainer}>
      <Kb.Box2 direction="vertical" fullWidth={true} fullHeight={true}>
        {props.threadLoadedOffline && <Offline />}
        {innerComponent}
      </Kb.Box2>
      <PortalHost name="convOverlay" />
    </Kb.Box>
  )
})

const styles = Styles.styleSheetCreate(
  () =>
    ({
      innerContainer: {
        flex: 1,
        position: 'relative',
      },
      offline: {padding: Styles.globalMargins.xxtiny},
      outerContainer: Styles.platformStyles({
        isTablet: {
          flex: 1,
          position: 'relative',
        },
      }),
    } as const)
)

export default Conversation
