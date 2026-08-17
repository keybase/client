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
import {useConversationCenterActions} from '../center-context'
import {
  useConversationThreadID,
  useConversationThreadToggleSearch,
  useThreadMeta,
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
import {ThreadSearchOverlayContext} from '../thread-search-overlay-context'
import {KeyboardStickyView} from 'react-native-keyboard-controller'
import {useSharedValue} from 'react-native-reanimated'
import {HeaderHeightContext} from '@react-navigation/elements'
import logger from '@/logger'

const Offline = () => {
  const styles = useStyles()
  return (
    <Kb.Banner color="grey" small={true} style={styles.offline}>
      {"Couldn't load all chat messages due to network connectivity. Retrying..."}
    </Kb.Banner>
  )
}

const LoadingLine = () => {
  const conversationIDKey = useConversationThreadID()
  const showLoader = C.Waiting.useAnyWaiting([
    C.waitingKeyChatThreadLoad(conversationIDKey),
    C.waitingKeyChatInboxSyncStarted,
  ])
  return showLoader ? <Kb.LoadingLine /> : null
}

// Keeps the composer out of the column's height arithmetic: it reserves the height it has when empty
// and grows upward over the thread from there, so typing a long message no longer resizes the list.
// The reserve is measured rather than hardcoded because the resting composer is not a fixed height,
// and it tracks the smallest height seen since the last window resize — the composer is empty when a
// conversation opens, so the first measurement is already the right one.
const BottomInput = function BottomInput() {
  const styles = useDesktopStyles()
  const [reserved, setReserved] = React.useState<number | undefined>(undefined)
  const innerRef = React.useRef<Kb.MeasureRef | null>(null)
  React.useLayoutEffect(() => {
    type ElLike = {getBoundingClientRect: () => {height: number}}
    const el = innerRef.current as ElLike | null
    if (!el) {
      return
    }
    const measure = () => {
      const {height} = el.getBoundingClientRect()
      if (height > 0) {
        setReserved(prev => (prev === undefined ? height : Math.min(prev, height)))
      }
    }
    measure()
    const g = globalThis as unknown as {
      ResizeObserver?: new (cb: () => void) => {observe: (t: unknown) => void; disconnect: () => void}
      addEventListener?: (t: string, cb: () => void) => void
      removeEventListener?: (t: string, cb: () => void) => void
    }
    const observer = g.ResizeObserver ? new g.ResizeObserver(measure) : undefined
    observer?.observe(el)
    // A narrower window can leave the composer legitimately taller at rest, so start the minimum over.
    const onResize = () => setReserved(undefined)
    g.addEventListener?.('resize', onResize)
    return () => {
      observer?.disconnect()
      g.removeEventListener?.('resize', onResize)
    }
  }, [])

  return (
    <div style={Kb.Styles.castStyleDesktop(reserved === undefined ? undefined : {height: reserved})}>
      <Kb.Box2
        direction="vertical"
        fullWidth={true}
        ref={innerRef}
        style={reserved === undefined ? styles.inputInFlow : styles.inputAnchored}
      >
        <InputArea />
      </Kb.Box2>
    </div>
  )
}

const DesktopConversation = function DesktopConversation() {
  const desktopStyles = useDesktopStyles()
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
  const {cannotWrite, minWriterRole, offline: threadLoadedOffline} = useThreadMeta(
    C.useShallow(m => ({cannotWrite: m.cannotWrite, minWriterRole: m.minWriterRole, offline: m.offline}))
  )
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
  const {clearCenter} = useConversationCenterActions()
  const onToggleThreadSearch = () => {
    if (showThreadSearch) {
      clearCenter()
    }
    toggleThreadSearch()
  }
  Kb.useHotKey('mod+f', onToggleThreadSearch)

  return (
    <PerfProfiler id="Conversation">
      <div
        className="conversation"
        style={desktopStyles.container}
        onPaste={onPaste}
        key={conversationIDKey}
      >
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
          <BottomInput />
        </Kb.DragAndDrop>
      </div>
    </PerfProfiler>
  )
}

const NativeConversation = function NativeConversation() {
  const styles = useStyles()
  type LayoutEvent = {nativeEvent: {layout: {height: number}}}

  const [maxInputArea, setMaxInputArea] = React.useState(0)
  // measure the fixed-height outer container, not the flex list area: the list
  // shrinks as the input expands, so measuring it makes the expand animation
  // chase a moving target
  const onContentLayout = (e: LayoutEvent) => {
    setMaxInputArea(e.nativeEvent.layout.height)
  }

  const conversationIDKey = useConversationThreadID()
  logger.info(`Conversation: rendering convID: ${conversationIDKey}`)

  const insets = useSafeAreaInsets()
  // the navigator reports the header's real measured height (top inset included); guessing it
  // sizes this box wrong, which drags the composer off the bottom of its screen slot and leaves
  // a gap under the suggestion popup (that popup anchors to the window, not to this box)
  const headerHeight = React.useContext(HeaderHeightContext) ?? insets.top + (Kb.Styles.isTablet ? 115 : 44)
  const windowHeight = useSafeAreaFrame().height
  const height = windowHeight - headerHeight

  const safeStyle = {height, maxHeight: height, minHeight: height}

  const threadLoadedOffline = useThreadMeta(m => m.offline)

  const stickyOffset = React.useMemo(() => ({closed: -insets.bottom, opened: 0}), [insets.bottom])

  // Height of the search bar that overlays the list bottom while searching.
  // Shared with ListArea (extra content padding + jump-button lift).
  const searchOverlayHeight = useSharedValue(0)

  return (
    <PerfProfiler id="Conversation">
      <ThreadSearchOverlayContext value={searchOverlayHeight}>
        <Kb.Box2
          direction="vertical"
          fullWidth={true}
          fullHeight={true}
          style={safeStyle}
          relative={true}
          onLayout={onContentLayout}
        >
          {threadLoadedOffline && <Offline />}
          <Kb.Box2
            direction="vertical"
            flex={1}
            fullWidth={true}
            key={conversationIDKey}
            relative={true}
            style={styles.whiteBackground}
          >
            <ThreadLoadStatus />
            <PinnedMessage />
            <ListArea />
            <LoadingLine />
          </Kb.Box2>
          <KeyboardStickyView offset={stickyOffset}>
            <Kb.Box2 direction="vertical" fullWidth={true} style={styles.whiteBackground}>
              <InvitationToBlock />
              <Banner />
              <MaxInputAreaContext value={maxInputArea}>
                <InputArea />
              </MaxInputAreaContext>
            </Kb.Box2>
          </KeyboardStickyView>
          <PortalHost name="convOverlay" />
        </Kb.Box2>
      </ThreadSearchOverlayContext>
    </PerfProfiler>
  )
}

const useDesktopStyles = Kb.Styles.createStyleHook(
  theme =>
    ({
      container: {
        ...Kb.Styles.globalStyles.flexBoxColumn,
        flex: 1,
        position: 'relative',
      },
      // Anchored to the bottom of the reserve its wrapper holds open, so extra lines extend upward
      // over the thread instead of pushing the list shorter. Opaque so messages don't show through.
      inputAnchored: {
        backgroundColor: theme.white,
        bottom: 0,
        left: 0,
        position: 'absolute' as const,
        right: 0,
      },
      // Only until the first measurement lands, so the wrapper has something to measure.
      inputInFlow: {},
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

const useStyles = Kb.Styles.createStyleHook(
  theme =>
    ({
      offline: {padding: Kb.Styles.globalMargins.xxtiny},
      whiteBackground: {backgroundColor: theme.white},
    }) as const
)

export default isMobile ? NativeConversation : DesktopConversation
