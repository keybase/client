import * as C from '@/constants'
import {PortalHost} from '@/common-adapters/portal.native'
import * as Kb from '@/common-adapters'
import * as React from 'react'
import {useSafeAreaInsets} from 'react-native-safe-area-context'
import DropView, {type DropItems} from '@/common-adapters/drop-view.native'
import Banner from '../bottom-banner/container'
import InputArea from '../input-area/container'
import InvitationToBlock from '@/chat/blocking/invitation-to-block'
import ListArea from '../list-area'
import PinnedMessage from '../pinned-message/container'
import ThreadLoadStatus from '../load-status'
import type {LayoutEvent} from '@/common-adapters/box'
import {MaxInputAreaContext} from '../input-area/normal/max-input-area-context'
import {useWindowDimensions} from 'react-native'
import logger from '@/logger'

const Offline = () => (
  <Kb.Banner color="grey" small={true} style={styles.offline}>
    Couldn't load all chat messages due to network connectivity. Retrying...
  </Kb.Banner>
)

const LoadingLine = () => {
  const conversationIDKey = C.useChatContext(s => s.id)
  const showLoader = C.Waiting.useAnyWaiting([
    C.Chat.waitingKeyThreadLoad(conversationIDKey),
    C.Chat.waitingKeyInboxSyncStarted,
  ])
  return showLoader ? <Kb.LoadingLine /> : null
}

const Conversation = React.memo(function Conversation() {
  const [maxInputArea, setMaxInputArea] = React.useState(0)
  const onLayout = React.useCallback((e: LayoutEvent) => {
    setMaxInputArea(e.nativeEvent.layout.height)
  }, [])

  const conversationIDKey = C.useChatContext(s => s.id)
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

  const navigateAppend = C.Chat.useChatNavigateAppend()
  const injectIntoInput = C.useChatContext(s => s.dispatch.injectIntoInput)
  const onDropped = React.useCallback(
    (items: DropItems) => {
      const {attach: _attach, texts} = items.reduce(
        (obj, i) => {
          const {texts, attach} = obj
          if (i.content) {
            texts.push(i.content)
          } else if (i.originalPath) {
            attach.push({path: i.originalPath})
          }
          return obj
        },
        {attach: new Array<{path: string}>(), texts: new Array<string>()}
      )
      let attach = _attach

      // special case of one text and attachment, if its not a url
      if (texts.length === 1 && attach.length === 1) {
        if (texts[0]!.startsWith('http')) {
          // just use the url and ignore the image
          attach = []
        } else {
          navigateAppend(conversationIDKey => ({
            props: {conversationIDKey, pathAndOutboxIDs: attach, titles: texts},
            selected: 'chatAttachmentGetTitles',
          }))
          return
        }
      }
      if (texts.length) {
        injectIntoInput(texts.join('\r'))
      }

      if (attach.length) {
        navigateAppend(conversationIDKey => ({
          props: {conversationIDKey, pathAndOutboxIDs: attach},
          selected: 'chatAttachmentGetTitles',
        }))
      }
    },
    [injectIntoInput, navigateAppend]
  )

  const insets = useSafeAreaInsets()
  const headerHeight = Kb.Styles.isTablet ? 115 : 44
  const windowHeight = useWindowDimensions().height
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

  const threadLoadedOffline = C.useChatContext(s => s.meta.offline)

  const content = (
    <Kb.Box2 direction="vertical" style={styles.innerContainer} fullWidth={true} fullHeight={true}>
      <DropView style={styles.dropView} onDropped={onDropped}>
        <Kb.Box2 direction="vertical" fullWidth={true} fullHeight={true}>
          {threadLoadedOffline && <Offline />}
          {innerComponent}
        </Kb.Box2>
        <PortalHost name="convOverlay" />
      </DropView>
    </Kb.Box2>
  )

  return Kb.Styles.isAndroid ? (
    <Kb.Box2 direction="vertical" fullWidth={true} fullHeight={true} style={safeStyle}>
      {content}
    </Kb.Box2>
  ) : (
    <Kb.Box2 direction="vertical" fullWidth={true} fullHeight={true} style={safeStyle}>
      <Kb.KeyboardAvoidingView2 extraPadding={Kb.Styles.isTablet ? -65 : -insets.bottom}>
        {content}
      </Kb.KeyboardAvoidingView2>
    </Kb.Box2>
  )
})

const styles = Kb.Styles.styleSheetCreate(
  () =>
    ({
      dropView: {flexGrow: 1},
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
