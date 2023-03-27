import * as Constants from '../../../constants/chat2'
import * as Chat2Gen from '../../../actions/chat2-gen'
import * as RouteTreeGen from '../../../actions/route-tree-gen'
import * as WaitingConstants from '../../../constants/waiting'
import * as Container from '../../../util/container'
import * as Kb from '../../../common-adapters/mobile.native'
import * as React from 'react'
import * as Styles from '../../../styles'
import {useSafeAreaInsets} from 'react-native-safe-area-context'
import DropView, {type DropItems} from '../../../common-adapters/drop-view.native'
import Banner from '../bottom-banner/container'
import InputArea from '../input-area/container'
import InvitationToBlock from '../../blocking/invitation-to-block'
import ListArea from '../list-area'
import PinnedMessage from '../pinned-message/container'
import ThreadLoadStatus from '../load-status/container'
import type * as Types from '../../../constants/types/chat2'
import type {LayoutEvent} from '../../../common-adapters/box'
import type {Props} from '.'
import {MaxInputAreaContext} from '../input-area/normal/max-input-area-context'

const Offline = () => (
  <Kb.Banner color="grey" small={true} style={styles.offline}>
    Couldn't load all chat messages due to network connectivity. Retrying...
  </Kb.Banner>
)

const LoadingLine = (p: {conversationIDKey: Types.ConversationIDKey}) => {
  const {conversationIDKey} = p
  const showLoader = Container.useSelector(state =>
    WaitingConstants.anyWaiting(
      state,
      Constants.waitingKeyThreadLoad(conversationIDKey),
      Constants.waitingKeyInboxSyncStarted
    )
  )
  return showLoader ? <Kb.LoadingLine /> : null
}

const Conversation = React.memo(function Conversation(props: Props) {
  const {conversationIDKey} = props
  const [maxInputArea, setMaxInputArea] = React.useState(0)
  const onLayout = React.useCallback((e: LayoutEvent) => {
    setMaxInputArea(e.nativeEvent.layout.height)
  }, [])

  const innerComponent = (
    <Kb.BoxGrow onLayout={onLayout}>
      <Kb.Box2 direction="vertical" fullWidth={true} style={styles.innerContainer}>
        <ThreadLoadStatus conversationIDKey={conversationIDKey} />
        <PinnedMessage conversationIDKey={conversationIDKey} />
        <ListArea
          requestScrollToBottomRef={props.requestScrollToBottomRef}
          requestScrollDownRef={props.requestScrollDownRef}
          requestScrollUpRef={props.requestScrollUpRef}
          onFocusInput={props.onFocusInput}
          conversationIDKey={conversationIDKey}
        />
        <LoadingLine conversationIDKey={conversationIDKey} />
      </Kb.Box2>
      <InvitationToBlock conversationID={conversationIDKey} />
      <Banner conversationIDKey={conversationIDKey} />
      <MaxInputAreaContext.Provider value={maxInputArea}>
        <InputArea
          focusInputCounter={props.focusInputCounter}
          jumpToRecent={props.jumpToRecent}
          onRequestScrollDown={props.onRequestScrollDown}
          onRequestScrollToBottom={props.onRequestScrollToBottom}
          onRequestScrollUp={props.onRequestScrollUp}
          conversationIDKey={conversationIDKey}
        />
      </MaxInputAreaContext.Provider>
    </Kb.BoxGrow>
  )

  const dispatch = Container.useDispatch()
  const onDropped = React.useCallback(
    (items: DropItems) => {
      const {attach, texts} = items.reduce(
        (obj, i) => {
          const {texts, attach} = obj
          if (i.content) {
            texts.push(i.content)
          } else if (i.originalPath) {
            attach.push({outboxID: null, path: i.originalPath})
          }
          return obj
        },
        {attach: new Array<{outboxID: null; path: string}>(), texts: new Array<string>()}
      )

      if (texts.length) {
        dispatch(
          Chat2Gen.createSetUnsentText({
            conversationIDKey,
            text: new Container.HiddenString(texts.join('\r')),
          })
        )
      }

      if (attach.length) {
        dispatch(
          RouteTreeGen.createNavigateAppend({
            path: [
              {props: {conversationIDKey, pathAndOutboxIDs: attach}, selected: 'chatAttachmentGetTitles'},
            ],
          })
        )
      }
    },
    [dispatch, conversationIDKey]
  )

  const insets = useSafeAreaInsets()
  const headerHeight = 44
  const height = Styles.dimensionHeight - insets.top - headerHeight

  const safeStyle = React.useMemo(
    () =>
      Styles.isAndroid
        ? {paddingBottom: insets.bottom}
        : {
            height,
            maxHeight: height,
            minHeight: height,
            paddingBottom: insets.bottom,
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
        <Kb.PortalHost name="convOverlay" />
      </DropView>
    </Kb.Box2>
  )

  return Styles.isAndroid ? (
    <Kb.Box2 direction="vertical" fullWidth={true} fullHeight={true} style={safeStyle}>
      {content}
    </Kb.Box2>
  ) : (
    <Kb.Box2 direction="vertical" fullWidth={true} fullHeight={true} style={safeStyle}>
      <Kb.KeyboardAvoidingView2 extraPadding={-insets.bottom}>{content}</Kb.KeyboardAvoidingView2>
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
    } as const)
)

export default Conversation
