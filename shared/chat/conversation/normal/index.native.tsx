import * as C from '@/constants'
import * as Chat from '@/stores/chat2'
import {PortalHost} from '@/common-adapters/portal.native'
import * as Kb from '@/common-adapters'
import * as React from 'react'
import {useSafeAreaInsets, useSafeAreaFrame} from 'react-native-safe-area-context'
import Banner from '../bottom-banner'
import InputArea from '../input-area/container'
import InvitationToBlock from '@/chat/blocking/invitation-to-block'
import ListArea from '../list-area'
import PinnedMessage from '../pinned-message'
import ThreadLoadStatus from '../load-status'
import type {LayoutEvent} from '@/common-adapters/box'
import {MaxInputAreaContext} from '../input-area/normal2/max-input-area-context'
import logger from '@/logger'

const Offline = () => (
  <Kb.Banner color="grey" small={true} style={styles.offline}>
    {"Couldn't load all chat messages due to network connectivity. Retrying..."}
  </Kb.Banner>
)

const LoadingLine = () => {
  const conversationIDKey = Chat.useChatContext(s => s.id)
  const showLoader = C.Waiting.useAnyWaiting([
    C.waitingKeyChatThreadLoad(conversationIDKey),
    C.waitingKeyChatInboxSyncStarted,
  ])
  return showLoader ? <Kb.LoadingLine /> : null
}

const Conversation = React.memo(function Conversation() {
  const [maxInputArea, setMaxInputArea] = React.useState(0)
  const onLayout = React.useCallback((e: LayoutEvent) => {
    setMaxInputArea(e.nativeEvent.layout.height)
  }, [])

  const conversationIDKey = Chat.useChatContext(s => s.id)
  logger.info(`Conversation: rendering convID: ${conversationIDKey}`)

  const innerComponent = (
    <Kb.BoxGrow onLayout={onLayout}>
      <Kb.Box2 direction="vertical" fullWidth={true} style={styles.innerContainer}>
        <ThreadLoadStatus />
        <PinnedMessage />
        <ListArea />
        <LoadingLine />
      </Kb.Box2>
      <InvitationToBlock />
      <Banner />
      <MaxInputAreaContext.Provider value={maxInputArea}>
        <InputArea />
      </MaxInputAreaContext.Provider>
    </Kb.BoxGrow>
  )

  const insets = useSafeAreaInsets()
  const headerHeight = Kb.Styles.isTablet ? 115 : 44
  const windowHeight = useSafeAreaFrame().height
  const height = windowHeight - insets.top - headerHeight

  const safeStyle = React.useMemo(
    () =>
      Kb.Styles.isAndroid
        ? {paddingBottom: insets.bottom}
        : {
            height,
            maxHeight: height,
            minHeight: height,
            paddingBottom: Kb.Styles.isTablet ? 0 : insets.bottom,
          },
    [height, insets.bottom]
  )

  const threadLoadedOffline = Chat.useChatContext(s => s.meta.offline)

  const content = (
    <Kb.Box2
      direction="vertical"
      style={styles.innerContainer}
      fullWidth={true}
      fullHeight={true}
      key={conversationIDKey}
    >
      <Kb.Box2 direction="vertical" fullWidth={true} fullHeight={true}>
        {threadLoadedOffline && <Offline />}
        {innerComponent}
      </Kb.Box2>
      <PortalHost name="convOverlay" />
    </Kb.Box2>
  )

  return Kb.Styles.isAndroid ? (
    <Kb.Box2 direction="vertical" fullWidth={true} fullHeight={true} style={safeStyle}>
      {content}
    </Kb.Box2>
  ) : (
    <Kb.Box2 direction="vertical" fullWidth={true} fullHeight={true} style={safeStyle}>
      <Kb.KeyboardAvoidingView2
        extraPadding={Kb.Styles.isTablet ? -65 : -insets.bottom}
        behavior="translate-with-padding"
      >
        {content}
      </Kb.KeyboardAvoidingView2>
    </Kb.Box2>
  )
})

const styles = Kb.Styles.styleSheetCreate(
  () =>
    ({
      innerContainer: {
        flex: 1,
        position: 'relative',
      },
      offline: {padding: Kb.Styles.globalMargins.xxtiny},
      outerContainer: Kb.Styles.platformStyles({
        isTablet: {
          flex: 1,
          position: 'relative',
        },
      }),
      sav: {
        flexGrow: 1,
        maxHeight: '100%',
        position: 'relative',
      },
    }) as const
)

export default Conversation
