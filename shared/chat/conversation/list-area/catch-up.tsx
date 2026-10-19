import * as Kb from '@/common-adapters'
import * as TestIDs from '@/tests/e2e/shared/test-ids'
import * as React from 'react'
import * as T from '@/constants/types'
import {OrangeLineContext} from '../orange-line-context'
import {useChatThreadRouteParams} from '../thread-search-route'
import {useConversationCenterActions} from '../center-context'

const noOrdinal = T.Chat.numberToOrdinal(0)

// The unreadline arrives as a MessageID and is carried as an Ordinal, which is sound because server
// messages get ordinal === messageID. Centering wants it back as a MessageID.
const orangeLineToMessageID = (ordinal: T.Chat.Ordinal) =>
  T.Chat.numberToMessageID(T.Chat.ordinalToNumber(ordinal))

// Ordinals are monotonic and the orange line is a MessageID coerced to one, so a plain comparison
// tells us the unread boundary is above the viewport even when that message isn't loaded at all.
export const shouldShowCatchUp = (p: {
  dismissedOrdinal: T.Chat.Ordinal
  loaded: boolean
  oldestVisibleOrdinal: T.Chat.Ordinal | undefined
  orangeLineOrdinal: T.Chat.Ordinal
  threadSearchVisible: boolean
}) => {
  const {dismissedOrdinal, loaded, oldestVisibleOrdinal, orangeLineOrdinal, threadSearchVisible} = p
  if (!loaded || threadSearchVisible) {
    return false
  }
  if (oldestVisibleOrdinal === undefined || !T.Chat.ordinalToNumber(orangeLineOrdinal)) {
    return false
  }
  // Dismissal is remembered per orange line, not per visit, so a new boundary re-arms the pill. One
  // set by marking a message unread is on screen as it lands, so it is seen, and dismissed, at once.
  if (dismissedOrdinal === orangeLineOrdinal) {
    return false
  }
  return orangeLineOrdinal < oldestVisibleOrdinal
}

// Seeing the orange line is catching up: once it has been on screen the pill is dismissed for it, so
// the keyboard rising or a scroll carrying it away later does not bring the pill back. The line is
// drawn at the top edge of its row, and a row counts as visible with a sliver on screen, so the line
// counts as seen only with visible rows on both sides of its own: the oldest visible row's top can be
// cut off, and the newest can sit under the composer.
export const orangeLineInView = (p: {
  loaded: boolean
  newestVisibleOrdinal: T.Chat.Ordinal | undefined
  oldestVisibleOrdinal: T.Chat.Ordinal | undefined
  orangeLineOrdinal: T.Chat.Ordinal
}) => {
  const {loaded, newestVisibleOrdinal, oldestVisibleOrdinal, orangeLineOrdinal} = p
  if (!loaded || !T.Chat.ordinalToNumber(orangeLineOrdinal)) {
    return false
  }
  if (oldestVisibleOrdinal === undefined || newestVisibleOrdinal === undefined) {
    return false
  }
  return orangeLineOrdinal > oldestVisibleOrdinal && orangeLineOrdinal < newestVisibleOrdinal
}

// The viewport moves on every scroll frame, so the viewable ordinal lives in a ref and only the
// show/hide answer is state: an unchanged answer bails out of re-rendering the message list.
export const useCatchUp = (p: {loaded: boolean}) => {
  const {loaded} = p
  const orangeLineOrdinal = React.useContext(OrangeLineContext)
  const routeParams = useChatThreadRouteParams()
  const threadSearchVisible = !!routeParams?.threadSearch
  const {centerOnMessage} = useConversationCenterActions()
  const [dismissedOrdinal, setDismissedOrdinal] = React.useState(noOrdinal)
  const [showCatchUp, setShowCatchUp] = React.useState(false)
  const oldestVisibleOrdinalRef = React.useRef<T.Chat.Ordinal | undefined>(undefined)
  const newestVisibleOrdinalRef = React.useRef<T.Chat.Ordinal | undefined>(undefined)

  const recompute = React.useEffectEvent(() => {
    const inView = orangeLineInView({
      loaded,
      newestVisibleOrdinal: newestVisibleOrdinalRef.current,
      oldestVisibleOrdinal: oldestVisibleOrdinalRef.current,
      orangeLineOrdinal,
    })
    if (inView && dismissedOrdinal !== orangeLineOrdinal) {
      setDismissedOrdinal(orangeLineOrdinal)
    }
    setShowCatchUp(
      shouldShowCatchUp({
        dismissedOrdinal: inView ? orangeLineOrdinal : dismissedOrdinal,
        loaded,
        oldestVisibleOrdinal: oldestVisibleOrdinalRef.current,
        orangeLineOrdinal,
        threadSearchVisible,
      })
    )
  })

  React.useEffect(() => {
    recompute()
  }, [dismissedOrdinal, loaded, orangeLineOrdinal, threadSearchVisible])

  // Held in state rather than a useCallback so the identity is stable for the lists, which capture
  // this once inside their own scroll handlers.
  const [onViewableOrdinalsChanged] = React.useState(
    () => (oldestVisibleOrdinal?: T.Chat.Ordinal, newestVisibleOrdinal?: T.Chat.Ordinal) => {
      oldestVisibleOrdinalRef.current = oldestVisibleOrdinal
      newestVisibleOrdinalRef.current = newestVisibleOrdinal
      recompute()
    }
  )

  const onCatchUp = React.useCallback(() => {
    setDismissedOrdinal(orangeLineOrdinal)
    setShowCatchUp(false)
    centerOnMessage(orangeLineToMessageID(orangeLineOrdinal), 'none')
  }, [centerOnMessage, orangeLineOrdinal])

  return {onCatchUp, onViewableOrdinalsChanged, showCatchUp}
}

// Orange to match the unread line itself, so the pill reads as "that line, up there".
export const CatchUp = (p: {onClick: () => void}) => {
  const {onClick} = p
  const styles = useStyles()
  const theme = Kb.Styles.useTheme()
  return (
    <Kb.Box2 direction="vertical" style={styles.container} pointerEvents="box-none">
      <Kb.ClickableBox
        asButton={true}
        direction="horizontal"
        alignItems="center"
        gap="xtiny"
        onClick={onClick}
        style={styles.pill}
        testID={TestIDs.CHAT_CATCH_UP}
      >
        <Kb.Icon type="iconfont-arrow-full-up" color={theme.whiteOrWhite} sizeType="Small" />
        <Kb.Text type="BodySmallSemibold" style={styles.label}>
          Catch up
        </Kb.Text>
      </Kb.ClickableBox>
    </Kb.Box2>
  )
}

const useStyles = Kb.Styles.createStyleHook(
  theme =>
    ({
      container: {
        position: 'absolute',
        right: Kb.Styles.globalMargins.tiny,
        top: Kb.Styles.globalMargins.tiny,
      },
      label: {color: theme.whiteOrWhite},
      pill: {
        backgroundColor: theme.orange,
        borderRadius: 100,
        paddingBottom: Kb.Styles.globalMargins.xtiny,
        paddingLeft: Kb.Styles.globalMargins.tiny,
        paddingRight: Kb.Styles.globalMargins.tiny,
        paddingTop: Kb.Styles.globalMargins.xtiny,
      },
    }) as const
)
