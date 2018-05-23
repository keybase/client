// @flow
import * as React from 'react'
import {Box2, Text, Icon, HOCTimers, type PropsWithTimer} from '../../../../common-adapters'
// import {} from '../../../../constants/types/chat2'
import {collapseStyles, globalColors, isMobile, styleSheetCreate} from '../../../../styles'

const oneMinuteInMs = 60 * 1000
const oneHourInMs = oneMinuteInMs * 60
const oneDayInMs = oneHourInMs * 24

type Props = PropsWithTimer<{
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
    if (difference <= 0) {
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
    switch (this.state.mode) {
      case 'countdown':
        return (
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
                {formatTimeDifference(this.props.explodesAt - Date.now())}
              </Text>
            </Box2>
            <Icon type="iconfont-bomb" fontSize={isMobile ? 22 : 16} color={globalColors.black_75} />
          </Box2>
        )
      case 'boom':
        return <Icon type="iconfont-boom" fontSize={isMobile ? 44 : 22} color={globalColors.black_75} />
    }
    return null
  }
}

const getLoopInterval = (d: number) => {
  if (d > oneDayInMs) {
    return d - Math.floor(d / oneDayInMs) * oneDayInMs
  }
  if (d > oneHourInMs) {
    return d - Math.floor(d / oneHourInMs) * oneHourInMs
  }
  if (d > oneMinuteInMs) {
    return d - Math.floor(d / oneMinuteInMs) * oneMinuteInMs
  }
  // less than a minute, check every second
  return 1000
}

const formatTimeDifference = (d: number): string => {
  if (d < 0) {
    return 'now'
  }
  if (d > oneDayInMs) {
    return `${Math.floor(d / oneDayInMs)}d`
  }
  if (d > oneHourInMs) {
    return `${Math.floor(d / oneHourInMs)}h`
  }
  if (d > oneMinuteInMs) {
    return `${Math.floor(d / oneMinuteInMs)}m`
  }
  return `${Math.floor(d / 1000)}s`
}

const styles = styleSheetCreate({
  countdownContainer: {
    borderRadius: 2,
    paddingLeft: 4,
    paddingRight: 4,
  },
})

export default HOCTimers(ExplodingMeta)
