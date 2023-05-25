import * as React from 'react'
import * as Kb from '../../../../../common-adapters'
import * as Styles from '../../../../../styles'
import {addTicker, removeTicker, type TickerID} from '../../../../../util/second-timer'
import {formatDurationShort} from '../../../../../util/timestamp'
import SharedTimer, {type SharedTimerID} from '../../../../../util/shared-timers'
import * as Container from '../../../../../util/container'
import {animationDuration} from '../exploding-height-retainer'
import {HighlightedContext} from '../../ids-context'

const oneMinuteInMs = 60 * 1000
const oneHourInMs = oneMinuteInMs * 60
const oneDayInMs = oneHourInMs * 24

type Mode = 'none' | 'countdown' | 'boom' | 'hidden'

type Props = {
  exploded: boolean
  explodesAt: number
  messageKey: string
  onClick?: () => void
  pending: boolean
}

type Props2 = {
  exploded: boolean
  explodesAt: number
  forceUpdateIDRef: React.MutableRefObject<ReturnType<typeof setTimeout> | undefined>
  isParentHighlighted: boolean
  messageKey: string
  mode: Mode
  onClick?: () => void
  pending: boolean
  setMode: (m: Mode) => void
  sharedTimerIDRef: React.MutableRefObject<number>
  sharedTimerKeyRef: React.MutableRefObject<string>
  tickerIDRef: React.MutableRefObject<number>
}

const ExplodingMeta = (p: Props) => {
  const {exploded, explodesAt, messageKey, onClick, pending} = p

  const [mode, setMode] = React.useState<Mode>('none')
  Container.useDepChangeEffect(() => {
    setMode('none')
  }, [messageKey])

  const tickerIDRef = React.useRef<TickerID>(0)
  const sharedTimerIDRef = React.useRef<SharedTimerID>(0)
  const forceUpdateIDRef = React.useRef<ReturnType<typeof setTimeout> | undefined>()
  const sharedTimerKeyRef = React.useRef('')
  const isParentHighlighted = React.useContext(HighlightedContext)

  const props2 = {
    exploded,
    explodesAt,
    forceUpdateIDRef,
    isParentHighlighted,
    messageKey,
    mode,
    onClick,
    pending,
    setMode,
    sharedTimerIDRef,
    sharedTimerKeyRef,
    tickerIDRef,
  }

  return <ExplodingMeta2 {...props2} />
}

class ExplodingMeta2 extends React.Component<Props2> {
  componentDidMount() {
    this.hideOrStart()
  }

  componentDidUpdate(prevProps: Props) {
    if (!this.props.pending && prevProps.pending) {
      this.hideOrStart()
    }

    if (this.props.exploded && !prevProps.exploded) {
      this.props.setMode('boom')
      this.props.sharedTimerIDRef.current &&
        SharedTimer.removeObserver(this.props.messageKey, this.props.sharedTimerIDRef.current)
      this.props.sharedTimerKeyRef.current = this.props.messageKey
      this.props.sharedTimerIDRef.current = SharedTimer.addObserver(() => this.props.setMode('hidden'), {
        key: this.props.sharedTimerKeyRef.current,
        ms: animationDuration,
      })
    }
  }

  private hideOrStart = () => {
    if (
      this.props.mode === 'none' &&
      !this.props.pending &&
      (Date.now() >= this.props.explodesAt || this.props.exploded)
    ) {
      this._setHidden()
      return
    }
    !this.props.pending && this._setCountdown()
  }

  componentWillUnmount() {
    this.props.tickerIDRef.current && removeTicker(this.props.tickerIDRef.current)
    this.props.sharedTimerIDRef.current &&
      SharedTimer.removeObserver(this.props.sharedTimerKeyRef.current, this.props.sharedTimerIDRef.current)
    this.props.forceUpdateIDRef.current && clearTimeout(this.props.forceUpdateIDRef.current)
  }

