// @flow
// Component to help debug rpc issues. Shows counts of incoming/outgoing rpcs. Turned on by default for kb employees
import * as React from 'react'
import {ClickableBox, Box2, Text} from '../common-adapters'
import {connect, type TypedState} from '../util/container'
import {styleSheetCreate, platformStyles} from '../styles'
import {printRPCStats} from '../local-debug'
import * as Stats from '../engine/stats'
import {isIPhoneX} from '../constants/platform'

type Props = {
  username: string,
}
type State = {
  // mark* means to make it bold for a single render cause it changed
  markIn: boolean,
  markOut: boolean,
  // counts
  smallInCount: number,
  smallOutCount: number,
  // clicking hides it
  visible: boolean,
}

// we should be seeing this all the time
let whitelist = [
  'adamjspooner',
  'akalin',
  'amarcedone',
  'ayoubd',
  'cecileb',
  'chris',
  'chrisnojima',
  'cjb',
  'jacobyoung',
  'jinyang',
  'joshblum',
  'jzila',
  'max',
  'mikem',
  'mlsteele',
  'nathunsmitty',
  'oconnor663',
  'patrick',
  'songgao',
  'strib',
  'zanderz',
  'zapu',
]

class RpcStats extends React.Component<Props, State> {
  state = {
    markIn: false,
    markOut: false,
    smallInCount: 0,
    smallOutCount: 0,
    visible: false,
  }

  _mounted = true
  _intervalID: ?IntervalID

  _cleanup = () => {
    if (this._intervalID) {
      clearInterval(this._intervalID)
      this._intervalID = null
    }
  }

  _maybeStart = (userChanged: boolean) => {
    this._cleanup()
    let visible = this.state.visible

    // only check whitelist once
    if (userChanged && this.props.username) {
      if (printRPCStats || whitelist.indexOf(this.props.username) !== -1) {
        visible = true
        this._mounted && this.setState(p => (p.visible !== visible ? {visible} : undefined))
      }
      whitelist = []
    }

    if (visible) {
      this._intervalID = setInterval(() => {
        this._mounted &&
          this.setState(p => {
            const smallInCount = this._iterateStats(['in'], s => s.count)
            const smallOutCount = this._iterateStats(['out'], s => s.count)

            const inDiff = p.smallInCount !== smallInCount
            const outDiff = p.smallOutCount !== smallOutCount
            const markDiff = p.markIn || p.markOut
            if (inDiff || outDiff || markDiff) {
              return {
                markIn: inDiff,
                markOut: outDiff,
                smallInCount,
                smallOutCount,
              }
            }
          })
      }, 2000)
    }
  }

  componentWillUnmount() {
    this._mounted = false
  }
  componentDidMount() {
    this._mounted = true
    this._maybeStart(true)
  }

  componentDidUpdate(prevProps: Props, prevState: State) {
    if (this.props.username !== prevProps.username || this.state.visible !== prevState.visible) {
      this._maybeStart(this.props.username !== prevProps.username)
    }
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

    const showIcon = this.state.smallInCount < 100 && this.state.smallOutCount < 100

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
            {this.state.smallInCount}
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
            {this.state.smallOutCount}
          </Text>
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

// We only use username and pull stats on a timer. Don't want the stats gathering to affect redux at all
const mapStateToProps = (state: TypedState) => ({
  username: state.config.username,
})

export default connect(mapStateToProps, () => ({}), (s, d, o) => ({...s, ...d, ...o}))(RpcStats)
