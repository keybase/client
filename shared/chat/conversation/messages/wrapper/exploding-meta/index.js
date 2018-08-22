// @flow
import * as React from 'react'
import {
  Box2,
  ClickableBox,
  Text,
  Icon,
  HOCTimers,
  ProgressIndicator,
  type PropsWithTimer,
} from '../../../../../common-adapters'
import {castPlatformStyles} from '../../../../../common-adapters/icon'
import {isAndroid} from '../../../../../constants/platform'
import {
  collapseStyles,
  globalColors,
  globalStyles,
  isMobile,
  platformStyles,
  styleSheetCreate,
  type StylesCrossPlatform,
} from '../../../../../styles'
import {type TickerID, addTicker, removeTicker} from '../../../../../util/second-timer'
import {formatDurationShort} from '../../../../../util/timestamp'
import SharedTimer, {type SharedTimerID} from '../../../../../util/shared-timers'
import {animationDuration} from '../exploding-height-retainer'

const oneMinuteInMs = 60 * 1000
const oneHourInMs = oneMinuteInMs * 60
const oneDayInMs = oneHourInMs * 24

export type _Props = {|
  exploded: boolean,
  explodesAt: number,
  messageKey: string,
  onClick: ?() => void,
  pending: boolean,
  style?: StylesCrossPlatform,
|}
type Props = PropsWithTimer<_Props>

// 'none' is functionally 'unset', used to detect a fresh mount
// and hide self if the message already exploded
type State = {
  mode: 'none' | 'countdown' | 'boom' | 'hidden',
}

class ExplodingMeta extends React.Component<Props, State> {
  state = {
    mode: 'none',
  }
  tickerID: TickerID
  sharedTimerID: SharedTimerID

  componentDidMount() {
    if (this.state.mode === 'none' && (Date.now() >= this.props.explodesAt || this.props.exploded)) {
      this._setHidden()
      return
    }
    this._setCountdown()
  }

  componentDidUpdate(prevProps: Props, prevState: State) {
    if (this.props.exploded && !prevProps.exploded) {
      this.setState({mode: 'boom'})
      SharedTimer.removeObserver(this.props.messageKey, this.sharedTimerID)
      this.sharedTimerID = SharedTimer.addObserver(() => this.setState({mode: 'hidden'}), {
        key: this.props.messageKey,
        ms: animationDuration,
      })
    }
  }

  componentWillUnmount() {
    removeTicker(this.tickerID)
    SharedTimer.removeObserver(this.props.messageKey, this.sharedTimerID)
  }

  _updateLoop = () => {
    const difference = this.props.explodesAt - Date.now()
    if (difference <= 0 || this.props.exploded) {
      this.setState({mode: 'boom'})
      return
    }
    const interval = getLoopInterval(difference)
    if (interval < 1000) {
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
      removeTicker(this.tickerID)
      return
    }
    this.forceUpdate()
  }

  _setHidden = () => this.state.mode !== 'hidden' && this.setState({mode: 'hidden'})
  _setCountdown = () =>
    this.state.mode !== 'countdown' && this.setState({mode: 'countdown'}, this._updateLoop)

  render() {
    const backgroundColor =
      this.props.explodesAt - Date.now() < oneMinuteInMs ? globalColors.red : globalColors.black_75
    let children
    switch (this.state.mode) {
      case 'countdown':
        let bombIconSize = isMobile ? 22 : 16
        if (isAndroid) {
          // icon is 24 high and clips edge of container on android. workaround
          bombIconSize = 21
        }
        children = (
          <Box2 direction="horizontal" gap="xtiny">
            {this.props.pending ? (
              <Box2 direction="horizontal" style={styles.progressContainer}>
                <ProgressIndicator style={{height: 12, width: 12}} />
              </Box2>
            ) : (
              <Box2
                direction="horizontal"
                style={collapseStyles([
                  styles.countdownContainer,
                  {
                    backgroundColor,
                  },
                ])}
              >
                <Text type="Body" style={styles.countdown}>
                  {formatDurationShort(this.props.explodesAt - Date.now())}
                </Text>
              </Box2>
            )}
            <Icon type="iconfont-bomb" fontSize={bombIconSize} color={globalColors.black_75} />
          </Box2>
        )
        break
      case 'boom':
        children = (
          <Box2 direction="horizontal">
            <Icon
              type="iconfont-boom"
              style={castPlatformStyles(styles.boomIcon)}
              fontSize={isMobile ? 44 : 35}
              color={globalColors.black_75}
            />
          </Box2>
        )
    }
    return (
      <ClickableBox onClick={this.props.onClick} style={collapseStyles([styles.container, this.props.style])}>
        {children}
      </ClickableBox>
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

const styles = styleSheetCreate({
  boomIcon: platformStyles({
    common: {
      position: 'absolute',
    },
    isElectron: {
      top: -6,
      left: 0,
    },
    isMobile: {
      top: -22,
      left: 0,
    },
  }),
  container: platformStyles({
    common: {
      ...globalStyles.flexBoxRow,
      alignSelf: 'flex-end',
      height: 19,
      position: 'relative',
    },
    isMobile: {
      height: 22,
    },
  }),
  countdown: platformStyles({
    common: {color: globalColors.white, fontWeight: 'bold'},
    isAndroid: {fontSize: 11},
    isElectron: {fontSize: 10, lineHeight: '14px'},
    isIOS: {fontSize: 12},
    isMobile: {lineHeight: 17},
  }),
  countdownContainer: platformStyles({
    common: {
      alignItems: 'center',
      borderRadius: 2,
      justifyContent: 'center',
      paddingLeft: 4,
      paddingRight: 4,
    },
    isElectron: {
      height: 14,
      width: 28,
    },
    isMobile: {
      height: 17,
      width: 32,
    },
  }),
  progressContainer: platformStyles({
    common: {
      alignItems: 'center',
      justifyContent: 'center',
    },
    isElectron: {
      width: 28,
    },
    isMobile: {
      height: 15,
      width: 32,
    },
  }),
})

export default HOCTimers(ExplodingMeta)
