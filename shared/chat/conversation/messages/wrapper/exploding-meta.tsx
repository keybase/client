import * as React from 'react'
import {useIsHighlighted} from '../ids-context'
import * as Kb from '@/common-adapters'
import {addTicker, removeTicker} from '@/util/second-timer'
import {formatDurationShort} from '@/util/timestamp'
import SharedTimer from './shared-timers'
import {animationDuration} from './exploding-height-retainer'
import type * as T from '@/constants/types'

export type OwnProps = {
  exploded: boolean
  exploding: boolean
  explodesAt: number
  messageKey: string
  onClick?: () => void
  submitState?: T.Chat.Message['submitState']
}

function ExplodingMetaContainer(p: OwnProps) {
  const pending = isPendingSubmitState(p.submitState)
  return (
    <ExplodingMetaInner
      {...p}
      key={`${p.messageKey}:${pending ? 'pending' : 'active'}`}
      pending={pending}
    />
  )
}

type ExplodingMetaInnerProps = OwnProps & {pending: boolean}
type Mode = 'none' | 'countdown' | 'boom' | 'hidden'
type TimerState = {
  exploded: boolean
  inter: number
  mode: Mode
  now: number
}

const isPendingSubmitState = (submitState?: T.Chat.Message['submitState']) =>
  submitState === 'pending' || submitState === 'failed'

const cappedLoopInterval = (difference: number) => Math.min(getLoopInterval(difference), 60000)

const makeInitialTimerState = (p: {
  exploded: boolean
  explodesAt: number
  pending: boolean
}): TimerState => {
  const now = Date.now()
  if (p.pending) {
    return {exploded: p.exploded, inter: 0, mode: 'none', now}
  }
  const difference = p.explodesAt - now
  if (difference <= 0 || p.exploded) {
    return {exploded: p.exploded, inter: 0, mode: 'hidden', now}
  }
  return {exploded: p.exploded, inter: cappedLoopInterval(difference), mode: 'countdown', now}
}

function ExplodingMetaInner(p: ExplodingMetaInnerProps) {
  const {exploded, exploding, explodesAt, messageKey, onClick, pending} = p
  const [timerState, setTimerState] = React.useState<TimerState>(() =>
    makeInitialTimerState({exploded, explodesAt, pending})
  )

  let currentTimerState = timerState
  if (timerState.exploded !== exploded) {
    currentTimerState = {
      ...timerState,
      exploded,
      inter: exploded && !timerState.exploded ? 0 : timerState.inter,
      mode: exploded && !timerState.exploded ? 'boom' : timerState.mode,
    }
    setTimerState(currentTimerState)
  }
  const {inter, mode, now} = currentTimerState

  const sharedTimerIDRef = React.useRef(0)
  const sharedTimerKeyRef = React.useRef('')
  const isParentHighlighted = useIsHighlighted()

  React.useEffect(() => {
    if (!inter) return () => {}

    if (inter < 1000) {
      // switch to 'seconds' mode
      const id = addTicker(() => {
        const n = Date.now()
        const difference = explodesAt - n
        setTimerState(state => {
          if (difference <= 0 || exploded) {
            return state.mode === 'countdown' ? {...state, mode: 'boom', now: n} : {...state, now: n}
          }
          return {...state, now: n}
        })
      })
      return () => {
        removeTicker(id)
      }
    } else {
      const id = setTimeout(() => {
        const n = Date.now()
        if (pending) {
          setTimerState(state => ({...state, inter: 0, now: n}))
          return
        }
        const difference = explodesAt - n
        if (difference <= 0 || exploded) {
          setTimerState(state => ({...state, inter: 0, mode: 'boom', now: n}))
          return
        }
        // we don't need a timer longer than 60000 (android complains also)
        setTimerState(state => ({...state, inter: cappedLoopInterval(difference), now: n}))
      }, inter)
      return () => {
        clearTimeout(id)
      }
    }
  }, [inter, explodesAt, exploded, pending])

  React.useEffect(() => {
    if (!exploded || mode !== 'boom') {
      return undefined
    }
    sharedTimerIDRef.current && SharedTimer.removeObserver(messageKey, sharedTimerIDRef.current)
    sharedTimerKeyRef.current = messageKey
    sharedTimerIDRef.current = SharedTimer.addObserver(
      () => setTimerState(state => ({...state, mode: 'hidden'})),
      {
        key: sharedTimerKeyRef.current,
        ms: animationDuration,
      }
    )

    return () => {
      sharedTimerIDRef.current &&
        SharedTimer.removeObserver(sharedTimerKeyRef.current, sharedTimerIDRef.current)
    }
  }, [exploded, messageKey, mode])

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
}

const oneMinuteInMs = 60 * 1000
const oneHourInMs = oneMinuteInMs * 60
const oneDayInMs = oneHourInMs * 24

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
      hidden: {opacity: 0},
    }) as const
)

export default ExplodingMetaContainer
