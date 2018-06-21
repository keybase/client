// @flow
// Component to help debug rpc issues. Shows counts of incoming/outgoing rpcs. Turned on by default for kb employees
import * as React from 'react'
import {ClickableBox, Box2, Text} from '../common-adapters'
import {connect, type TypedState} from '../util/container'
import {styleSheetCreate, platformStyles} from '../styles'
import * as Stats from '../engine/stats'

type Props = {
  username: string,
}
type State = {
  markIn: boolean,
  markOut: boolean,
  smallInCount: number,
  smallOutCount: number,
  visible: boolean,
}

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

  _intervalID: ?IntervalID

  _cleanup = () => {
    if (this._intervalID) {
      clearInterval(this._intervalID)
      this._intervalID = null
    }
  }

  _maybeStart = () => {
    this._cleanup()
    let visible = this.state.visible

    // only check whitelist once
    if (this.props.username) {
      if (whitelist.indexOf(this.props.username) !== -1) {
        visible = true
      }
      whitelist = []
    }

    this.setState(p => (p.visible !== visible ? {visible} : undefined))
    if (visible) {
      this._intervalID = setInterval(() => {
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

  componentDidMount() {
    this._maybeStart()
  }

  componentDidUpdate(prevProps: Props, prevState: State) {
    if (this.props.username !== prevProps.username || this.state.visible !== prevState.visible) {
      this._maybeStart()
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
    this.setState(p => ({
      visible: !p.visible,
    }))
  }

  render() {
    if (!this.state.visible) return null

    return (
      <ClickableBox onClick={this._onClick} style={styles.clickableBox}>
        <Box2 direction="horizontal" style={styles.container} fullWidth={true} fullHeight={true}>
          <Text
            type={this.state.markIn ? 'BodySmallExtrabold' : 'BodySmall'}
            style={styles.text}
            title="Incoming calls"
          >
            <Text type="BodySmall" style={styles.emoji}>
              ⤵️{' '}
            </Text>
            {this.state.smallInCount}
          </Text>
          <Text
            type={this.state.markOut ? 'BodySmallExtrabold' : 'BodySmall'}
            style={styles.text}
            title="Outgoing calls"
          >
            <Text type="BodySmall" style={styles.emoji}>
              ↗️{' '}
            </Text>
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
    isMobile: {
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

const mapStateToProps = (state: TypedState) => ({
  username: state.config.username,
})

export default connect(mapStateToProps)(RpcStats)
