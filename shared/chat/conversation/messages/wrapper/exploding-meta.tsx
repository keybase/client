import * as C from '@/constants'
import * as React from 'react'
import {HighlightedContext, OrdinalContext} from '../ids-context'
import * as Kb from '@/common-adapters'
import {addTicker, removeTicker, type TickerID} from '@/util/second-timer'
import {formatDurationShort} from '@/util/timestamp'
import SharedTimer, {type SharedTimerID} from '@/util/shared-timers'
import {animationDuration} from './exploding-height-retainer'

export type OwnProps = {onClick?: () => void}

const ExplodingMetaContainer = React.memo(function ExplodingMetaContainer(p: OwnProps) {
  const {onClick} = p
  const ordinal = React.useContext(OrdinalContext)

  const {exploding, exploded, submitState, explodesAt, messageKey} = C.useChatContext(
    C.useShallow(s => {
      const message = s.messageMap.get(ordinal)
      if (!message || (message.type !== 'text' && message.type !== 'attachment') || !message.exploding) {
        return {
          exploded: false,
          explodesAt: 0,
          exploding: false,
          messageKey: '',
          submitState: '',
        }
      }
      const messageKey = C.Chat.getMessageKey(message)
      const {exploding, exploded, submitState, explodingTime: explodesAt} = message
      return {
        exploded,
        explodesAt,
        exploding,
        messageKey,
        submitState,
      }
    })
  )
  const pending = submitState === 'pending' || submitState === 'failed'

  const lastMessageKeyRef = React.useRef(messageKey)
  const [mode, setMode] = React.useState<Mode>('none')

  React.useEffect(() => {
    if (messageKey !== lastMessageKeyRef.current) {
      lastMessageKeyRef.current = messageKey
      setMode('none')
    }
  }, [messageKey])

  const tickerIDRef = React.useRef<TickerID>(0)
  const sharedTimerIDRef = React.useRef<SharedTimerID>(0)
  const forceUpdateIDRef = React.useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const sharedTimerKeyRef = React.useRef('')
  const isParentHighlighted = React.useContext(HighlightedContext)

  const [_force, setforce] = React.useState(0)
  const forceUpdate = React.useCallback(() => {
    setforce(f => f + 1)
  }, [])

  const _secondLoop = React.useCallback(() => {
    const difference = explodesAt - Date.now()
    if (difference <= 0 || exploded) {
      if (mode === 'countdown') {
        setMode('boom')
      }
      tickerIDRef.current && removeTicker(tickerIDRef.current)
      return
    }
    forceUpdate()
  }, [exploded, explodesAt, forceUpdate, mode, setMode, tickerIDRef])

  const updateLoopRef = React.useRef<() => void>(() => {})
  const updateLoop = React.useCallback(() => {
    if (pending) {
      return
    }

    const difference = explodesAt - Date.now()
    if (difference <= 0 || exploded) {
      setMode('boom')
      return
    }
    // we don't need a timer longer than 60000 (android complains also)
    const interval = Math.min(getLoopInterval(difference), 60000)
    if (interval < 1000) {
      tickerIDRef.current && removeTicker(tickerIDRef.current)
      // switch to 'seconds' mode
      tickerIDRef.current = addTicker(_secondLoop)
      return
    }
    forceUpdateIDRef.current = setTimeout(() => {
      forceUpdate()
      updateLoopRef.current()
    }, interval)
  }, [_secondLoop, exploded, explodesAt, forceUpdate, forceUpdateIDRef, pending, setMode, tickerIDRef])
  updateLoopRef.current = updateLoop

  const _setHidden = React.useCallback(() => {
    mode !== 'hidden' && setMode('hidden')
  }, [mode, setMode])

  const _setCountdown = React.useCallback(() => {
    if (mode === 'countdown') return
    setMode('countdown')
    updateLoop()
  }, [mode, setMode, updateLoop])

  const hideOrStart = React.useCallback(() => {
    if (mode === 'none' && !pending && (Date.now() >= explodesAt || exploded)) {
      _setHidden()
      return
    }
    !pending && _setCountdown()
  }, [_setCountdown, _setHidden, exploded, explodesAt, mode, pending])

  React.useEffect(() => {
    hideOrStart()
  }, [hideOrStart])

  const lastPendingRef = React.useRef(pending)
  React.useEffect(() => {
    if (!pending && lastPendingRef.current) {
      hideOrStart()
    }
    lastPendingRef.current = pending
  }, [hideOrStart, pending])

  const lastExplodedRef = React.useRef(exploded)
  React.useEffect(() => {
    if (exploded && !lastExplodedRef.current) {
      setMode('boom')
      sharedTimerIDRef.current && SharedTimer.removeObserver(messageKey, sharedTimerIDRef.current)
      sharedTimerKeyRef.current = messageKey
      sharedTimerIDRef.current = SharedTimer.addObserver(() => setMode('hidden'), {
        key: sharedTimerKeyRef.current,
        ms: animationDuration,
      })
    }
    lastExplodedRef.current = exploded

    return () => {
      tickerIDRef.current && removeTicker(tickerIDRef.current)
      sharedTimerIDRef.current &&
        SharedTimer.removeObserver(sharedTimerKeyRef.current, sharedTimerIDRef.current)
      forceUpdateIDRef.current && clearTimeout(forceUpdateIDRef.current)
    }
  }, [exploded, forceUpdateIDRef, messageKey, setMode, sharedTimerIDRef, sharedTimerKeyRef, tickerIDRef])

  const [now] = React.useState(() => Date.now())
  const backgroundColor = pending
    ? Kb.Styles.globalColors.black
    : explodesAt - now < oneMinuteInMs
      ? Kb.Styles.globalColors.red
      : Kb.Styles.globalColors.black
  let children: React.ReactNode
  const m = pending ? 'countdown' : mode
  switch (m) {
    case 'countdown':
      children = (
        <Kb.Box2 direction="horizontal" gap="xtiny">
          <Kb.Box2
            className={Kb.Styles.classNames('explodingTimeContainer', 'tooltip-top-left')}
            direction="horizontal"
            tooltip="Exploding message"
            style={Kb.Styles.collapseStyles([
              styles.countdownContainer,
              {backgroundColor},
              isParentHighlighted && styles.countdownContainerHighlighted,
              pending && styles.hidden,
            ])}
          >
            <Kb.Text
              className="explodingTimeText"
              type="Body"
              style={Kb.Styles.collapseStyles([
                styles.countdown,
                isParentHighlighted && styles.countdownHighlighted,
              ])}
              virtualText={true}
            >
              {pending ? '' : formatDurationShort(explodesAt - now)}
            </Kb.Text>
          </Kb.Box2>
        </Kb.Box2>
      )
      break
    case 'boom':
      children = (
        <Kb.Icon
          className="explodingTimeIcon"
          type="iconfont-boom"
          color={isParentHighlighted ? Kb.Styles.globalColors.blackOrBlack : Kb.Styles.globalColors.black}
        />
      )
      break
    default:
  }

  if (!exploding) {
    return null
  }

  return (
    <Kb.ClickableBox onClick={onClick} style={styles.container}>
      {children}
    </Kb.ClickableBox>
  )
})