  private updateLoop = () => {
    if (this.props.pending) {
      return
    }

    const difference = this.props.explodesAt - Date.now()
    if (difference <= 0 || this.props.exploded) {
      this.props.setMode('boom')
      return
    }
    // we don't need a timer longer than 60000 (android complains also)
    const interval = Math.min(getLoopInterval(difference), 60000)
    if (interval < 1000) {
      this.props.tickerIDRef.current && removeTicker(this.props.tickerIDRef.current)
      // switch to 'seconds' mode
      this.props.tickerIDRef.current = addTicker(this._secondLoop)
      return
    }
    this.props.forceUpdateIDRef.current = setTimeout(() => {
      this.forceUpdate(this.updateLoop)
    }, interval)
  }

  _secondLoop = () => {
    const difference = this.props.explodesAt - Date.now()
    if (difference <= 0 || this.props.exploded) {
      if (this.props.mode === 'countdown') {
        this.props.setMode('boom')
      }
      this.props.tickerIDRef.current && removeTicker(this.props.tickerIDRef.current)
      return
    }
    this.forceUpdate()
  }

  _setHidden = () => this.props.mode !== 'hidden' && this.props.setMode('hidden')
  _setCountdown = () => {
    if (this.props.mode === 'countdown') return
    this.props.setMode('countdown')
    this.updateLoop()
  }

  render() {
    const backgroundColor = this.props.pending
      ? Styles.globalColors.black
      : this.props.explodesAt - Date.now() < oneMinuteInMs
      ? Styles.globalColors.red
      : Styles.globalColors.black
    let children: React.ReactNode
    const m = this.props.pending ? 'countdown' : this.props.mode
    switch (m) {
      case 'countdown':
        {
          children = (
            <Kb.Box2 direction="horizontal" gap="xtiny">
              <Kb.WithTooltip toastStyle={styles.explodingTooltip} tooltip="Exploding message">
                <Kb.Box2
                  className="explodingTimeContainer"
                  direction="horizontal"
                  style={Styles.collapseStyles([
                    styles.countdownContainer,
                    {backgroundColor},
                    this.props.isParentHighlighted && styles.countdownContainerHighlighted,
                    this.props.pending && styles.hidden,
                  ])}
                >
                  <Kb.Text
                    className="explodingTimeText"
                    type="Body"
                    style={Styles.collapseStyles([
                      styles.countdown,
                      this.props.isParentHighlighted && styles.countdownHighlighted,
                    ])}
                  >
                    {this.props.pending ? '' : formatDurationShort(this.props.explodesAt - Date.now())}
                  </Kb.Text>
                </Kb.Box2>
              </Kb.WithTooltip>
            </Kb.Box2>
          )
        }
        break
      case 'boom':
        children = (
          <Kb.Icon
            className="explodingTimeIcon"
            type="iconfont-boom"
            color={
              this.props.isParentHighlighted ? Styles.globalColors.blackOrBlack : Styles.globalColors.black
            }
          />
        )
    }

    return (
      <Kb.ClickableBox onClick={this.props.onClick} style={styles.container}>
        {children}
      </Kb.ClickableBox>
    )
  }
}

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

const styles = Styles.styleSheetCreate(
  () =>
    ({
      container: {
        ...Styles.globalStyles.flexBoxRow,
        height: 20,
        position: 'relative',
      },
      countdown: Styles.platformStyles({
        common: {color: Styles.globalColors.white, fontWeight: 'bold'},
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
      countdownContainerHighlighted: {
        backgroundColor: Styles.globalColors.blackOrBlack,
      },
      countdownHighlighted: {
        color: Styles.globalColors.whiteOrWhite,
      },
      explodingTooltip: {
        marginRight: -Styles.globalMargins.xxtiny,
      },
      hidden: {opacity: 0},
      progressContainer: Styles.platformStyles({
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
    } as const)
)

export default ExplodingMeta
