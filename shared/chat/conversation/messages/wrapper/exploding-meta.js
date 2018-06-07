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
} from '../../../../common-adapters'
import {castPlatformStyles} from '../../../../common-adapters/icon'
import {
  collapseStyles,
  globalColors,
  globalStyles,
  isMobile,
  platformStyles,
  styleSheetCreate,
} from '../../../../styles'
import {type TickerID, addTicker, removeTicker} from '../../../../util/second-timer'
import {formatDurationShort} from '../../../../util/timestamp'

const oneMinuteInMs = 60 * 1000
const oneHourInMs = oneMinuteInMs * 60
const oneDayInMs = oneHourInMs * 24

type Props = PropsWithTimer<{
  exploded: boolean,
  explodesAt: number,
  onClick: ?() => void,
  pending: boolean,
}>

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
    }
  }

  componentWillUnmount() {
    removeTicker(this.tickerID)
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
      this.setState({mode: 'boom'})
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
        children = (
          <Box2 direction="horizontal" gap="xtiny">
            <Box2
              direction="horizontal"
              style={collapseStyles([
                styles.countdownContainer,
                {
                  backgroundColor,
                },
              ])}
            >
              {this.props.pending ? (
                <ProgressIndicator style={{width: 17, height: 17}} white={true} />
              ) : (
                <Text type="Body" style={{color: globalColors.white, fontSize: 10, fontWeight: 'bold'}}>
                  {formatDurationShort(this.props.explodesAt - Date.now())}
                </Text>
              )}
            </Box2>
            <Icon type="iconfont-bomb" fontSize={isMobile ? 22 : 16} color={globalColors.black_75} />
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
      <ClickableBox onClick={this.props.onClick} style={styles.container}>
        {children}
      </ClickableBox>
    )
  }
}

const getLoopInterval = (diff: number) => {
  let deltaMS
  let nearestUnit
  if (diff > oneDayInMs) {
    nearestUnit = oneDayInMs
  }
  if (diff > oneHourInMs) {
    nearestUnit = oneHourInMs
  }
  if (diff > oneMinuteInMs) {
    nearestUnit = oneMinuteInMs

    // special case for when we're coming on a minute
    if (Math.floor(diff / nearestUnit) === 1) {
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
  container: {
    ...globalStyles.flexBoxRow,
    alignSelf: 'flex-end',
    position: 'relative',
    width: isMobile ? 50 : 40,
    height: isMobile ? 22 : 19,
    marginLeft: isMobile ? 4 : 12,
    marginRight: isMobile ? 8 : 16,
  },
  countdownContainer: {
    borderRadius: 2,
    paddingLeft: 4,
    paddingRight: 4,
  },
})

export default HOCTimers(ExplodingMeta)