const oneMinuteInMs = 60 * 1000
const oneHourInMs = oneMinuteInMs * 60
const oneDayInMs = oneHourInMs * 24

type Mode = 'none' | 'countdown' | 'boom' | 'hidden'

const getLoopInterval = (diff: number) => {
  let nearestUnit: number = 0

  // If diff is less than half a unit away,
  // we need to return the remainder so we
  // update when the unit changes
  const shouldReturnRemainder = (diff: number, nearestUnit: number) => diff - nearestUnit <= nearestUnit / 2

  if (diff > oneDayInMs) {
    nearestUnit = oneDayInMs

    // special case for when we're coming on 1 day
    if (shouldReturnRemainder(diff, nearestUnit)) {
      return diff - nearestUnit
    }
  } else if (diff > oneHourInMs) {
    nearestUnit = oneHourInMs

    // special case for when we're coming on 1 hour
    if (shouldReturnRemainder(diff, nearestUnit)) {
      return diff - nearestUnit
    }
  } else if (diff > oneMinuteInMs) {
    nearestUnit = oneMinuteInMs

    // special case for when we're coming on 1 minute
    if (shouldReturnRemainder(diff, nearestUnit)) {
      return diff - nearestUnit
    }
  }
  if (!nearestUnit) {
    // less than a minute, check every half second
    return 500
  }
  const deltaMS = diff - Math.floor(diff / nearestUnit) * nearestUnit
  const halfNearestUnit = nearestUnit / 2
  if (deltaMS > halfNearestUnit) {
    return deltaMS - halfNearestUnit
  }
  return deltaMS + halfNearestUnit
}

const styles = Kb.Styles.styleSheetCreate(
  () =>
    ({
      container: {
        ...Kb.Styles.globalStyles.flexBoxRow,
        height: 20,
        position: 'relative',
      },
      countdown: Kb.Styles.platformStyles({
        common: {color: Kb.Styles.globalColors.white, fontWeight: 'bold'},
        isElectron: {fontSize: 9, letterSpacing: -0.2, lineHeight: 13},
        isMobile: {fontSize: 9, letterSpacing: -0.2, lineHeight: 13},
      }),
      countdownContainer: {
        alignItems: 'center',
        borderRadius: 10,
        height: 20,
        justifyContent: 'center',
        width: 20,
      },
      countdownContainerHighlighted: {backgroundColor: Kb.Styles.globalColors.blackOrBlack},
      countdownHighlighted: {color: Kb.Styles.globalColors.whiteOrWhite},
      explodingTooltip: {marginRight: -Kb.Styles.globalMargins.xxtiny},
      hidden: {opacity: 0},
      progressContainer: Kb.Styles.platformStyles({
        common: {
          alignItems: 'center',
          justifyContent: 'center',
        },
        isElectron: {width: 28},
        isMobile: {
          height: 15,
          width: 32,
        },
      }),
    }) as const
)

export default ExplodingMetaContainer
