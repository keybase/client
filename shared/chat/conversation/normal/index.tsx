import * as C from '@/constants'
import * as Kb from '@/common-adapters'
import * as React from 'react'
import {PerfProfiler} from '@/perf/react-profiler'
import Banner from '../bottom-banner'
import InputArea from '../input-area/container'
import InvitationToBlock from '@/chat/blocking/invitation-to-block'
import ListArea from '../list-area'
import PinnedMessage from '../pinned-message'
import ThreadLoadStatus from '../load-status'
import {useConversationCenter} from '../center-context'
import {
  useConversationThreadID,
  useConversationThreadSelector,
  useConversationThreadToggleSearch,
} from '../thread-context'
import {useThreadSearchRoute} from '../thread-search-route'
import {indefiniteArticle} from '@/util/string'
import {makePasteAttachment} from '../attachment-actions'
import {readImageFromClipboard} from '@/util/clipboard.desktop'
import ThreadSearch from '../search'
import '../conversation.css'
import {PortalHost} from '@/common-adapters/portal.native'
import {useSafeAreaInsets, useSafeAreaFrame} from 'react-native-safe-area-context'
import {MaxInputAreaContext} from '../input-area/normal/max-input-area-context'
import {KeyboardStickyView} from 'react-native-keyboard-controller'
import logger from '@/logger'

const Offline = () => (
  <Kb.Banner color="grey" small={true} style={styles.offline}>
    {"Couldn't load all chat messages due to network connectivity. Retrying..."}
  </Kb.Banner>
)

const LoadingLine = () => {
  const conversationIDKey = useConversationThreadID()
  const showLoader = C.Waiting.useAnyWaiting([
    C.waitingKeyChatThreadLoad(conversationIDKey),
    C.waitingKeyChatInboxSyncStarted,
  ])
  return showLoader ? <Kb.LoadingLine /> : null
}

const DesktopConversation = function DesktopConversation() {
  const conversationIDKey = useConversationThreadID()
  const navigateAppend = C.Router2.navigateAppend
  const onAttach = (paths: Array<string>) => {
    const pathAndOutboxIDs = paths.map(p => ({path: p}))
    navigateAppend({
      name: 'chatAttachmentGetTitles',
      params: {conversationIDKey, pathAndOutboxIDs},
    })
  }
  const showThreadSearch = !!useThreadSearchRoute()
  const meta = useConversationThreadSelector(s => s.meta)
  const {cannotWrite, minWriterRole} = meta
  const threadLoadedOffline = meta.offline
  const dragAndDropRejectReason = cannotWrite
    ? `You must be at least ${indefiniteArticle(minWriterRole)} ${minWriterRole} to post.`
    : undefined
  const onPaste = (e: React.SyntheticEvent) => {
    readImageFromClipboard(e)
      .then(clipboardData => {
        if (clipboardData) {
          makePasteAttachment(conversationIDKey, clipboardData)
        }
      })
      .catch(() => {})
  }
  const toggleThreadSearch = useConversationThreadToggleSearch()
  const {clearCenter} = useConversationCenter()
  const onToggleThreadSearch = () => {
    if (showThreadSearch) {
      clearCenter()
    }
    toggleThreadSearch()
  }
  Kb.useHotKey('mod+f', onToggleThreadSearch)

  return (
    <div className="conversation" style={desktopStyles.container} onPaste={onPaste} key={conversationIDKey}>
      <Kb.DragAndDrop
        onAttach={cannotWrite ? undefined : onAttach}
        fullHeight={true}
        fullWidth={true}
        rejectReason={dragAndDropRejectReason}
      >
        {threadLoadedOffline && <Offline />}
        <Kb.Box2 direction="vertical" fullWidth={true} fullHeight={true} flex={1} relative={true}>
          <ListArea />
          <Kb.Box2 direction="vertical" fullWidth={true} style={desktopStyles.overlayTop}>
            <ThreadLoadStatus />
            {!showThreadSearch && <PinnedMessage />}
          </Kb.Box2>
          {showThreadSearch && <ThreadSearch style={desktopStyles.threadSearchStyle} />}
          <LoadingLine />
        </Kb.Box2>
        <InvitationToBlock />
        <Banner />
        <InputArea />
      </Kb.DragAndDrop>
    </div>
  )
}

const DesktopConversationWithProfiler = () => (
  <PerfProfiler id="Conversation">
    <DesktopConversation />
  </PerfProfiler>
)

const NativeConversation = function NativeConversation() {
  type LayoutEvent = {nativeEvent: {layout: {height: number}}}

  const [maxInputArea, setMaxInputArea] = React.useState(0)
  const onContentLayout = (e: LayoutEvent) => {
    setMaxInputArea(e.nativeEvent.layout.height)
  }

  const conversationIDKey = useConversationThreadID()
  logger.info(`Conversation: rendering convID: ${conversationIDKey}`)

  const insets = useSafeAreaInsets()
  const headerHeight = Kb.Styles.isTablet ? 115 : 44
  const windowHeight = useSafeAreaFrame().height
  const height = windowHeight - insets.top - headerHeight

  const safeStyle = {height, maxHeight: height, minHeight: height}

  const threadLoadedOffline = useConversationThreadSelector(s => s.meta.offline)

  const stickyOffset = React.useMemo(() => ({closed: -insets.bottom, opened: 0}), [insets.bottom])

  return (
    <PerfProfiler id="Conversation">
      <Kb.Box2 direction="vertical" fullWidth={true} fullHeight={true} style={safeStyle} relative={true}>
        {threadLoadedOffline && <Offline />}
        <Kb.Box2
          direction="vertical"
          flex={1}
          fullWidth={true}
          key={conversationIDKey}
          onLayout={onContentLayout}
          relative={true}
          style={styles.listContainer}
        >
          <ThreadLoadStatus />
          <PinnedMessage />
          <ListArea />
          <LoadingLine />
        </Kb.Box2>
        <KeyboardStickyView offset={stickyOffset}>
          <Kb.Box2 direction="vertical" fullWidth={true} style={styles.inputContainer}>
            <InvitationToBlock />
            <Banner />
            <MaxInputAreaContext value={maxInputArea}>
              <InputArea />
            </MaxInputAreaContext>
          </Kb.Box2>
        </KeyboardStickyView>
        <PortalHost name="convOverlay" />
      </Kb.Box2>
    </PerfProfiler>
  )
}

const desktopStyles = Kb.Styles.styleSheetCreate(
  () =>
    ({
      container: {
        ...Kb.Styles.globalStyles.flexBoxColumn,
        flex: 1,
        position: 'relative',
      },
      offline: {
        padding: Kb.Styles.globalMargins.xxtiny,
      },
      overlayTop: {
        left: 0,
        position: 'absolute' as const,
        top: 0,
      },
      threadSearchStyle: {
        position: 'absolute' as const,
        top: 0,
      },
    }) as const
)

const styles = Kb.Styles.styleSheetCreate(
  () =>
    ({
      inputContainer: {
        backgroundColor: Kb.Styles.globalColors.white,
      },
      listContainer: {backgroundColor: Kb.Styles.globalColors.white},
      offline: {padding: Kb.Styles.globalMargins.xxtiny},
    }) as const
)

export default isMobile ? NativeConversation : DesktopConversationWithProfiler
