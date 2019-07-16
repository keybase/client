import * as React from 'react'
import * as Kb from '../../../../../common-adapters'
import * as Styles from '../../../../../styles'
import {TickerID, addTicker, removeTicker} from '../../../../../util/second-timer'
import {formatDurationShort} from '../../../../../util/timestamp'
import SharedTimer, {SharedTimerID} from '../../../../../util/shared-timers'
import {animationDuration} from '../exploding-height-retainer'

const oneMinuteInMs = 60 * 1000
const oneHourInMs = oneMinuteInMs * 60
const oneDayInMs = oneHourInMs * 24

export type _Props = {
  exploded: boolean
  explodesAt: number
  messageKey: string
  onClick?: () => void
  pending: boolean
  style?: Styles.StylesCrossPlatform
}
type Props = Kb.PropsWithTimer<_Props>

interface State {
  readonly mode: 'none' | 'countdown' | 'boom' | 'hidden'
}

class ExplodingMeta extends React.Component<Props, State> {
  state = {mode: 'none'} as State
  tickerID?: TickerID
  sharedTimerID?: SharedTimerID
  sharedTimerKey: string = ''

  componentDidMount() {
    this._hideOrStart()
  }

  componentDidUpdate(prevProps: Props, _: State) {
    if (!this.props.pending && prevProps.pending) {
      this._hideOrStart()
    }

    if (this.props.exploded && !prevProps.exploded) {
      this.setState({mode: 'boom'})
      this.sharedTimerID && SharedTimer.removeObserver(this.props.messageKey, this.sharedTimerID)
      this.sharedTimerKey = this.props.messageKey
      this.sharedTimerID = SharedTimer.addObserver(() => this.setState({mode: 'hidden'}), {
        key: this.sharedTimerKey,
        ms: animationDuration,
      })
    }
  }

  _hideOrStart = () => {
    if (
      this.state.mode === 'none' &&
      !this.props.pending &&
      (Date.now() >= this.props.explodesAt || this.props.exploded)
    ) {
      this._setHidden()
      return
    }
    !this.props.pending && this._setCountdown()
  }

  componentWillUnmount() {
    this.tickerID && removeTicker(this.tickerID)
    this.sharedTimerID && SharedTimer.removeObserver(this.sharedTimerKey, this.sharedTimerID)
  }

  _updateLoop = () => {
    if (this.props.pending) {
      return
    }

    const difference = this.props.explodesAt - Date.now()
    if (difference <= 0 || this.props.exploded) {
      this.setState({mode: 'boom'})
      return
    }
    const interval = getLoopInterval(difference)
    if (interval < 1000) {
      this.tickerID && removeTicker(this.tickerID)
      // switch to 'seconds' mode
      this.tickerID = addTicker(this._secondLoop)
      return
    }
    this.props.setTimeout(() => {
      this.forceUpdate(this._updateLoop)
    }, interval)
  }

  _secondLoop = () => {
    const difference = this.props.explodesAt - Date.now()
    if (difference <= 0 || this.props.exploded) {
      if (this.state.mode === 'countdown') {
        this.setState({mode: 'boom'})
      }
      this.tickerID && removeTicker(this.tickerID)
      return
    }
    this.forceUpdate()
  }

  _setHidden = () => this.state.mode !== 'hidden' && this.setState({mode: 'hidden'})
  _setCountdown = () =>
    this.state.mode !== 'countdown' && this.setState({mode: 'countdown'}, this._updateLoop)

  render() {
    const backgroundColor =
      this.props.explodesAt - Date.now() < oneMinuteInMs ? Styles.globalColors.red : Styles.globalColors.black
    let children: React.ReactNode
    switch (this.state.mode) {
      case 'countdown':
        {
          const stopWatchIconSize = Styles.isMobile ? 16 : 14
          children = (
            <Kb.Box2 direction="horizontal" gap="xtiny">
              {this.props.pending ? (
                <Kb.Box2 direction="horizontal" style={styles.progressContainer}>
                  <Kb.ProgressIndicator style={{height: 12, width: 12}} />
                </Kb.Box2>
              ) : (
                <Kb.Box2
                  direction="horizontal"
                  style={Styles.collapseStyles([
                    styles.countdownContainer,
                    {
                      backgroundColor,
                    },
                  ])}
                >
                  <Kb.Text type="Body" style={styles.countdown}>
                    {formatDurationShort(this.props.explodesAt - Date.now())}
                  </Kb.Text>
                </Kb.Box2>
              )}
              <Kb.Icon type="iconfont-timer" fontSize={stopWatchIconSize} color={Styles.globalColors.black} />
            </Kb.Box2>
          )
        }
        break
      case 'boom':
        children = <Kb.Icon type="iconfont-boom" color={Styles.globalColors.black} />
    }

    if (this.props.pending) {
      // We already have a send indicator for this
      children = null
    }

    return (
      <Kb.ClickableBox
        onClick={this.props.onClick}
        style={Styles.collapseStyles([styles.container, this.props.style])}
      >
        {children}
      </Kb.ClickableBox>
    )
  }
}

export const getLoopInterval = (diff: number) => {
  let deltaMS
  let nearestUnit

  // If diff is less than half a unit away,
  // we need to return the remainder so we
  // update when the unit changes
  const shouldReturnRemainder = (diff, nearestUnit) => diff - nearestUnit <= nearestUnit / 2

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
  deltaMS = diff - Math.floor(diff / nearestUnit) * nearestUnit
  const halfNearestUnit = nearestUnit / 2
  if (deltaMS > halfNearestUnit) {
    return deltaMS - halfNearestUnit
  }
  return deltaMS + halfNearestUnit
}

const styles = Styles.styleSheetCreate({
  container: Styles.platformStyles({
    common: {
      ...Styles.globalStyles.flexBoxRow,
      marginLeft: Styles.globalMargins.tiny,
      position: 'relative',
    },
    isMobile: {height: 21},
  }),
  countdown: Styles.platformStyles({
    common: {color: Styles.globalColors.white, fontWeight: 'bold'},
    isElectron: {fontSize: 10, lineHeight: 14},
    isMobile: {fontSize: 11, lineHeight: 16},
  }),
  countdownContainer: Styles.platformStyles({
    common: {
      alignItems: 'center',
      borderRadius: 2,
      justifyContent: 'center',
      paddingLeft: 2,
      paddingRight: 2,
    },
    isElectron: {
      height: 14,
      width: 28,
    },
    isMobile: {
      height: 16,
      width: 30,
    },
  }),
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
})

export default Kb.HOCTimers(ExplodingMeta)
