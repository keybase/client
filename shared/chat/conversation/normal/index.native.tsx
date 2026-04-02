import * as C from '@/constants'
import * as Chat from '@/stores/chat'
import {PortalHost} from '@/common-adapters/portal.native'
import * as Kb from '@/common-adapters'
import * as React from 'react'
import {useSafeAreaInsets} from 'react-native-safe-area-context'
import {KeyboardStickyView} from 'react-native-keyboard-controller'
import Banner from '../bottom-banner'
import InputArea from '../input-area/container'
import InvitationToBlock from '@/chat/blocking/invitation-to-block'
import ListArea from '../list-area'
import PinnedMessage from '../pinned-message'
import ThreadLoadStatus from '../load-status'
import type {LayoutEvent} from '@/common-adapters/box'
import {MaxInputAreaContext} from '../input-area/normal/max-input-area-context'
import {PerfProfiler} from '@/perf/react-profiler'
import logger from '@/logger'

const Offline = () => (
  <Kb.Banner color="grey" small={true} style={styles.offline}>
    {"Couldn't load all chat messages due to network connectivity. Retrying..."}
  </Kb.Banner>
)

const Conversation = function Conversation() {
  const [maxInputArea, setMaxInputArea] = React.useState(0)
  const onLayout = (e: LayoutEvent) => {
    setMaxInputArea(e.nativeEvent.layout.height)
  }

  const conversationIDKey = Chat.useChatContext(s => s.id)
  logger.info(`Conversation: rendering convID: ${conversationIDKey}`)

  const insets = useSafeAreaInsets()

  const showLoader = C.Waiting.useAnyWaiting([
    C.waitingKeyChatThreadLoad(conversationIDKey),
    C.waitingKeyChatInboxSyncStarted,
  ])
  const loadingLine = showLoader ? <Kb.LoadingLine /> : null
  const offline = Chat.useChatContext(s => s.meta.offline) ? <Offline /> : null

  return (
    <PerfProfiler id="Conversation">
      <Kb.Box2
        direction="vertical"
        flex={1}
        fullWidth={true}
        fullHeight={true}
        key={conversationIDKey}
        relative={true}
        style={{paddingBottom: insets.bottom}}
      >
        {offline}
        <Kb.Box2 direction="vertical" fullWidth={true} flex={1} onLayout={onLayout}>
          <ThreadLoadStatus />
          <PinnedMessage />
          <ListArea />
          {loadingLine}
          <KeyboardStickyView offset={{closed: 0, opened: insets.bottom}}>
            <InvitationToBlock />
            <Banner />
            <MaxInputAreaContext value={maxInputArea}>
              <InputArea />
            </MaxInputAreaContext>
          </KeyboardStickyView>
        </Kb.Box2>
        <PortalHost name="convOverlay" />
      </Kb.Box2>
    </PerfProfiler>
  )
}

const styles = Kb.Styles.styleSheetCreate(
  () =>
    ({
      offline: {padding: Kb.Styles.globalMargins.xxtiny},
    }) as const
)

export default Conversation
