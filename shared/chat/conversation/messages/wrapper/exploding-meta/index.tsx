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

export type Props = {
  exploded: boolean
  explodesAt: number
  isParentHighlighted: boolean
  messageKey: string
  onClick?: () => void
  pending: boolean
  style?: Styles.StylesCrossPlatform
}

interface State {
  readonly mode: 'none' | 'countdown' | 'boom' | 'hidden'
}

class ExplodingMeta extends React.Component<Props, State> {
  state = {mode: 'none'} as State
  tickerID?: TickerID
  sharedTimerID?: SharedTimerID
  forceUpdateID?: ReturnType<typeof setTimeout>
  sharedTimerKey: string = ''

  componentDidMount() {
    this.hideOrStart()
  }

  componentDidUpdate(prevProps: Props, _: State) {
    if (!this.props.pending && prevProps.pending) {
      this.hideOrStart()
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

  private hideOrStart = () => {
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
    this.forceUpdateID && clearTimeout(this.forceUpdateID)
  }

  private updateLoop = () => {
    if (this.props.pending) {
      return
    }

    const difference = this.props.explodesAt - Date.now()
    if (difference <= 0 || this.props.exploded) {
      this.setState({mode: 'boom'})
      return
    }
    // we don't need a timer longer than 60000 (android complains also)
    const interval = Math.min(getLoopInterval(difference), 60000)
    if (interval < 1000) {
      this.tickerID && removeTicker(this.tickerID)
      // switch to 'seconds' mode
      this.tickerID = addTicker(this._secondLoop)
      return
    }
    this.forceUpdateID = setTimeout(() => {
      this.forceUpdate(this.updateLoop)
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
  _setCountdown = () => this.state.mode !== 'countdown' && this.setState({mode: 'countdown'}, this.updateLoop)

  render() {
    const backgroundColor =
      this.props.explodesAt - Date.now() < oneMinuteInMs ? Styles.globalColors.red : Styles.globalColors.black
    let children: React.ReactNode
    switch (this.state.mode) {
      case 'countdown':
        {
          children = (
            <Kb.Box2 direction="horizontal" gap="xtiny">
              {this.props.pending ? (
                <Kb.Box2 direction="horizontal" style={styles.progressContainer}>
                  <Kb.ProgressIndicator style={{height: 12, width: 12}} />
                </Kb.Box2>
              ) : (
                <Kb.WithTooltip toastStyle={styles.explodingTooltip} tooltip="Exploding message">
                  <Kb.Box2
                    className="explodingTimeContainer"
                    direction="horizontal"
                    style={Styles.collapseStyles([
                      styles.countdownContainer,
                      {
                        backgroundColor,
                      },
                      this.props.isParentHighlighted && styles.countdownContainerHighlighted,
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
                      {formatDurationShort(this.props.explodesAt - Date.now())}
                    </Kb.Text>
                  </Kb.Box2>
                </Kb.WithTooltip>
              )}
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
        marginLeft: Styles.globalMargins.tiny,
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
