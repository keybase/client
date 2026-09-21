import * as Kb from '@/common-adapters'
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
  // Dismissal is remembered per orange line, not per visit, so marking an older message unread
  // re-arms the pill for the new boundary.
  if (dismissedOrdinal === orangeLineOrdinal) {
    return false
  }
  return orangeLineOrdinal < oldestVisibleOrdinal
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

  const recompute = React.useEffectEvent(() => {
    setShowCatchUp(
      shouldShowCatchUp({
        dismissedOrdinal,
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
    () => (oldestVisibleOrdinal?: T.Chat.Ordinal) => {
      oldestVisibleOrdinalRef.current = oldestVisibleOrdinal
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
