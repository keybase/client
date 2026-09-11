import * as React from 'react'
import {useIsHighlighted} from '../ids-context'
import {produce} from 'immer'
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
    <ExplodingMetaInner {...p} key={`${p.messageKey}:${pending ? 'pending' : 'active'}`} pending={pending} />
  )
}

type ExplodingMetaInnerProps = OwnProps & {pending: boolean}
type Mode = 'none' | 'countdown' | 'boom' | 'hidden'
export type TimerState = {
  exploded: boolean
  explodesAt: number
  inter: number
  mode: Mode
  now: number
}

const isPendingSubmitState = (submitState?: T.Chat.Message['submitState']) =>
  submitState === 'pending' || submitState === 'failed'

const cappedLoopInterval = (difference: number) => Math.min(getLoopInterval(difference), 60000)

type TimerProps = {exploded: boolean; explodesAt: number; pending: boolean}

export const makeInitialTimerState = (p: TimerProps): TimerState => {
  const {exploded, explodesAt} = p
  const now = Date.now()
  if (p.pending) {
    return {exploded, explodesAt, inter: 0, mode: 'none', now}
  }
  const difference = explodesAt - now
  if (difference <= 0 || exploded) {
    return {exploded, explodesAt, inter: 0, mode: 'hidden', now}
  }
  return {exploded, explodesAt, inter: cappedLoopInterval(difference), mode: 'countdown', now}
}

// The service derives explodesAt from its receive time on every unbox, so a reload can move it
// after the row mounted. Measuring the new value against the mount-time now overshoots the fuse,
// which reads a fresh 24h message as 1d.
export const syncTimerState = (s: TimerState, p: TimerProps): TimerState => {
  if (s.exploded !== p.exploded) {
    return produce(s, draft => {
      draft.exploded = p.exploded
      if (p.exploded) {
        draft.inter = 0
        draft.mode = 'boom'
      }
    })
  }
  if (s.explodesAt !== p.explodesAt && !p.exploded && s.mode !== 'boom') {
    return makeInitialTimerState(p)
  }
  return s
}

function ExplodingMetaInner(p: ExplodingMetaInnerProps) {
  const styles = useStyles()
  const theme = Kb.Styles.useTheme()
  const {exploded, exploding, explodesAt, messageKey, onClick, pending} = p
  const [timerState, setTimerState] = React.useState<TimerState>(() =>
    makeInitialTimerState({exploded, explodesAt, pending})
  )

  const currentTimerState = syncTimerState(timerState, {exploded, explodesAt, pending})
  if (currentTimerState !== timerState) {
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
        setTimerState(
          produce(draft => {
            if ((difference <= 0 || exploded) && draft.mode === 'countdown') {
              draft.mode = 'boom'
            }
            draft.now = n
          })
        )
      })
      return () => {
        removeTicker(id)
      }
    } else {
      const id = setTimeout(() => {
        const n = Date.now()
        if (pending) {
          setTimerState(
            produce(draft => {
              draft.inter = 0
              draft.now = n
            })
          )
          return
        }
        const difference = explodesAt - n
        if (difference <= 0 || exploded) {
          setTimerState(
            produce(draft => {
              draft.inter = 0
              draft.mode = 'boom'
              draft.now = n
            })
          )
          return
        }
        // we don't need a timer longer than 60000 (android complains also)
        setTimerState(
          produce(draft => {
            draft.inter = cappedLoopInterval(difference)
            draft.now = n
          })
        )
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
    if (sharedTimerIDRef.current) {
      SharedTimer.removeObserver(messageKey, sharedTimerIDRef.current)
    }
    sharedTimerKeyRef.current = messageKey
    sharedTimerIDRef.current = SharedTimer.addObserver(
      () =>
        setTimerState(
          produce(draft => {
            draft.mode = 'hidden'
          })
        ),
      {
        key: sharedTimerKeyRef.current,
        ms: animationDuration,
      }
    )

    return () => {
      if (sharedTimerIDRef.current) {
        SharedTimer.removeObserver(sharedTimerKeyRef.current, sharedTimerIDRef.current)
      }
    }
  }, [exploded, messageKey, mode])

  const backgroundColor = pending
    ? theme.black
    : explodesAt - now < oneMinuteInMs
      ? theme.red
      : theme.black
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
          color={isParentHighlighted ? theme.blackOrBlack : theme.black}
        />
      )
      break
    default:
  }

  if (!exploding) {
    return null
  }

  return (
    <Kb.ClickableBox direction="horizontal" relative={true} onClick={onClick} style={styles.container}>
      {children}
    </Kb.ClickableBox>
  )
}

const oneMinuteInMs = 60 * 1000
const oneHourInMs = oneMinuteInMs * 60
const oneDayInMs = oneHourInMs * 24

// formatDurationShort rounds up, so the display drops a unit exactly when the time left
// reaches a whole multiple of it; wake then
export const getLoopInterval = (diff: number) => {
  const unit = diff > oneDayInMs ? oneDayInMs : diff > oneHourInMs ? oneHourInMs : diff > oneMinuteInMs ? oneMinuteInMs : 0
  if (!unit) {
    // less than a minute, check every half second
    return 500
  }
  // under a second the effect switches to the per-second ticker, which never recomputes the
  // interval, so a timer landing just past a boundary would tick every second from then on
  return Math.max(diff % unit || unit, 1000)
}

const useStyles = Kb.Styles.createStyleHook(
  theme =>
    ({
      container: {
        height: 20,
      },
      countdown: Kb.Styles.platformStyles({
        common: {color: theme.white, fontWeight: 'bold'},
        isElectron: {fontSize: 9, letterSpacing: -0.2, lineHeight: 13},
        isMobile: {fontSize: 9, letterSpacing: -0.2, lineHeight: 13},
      }),
      countdownContainer: {
        ...Kb.Styles.centered(),
        ...Kb.Styles.size(20),
        borderRadius: 10,
      },
      countdownContainerHighlighted: {backgroundColor: theme.blackOrBlack},
      countdownHighlighted: {color: theme.whiteOrWhite},
      hidden: {opacity: 0},
    }) as const
)

export default ExplodingMetaContainer
