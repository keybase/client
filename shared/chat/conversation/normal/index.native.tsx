import * as C from '../../../constants'
import * as Constants from '../../../constants/chat2'
import * as Container from '../../../util/container'
import * as Kb from '../../../common-adapters'
import * as KbMobile from '../../../common-adapters/mobile.native'
import * as React from 'react'
import * as Styles from '../../../styles'
import {useSafeAreaInsets} from 'react-native-safe-area-context'
import DropView, {type DropItems} from '../../../common-adapters/drop-view.native'
import Banner from '../bottom-banner/container'
import InputArea from '../input-area/container'
import InvitationToBlock from '../../blocking/invitation-to-block'
import ListArea from '../list-area'
import PinnedMessage from '../pinned-message/container'
import ThreadLoadStatus from '../load-status'
import type {LayoutEvent} from '../../../common-adapters/box'
import type {Props} from '.'
import {MaxInputAreaContext} from '../input-area/normal/max-input-area-context'
import {Dimensions} from 'react-native'

const Offline = () => (
  <Kb.Banner color="grey" small={true} style={styles.offline}>
    Couldn't load all chat messages due to network connectivity. Retrying...
  </Kb.Banner>
)

const LoadingLine = () => {
  const conversationIDKey = C.useChatContext(s => s.id)
  const showLoader = Container.useAnyWaiting([
    Constants.waitingKeyThreadLoad(conversationIDKey),
    Constants.waitingKeyInboxSyncStarted,
  ])
  return showLoader ? <Kb.LoadingLine /> : null
}

const Conversation = React.memo(function Conversation(props: Props) {
  const [maxInputArea, setMaxInputArea] = React.useState(0)
  const onLayout = React.useCallback((e: LayoutEvent) => {
    setMaxInputArea(e.nativeEvent.layout.height)
  }, [])

  const innerComponent = (
    <Kb.BoxGrow onLayout={onLayout}>
      <Kb.Box2 direction="vertical" fullWidth={true} style={styles.innerContainer}>
        <ThreadLoadStatus />
        <PinnedMessage />
        <ListArea
          requestScrollToBottomRef={props.requestScrollToBottomRef}
          requestScrollDownRef={props.requestScrollDownRef}
          requestScrollUpRef={props.requestScrollUpRef}
          onFocusInput={props.onFocusInput}
        />
        <LoadingLine />
      </Kb.Box2>
      <InvitationToBlock />
      <Banner />
      <MaxInputAreaContext.Provider value={maxInputArea}>
        <InputArea
          focusInputCounter={props.focusInputCounter}
          jumpToRecent={props.jumpToRecent}
          onRequestScrollDown={props.onRequestScrollDown}
          onRequestScrollToBottom={props.onRequestScrollToBottom}
          onRequestScrollUp={props.onRequestScrollUp}
        />
      </MaxInputAreaContext.Provider>
    </Kb.BoxGrow>
  )

  const navigateAppend = C.useChatNavigateAppend()
  const injectIntoInput = C.useChatContext(s => s.dispatch.injectIntoInput)
  const onDropped = React.useCallback(
    (items: DropItems) => {
      let {attach, texts} = items.reduce(
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
  const headerHeight = Styles.isTablet ? 115 : 44
  const height = Dimensions.get('window').height - insets.top - headerHeight

  const safeStyle = React.useMemo(
    () =>
      Styles.isAndroid
        ? {paddingBottom: insets.bottom}
        : {
            height,
            maxHeight: height,
            minHeight: height,
            paddingBottom: Styles.isTablet ? 0 : insets.bottom,
          },
    [height, insets.bottom]
  )

  const content = (
    <Kb.Box2 direction="vertical" style={styles.innerContainer} fullWidth={true} fullHeight={true}>
      <DropView style={styles.dropView} onDropped={onDropped}>
        <Kb.Box2 direction="vertical" fullWidth={true} fullHeight={true}>
          {props.threadLoadedOffline && <Offline />}
          {innerComponent}
        </Kb.Box2>
        <KbMobile.PortalHost name="convOverlay" />
      </DropView>
    </Kb.Box2>
  )

  return Styles.isAndroid ? (
    <Kb.Box2 direction="vertical" fullWidth={true} fullHeight={true} style={safeStyle}>
      {content}
    </Kb.Box2>
  ) : (
    <Kb.Box2 direction="vertical" fullWidth={true} fullHeight={true} style={safeStyle}>
      <Kb.KeyboardAvoidingView2 extraPadding={Styles.isTablet ? -65 : -insets.bottom}>
        {content}
      </Kb.KeyboardAvoidingView2>
    </Kb.Box2>
  )
})

const styles = Styles.styleSheetCreate(
  () =>
    ({
      dropView: {flexGrow: 1},
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
      sav: {
        flexGrow: 1,
        maxHeight: '100%',
        position: 'relative',
      },
    }) as const
)

export default Conversation
