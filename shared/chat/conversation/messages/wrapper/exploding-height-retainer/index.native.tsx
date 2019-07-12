import * as React from 'react'
import * as Kb from '../../../../../common-adapters/mobile.native'
import * as Styles from '../../../../../styles'
import {throttle} from 'lodash-es'
import {Props} from './index.types'
import SharedTimer, {SharedTimerID} from '../../../../../util/shared-timers'

// If this image changes, some hard coded dimensions
// in this file also need to change.
const explodedIllustrationURL = require('../../../../../images/icons/pattern-ashes-mobile-400-80.png')

export const animationDuration = 1500

const copyChildren = (children: React.ReactNode): React.ReactNode =>
  // @ts-ignore
  React.Children.map(children, child => (child ? React.cloneElement(child) : child))

type State = {
  children: React.ReactNode
  height: number | null
  numImages: number
}

class ExplodingHeightRetainer extends React.Component<Props, State> {
  state = {
    children: this.props.retainHeight ? null : copyChildren(this.props.children),
    height: 20,
    numImages: 1,
  }
  timeoutID?: NodeJS.Timer

  static getDerivedStateFromProps(nextProps: Props, _: State) {
    return nextProps.retainHeight ? null : {children: copyChildren(nextProps.children)}
  }

  componentDidUpdate(prevProps: Props) {
    if (this.props.retainHeight && !prevProps.retainHeight && this.props.children) {
      // we just exploded! get rid of children when we're supposed to.
      this._clearTimeout()
      this.timeoutID = setTimeout(() => {
        this.setState({children: null})
        this.timeoutID = undefined
      }, animationDuration)
    }
  }

  componentWillUnmount() {
    this._clearTimeout()
  }

  _onLayout = evt => {
    if (evt.nativeEvent && evt.nativeEvent.layout.height !== this.state.height) {
      this.setState({
        height: evt.nativeEvent.layout.height,
        numImages: Math.ceil(evt.nativeEvent.layout.height / 80),
      })
    }
  }

  _clearTimeout = () => {
    // `if` is for clarity but isn't really necessary, `clearTimeout` fails silently
    if (this.timeoutID) {
      clearTimeout(this.timeoutID)
      this.timeoutID = undefined
    }
  }

  render() {
    return (
      <Kb.Box
        onLayout={this._onLayout}
        style={Styles.collapseStyles([
          styles.container,
          this.props.style,
          this.props.retainHeight && styles.retaining,
          !!this.state.height && this.props.retainHeight && {height: this.state.height},
        ])}
      >
        {this.state.children}
        <AnimatedAshTower
          exploded={this.props.retainHeight}
          explodedBy={this.props.explodedBy}
          messageKey={this.props.messageKey}
          numImages={this.state.numImages}
        />
      </Kb.Box>
    )
  }
}

type AshTowerProps = {
  exploded: boolean
  explodedBy?: string
  messageKey: string
  numImages: number
}

type AshTowerState = {
  showExploded: boolean
  width: Kb.NativeAnimated.Value
}

class AnimatedAshTower extends React.Component<AshTowerProps, AshTowerState> {
  state = {
    showExploded: this.props.exploded,
    width: this.props.exploded ? new Kb.NativeAnimated.Value(100) : new Kb.NativeAnimated.Value(0),
  }
  timerID?: SharedTimerID

  componentDidUpdate(prevProps: AshTowerProps) {
    if (!prevProps.exploded && this.props.exploded) {
      // just exploded! animate
      Kb.NativeAnimated.timing(this.state.width, {
        duration: animationDuration,
        easing: Kb.NativeEasing.inOut(Kb.NativeEasing.ease),
        toValue: 100,
      }).start()
      // insert 'EXPLODED' in sync with 'boom!' disappearing
      this.timerID && SharedTimer.removeObserver(this.props.messageKey, this.timerID)
      this.timerID = SharedTimer.addObserver(() => this.setState({showExploded: true}), {
        key: this.props.messageKey,
        ms: animationDuration,
      })
    }
  }

  componentWillUnmount() {
    this.timerID && SharedTimer.removeObserver(this.props.messageKey, this.timerID)
  }

