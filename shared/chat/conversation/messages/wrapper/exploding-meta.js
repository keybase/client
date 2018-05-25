// @flow
import * as React from 'react'
import {Box2, Text, Icon, HOCTimers, type PropsWithTimer} from '../../../../common-adapters'
import {castPlatformStyles} from '../../../../common-adapters/icon'
import {collapseStyles, globalColors, isMobile, platformStyles, styleSheetCreate} from '../../../../styles'
import {formatDurationShort} from '../../../../util/timestamp'

const oneMinuteInMs = 60 * 1000
const oneHourInMs = oneMinuteInMs * 60
const oneDayInMs = oneHourInMs * 24

type Props = PropsWithTimer<{
  exploded: boolean,
  explodesAt: number,
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

  static getDerivedStateFromProps(nextProps: Props, prevState: State) {
    if (prevState.mode === 'none' && Date.now() >= nextProps.explodesAt) {
      return {mode: 'hidden'}
    }
    if (nextProps.exploded && prevState.mode === 'countdown') {
      // got an explode now
      // also helps w/ keeping in sync with ash lines
      return {mode: 'boom'}
    }
    if (prevState.mode !== 'none') {
      // never change away from anything set
      return null
    }
    return {mode: 'countdown'}
  }

  componentDidMount() {
    this.state.mode === 'countdown' && this._updateLoop()
  }

  _updateLoop = () => {
    const difference = this.props.explodesAt - Date.now()
    if (difference <= 0 || this.props.exploded) {
      this.setState({mode: 'boom'})
      return
    }
    const interval = getLoopInterval(difference)
    this.props.setTimeout(() => {
      this.forceUpdate(this._updateLoop)
    }, interval)
  }

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
              <Text type="Body" style={{color: globalColors.white, fontSize: 10, fontWeight: 'bold'}}>
                {formatDurationShort(this.props.explodesAt - Date.now())}
              </Text>
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
      <Box2 direction="horizontal" style={styles.container}>
        {children}
      </Box2>
    )
  }
}

const getLoopInterval = (diff: number) => {
  if (diff > oneDayInMs) {
    return diff - Math.floor(diff / oneDayInMs) * oneDayInMs
  }
  if (diff > oneHourInMs) {
    return diff - Math.floor(diff / oneHourInMs) * oneHourInMs
  }
  if (diff > oneMinuteInMs) {
    return diff - Math.floor(diff / oneMinuteInMs) * oneMinuteInMs
  }
  // less than a minute, check every second
  return 1000
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
    alignSelf: 'flex-end',
    position: 'relative',
    width: isMobile ? 80 : 72,
    height: isMobile ? 22 : 19,
  },
  countdownContainer: {
    borderRadius: 2,
    paddingLeft: 4,
    paddingRight: 4,
  },
})

export default HOCTimers(ExplodingMeta)
