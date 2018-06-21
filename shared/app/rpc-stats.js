// @flow
import * as React from 'react'
import {Box2, Text} from '../common-adapters'
import {connect, type TypedState} from '../util/container'
import {styleSheetCreate} from '../styles'
import * as Stats from '../engine/stats'

type Props = {
  username: string,
}
type State = {
  expanded: boolean,
  renderCount: number,
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
    expanded: false,
    renderCount: 0,
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
      this._intervalID = setInterval(
        () =>
          this.setState(p => ({
            renderCount: p.renderCount + 1,
          })),
        2000
      )
    }
  }

  componentDidMount() {
    this._maybeStart()
  }

  componentDidUpdate(prevProps: Props) {
    if (this.props.username !== prevProps.username) {
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

  render() {
    if (!this.state.visible) return null

    return (
      <Box2 direction="vertical" style={styles.container}>
        <Text type="BodySmall" style={styles.text} title="Incoming calls">
          ⤵️ {this._iterateStats(['in'], s => s.count)}
        </Text>
        <Text type="BodySmall" style={styles.text} title="Outgoing calls">
          ↗️ {this._iterateStats(['out'], s => s.count)}
        </Text>
        <Text type="BodySmall" style={styles.text} title="Payload size">
          🏋️ {this._iterateStats(['out', 'in'], s => s.payloadSize)}
        </Text>
      </Box2>
    )
  }
}

const styles = styleSheetCreate({
  container: {
    backgroundColor: 'black',
    bottom: 80,
    height: 100,
    left: 0,
    position: 'absolute',
    padding: 2,
    width: 80,
  },
  text: {
    color: 'white',
  },
})

const mapStateToProps = (state: TypedState) => ({
  username: state.config.username,
})

export default connect(mapStateToProps)(RpcStats)