  render() {
    if (!this.props.exploded) {
      return null
    }
    const width = this.state.width.interpolate({
      inputRange: [0, 100],
      outputRange: ['0%', '100%'],
    })
    return (
      <Kb.NativeAnimated.View style={[{width}, styles.slider]}>
        <AshTower {...this.props} showExploded={this.state.showExploded} />
        <EmojiTower animatedValue={this.state.width} numImages={this.props.numImages} />
      </Kb.NativeAnimated.View>
    )
  }
}

class EmojiTower extends React.Component<
  {numImages: number; animatedValue: Kb.NativeAnimated.Value},
  {running: boolean}
> {
  state = {running: false}
  componentDidMount() {
    this.props.animatedValue.addListener(this._listener)
  }

  componentWillUnmount() {
    this._update.cancel()
    this.props.animatedValue.removeAllListeners()
  }

  _listener = (evt: {value: number}) => {
    if ([0, 100].includes(evt.value)) {
      this.setState({running: false})
      return
    }
    if (!this.state.running) {
      this.setState({running: true}, this._update)
      return
    }
    this._update()
  }

  _update = throttle(() => this.forceUpdate(), 100)

  render() {
    if (!this.state.running) {
      return null
    }
    const children: Array<React.ReactNode> = []
    for (let i = 0; i < this.props.numImages * 4; i++) {
      const r = Math.random()
      let emoji
      if (r < 0.33) {
        emoji = '💥'
      } else if (r < 0.66) {
        emoji = '💣'
      } else {
        emoji = Styles.isAndroid ? '🎇' : '🤯'
      }
      children.push(
        <Kb.Text key={i} type="Body">
          {emoji}
        </Kb.Text>
      )
    }
    return <Kb.Box style={styles.emojiTower}>{children}</Kb.Box>
  }
}
const AshTower = (props: {explodedBy?: string; numImages: number; showExploded: boolean}) => {
  const children: Array<React.ReactNode> = []
  for (let i = 0; i < props.numImages; i++) {
    children.push(<Kb.NativeImage key={i} source={explodedIllustrationURL} style={styles.ashes} />)
  }
  let exploded: React.ReactNode = null
  if (props.showExploded) {
    exploded = !props.explodedBy ? (
      <Kb.Text type="BodyTiny" style={styles.exploded}>
        EXPLODED
      </Kb.Text>
    ) : (
      <Kb.Text lineClamp={1} type="BodyTiny" style={styles.exploded}>
        EXPLODED BY{' '}
        <Kb.ConnectedUsernames
          type="BodySmallSemibold"
          onUsernameClicked="profile"
          usernames={[props.explodedBy]}
          inline={true}
          colorFollowing={true}
          colorYou={true}
          underline={true}
        />
      </Kb.Text>
    )
  }
  return (
    <React.Fragment>
      {children}
      <Kb.Box style={styles.tagBox}>{exploded}</Kb.Box>
    </React.Fragment>
  )
}
const styles = Styles.styleSheetCreate({
  ashes: {
    height: 80,
    width: 400,
  },
  container: {...Styles.globalStyles.flexBoxColumn, flex: 1},
  emojiTower: {
    ...Styles.globalStyles.flexBoxColumn,
    bottom: 0,
    overflow: 'hidden',
    position: 'absolute',
    right: 0,
    top: 0,
    width: 20,
  },
  exploded: {
    backgroundColor: Styles.globalColors.white,
    color: Styles.globalColors.black_20_on_white,
    paddingLeft: Styles.globalMargins.tiny,
  },
  retaining: {
    overflow: 'hidden',
  },
  slider: {
    backgroundColor: Styles.globalColors.white,
    bottom: 0,
    height: '100%',
    left: 0,
    overflow: 'hidden',
    position: 'absolute',
    top: 0,
  },
  tagBox: {
    ...Styles.globalStyles.flexBoxColumn,
    alignItems: 'flex-end',
    bottom: 2,
    minWidth: 200,
    position: 'absolute',
    right: 0,
  },
})
export default ExplodingHeightRetainer
