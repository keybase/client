// @flow
// Component to help debug rpc issues. Shows counts of incoming/outgoing rpcs. Turned on by default for kb employees
import * as React from 'react'
import {ClickableBox, Box2, Text} from '../common-adapters'
import {styleSheetCreate, platformStyles} from '../styles'
import {printRPCStats} from '../local-debug'
import * as Stats from '../engine/stats'
import {isIPhoneX} from '../constants/platform'

type Props = {}
type State = {
  // mark* means to make it bold for a single render cause it changed
  markIn: boolean,
  markOut: boolean,
  markEOF: boolean,
  // counts
  inCount: number,
  outCount: number,
  eofCount: number,
  // clicking hides it
  visible: boolean,
}

class RpcStats extends React.Component<Props, State> {
  state = {
    eofCount: 0,
    inCount: 0,
    markEOF: false,
    markIn: false,
    markOut: false,
    outCount: 0,
    visible: true,
  }

  _mounted = false
  _intervalID: ?IntervalID

  _cleanup = () => {
    if (this._intervalID) {
      clearInterval(this._intervalID)
      this._intervalID = null
    }
  }

  _start = () => {
    this._cleanup()
    this._intervalID = setInterval(() => {
      this._mounted &&
        this.setState(p => {
          const inCount = this._iterateStats(['in'], s => s.count)
          const outCount = this._iterateStats(['out'], s => s.count)
          const eofCount = Stats.getStats()['eof']

          const inDiff = p.inCount !== inCount
          const outDiff = p.outCount !== outCount
          const eofDiff = p.eofCount !== eofCount
          const markDiff = p.markIn || p.markOut || p.markEOF
          if (inDiff || outDiff || eofDiff || markDiff) {
            return {
              eofCount,
              inCount,
              markEOF: eofDiff,
              markIn: inDiff,
              markOut: outDiff,
              outCount,
            }
          }
        })
    }, 2000)
  }

  componentWillUnmount() {
    this._mounted = false
  }
  componentDidMount() {
    this._mounted = true
    this._start()
  }

  _iterateStats = (keys, f) => {
    const stats = Stats.getStats()
    let total = 0
    keys.forEach(
      key => (total = Object.keys(stats[key]).reduce((acc, method) => acc + f(stats[key][method]), total))
    )
    return total
  }

  _onClick = () => {
    this._mounted &&
      this.setState(p => ({
        visible: !p.visible,
      }))
  }

  render() {
    if (!this.state.visible) return null

    const showIcon = this.state.inCount < 100 && this.state.outCount < 100

    return (
      <ClickableBox onClick={this._onClick} style={styles.clickableBox}>
        <Box2 direction="horizontal" style={styles.container} fullWidth={true} fullHeight={true}>
          <Text
            type={this.state.markIn ? 'BodySmallExtrabold' : 'BodySmall'}
            style={styles.text}
            title="Incoming calls"
          >
            {showIcon && (
              <Text type="BodySmall" style={styles.emoji}>
                ⤵️{' '}
              </Text>
            )}
            {this.state.inCount}
          </Text>
          <Text
            type={this.state.markOut ? 'BodySmallExtrabold' : 'BodySmall'}
            style={styles.text}
            title="Outgoing calls"
          >
            {showIcon && (
              <Text type="BodySmall" style={styles.emoji}>
                ↗️{' '}
              </Text>
            )}
            {this.state.outCount}
          </Text>
          {this.state.eofCount > 0 && (
            <Text
              type={this.state.markEOF ? 'BodySmallExtrabold' : 'BodySmall'}
              style={styles.text}
              title="EOF errors"
            >
              {showIcon && (
                <Text type="BodySmall" style={styles.emoji}>
                  🔚️{' '}
                </Text>
              )}
              {this.state.eofCount}
            </Text>
          )}
        </Box2>
      </ClickableBox>
    )
  }
}

const styles = styleSheetCreate({
  clickableBox: platformStyles({
    common: {
      position: 'absolute',
    },
    isElectron: {
      bottom: 80,
      height: 20,
      left: 0,
      width: 80,
    },
    isMobile: isIPhoneX
      ? {
          bottom: 0,
          height: 20,
          left: 20,
          width: 100,
        }
      : {
          height: 20,
          left: 0,
          top: 10,
          width: 100,
        },
  }),
  container: {
    alignItems: 'center',
    backgroundColor: 'black',
    justifyContent: 'space-between',
    padding: 2,
  },
  emoji: {
    color: 'white',
    marginRight: 4,
  },
  text: {
    color: 'white',
  },
})

const TheRPCStats = printRPCStats ? RpcStats : () => null
export default TheRPCStats
