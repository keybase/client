// @flow
import * as React from 'react'
import {throttle} from 'lodash-es'
import {
  Box,
  ConnectedUsernames,
  NativeAnimated,
  NativeImage,
  Text,
  NativeEasing,
} from '../../../../../common-adapters/mobile.native'
import {collapseStyles, globalColors, globalStyles, styleSheetCreate} from '../../../../../styles'
import {isAndroid} from '../../../../../constants/platform'
import type {Props} from '.'

// If this image changes, some hard coded dimensions
// in this file also need to change.
const explodedIllustrationURL = require('../../../../../images/icons/pattern-ashes-mobile-400-80.png')

const animationDurationMs = 1500

const copyChildren = children =>
  React.Children.map(children, child => (child ? React.cloneElement(child) : child))

type State = {
  children: ?React.Node,
  height: ?number,
  numImages: number,
}
class ExplodingHeightRetainer extends React.Component<Props, State> {
  state = {
    children: this.props.retainHeight ? null : copyChildren(this.props.children),
    height: 20,
    numImages: 1,
  }
  timeoutID: ?TimeoutID

  componentDidUpdate(prevProps: Props) {
    if (this.props.retainHeight && !prevProps.retainHeight && this.props.children) {
      // we just exploded! get rid of children when we're supposed to.
      this._clearTimeout()
      this.timeoutID = setTimeout(() => {
        this.setState({children: null})
        this.timeoutID = null
      }, animationDurationMs)
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
      this.timeoutID = null
    }
  }

  render() {
    return (
      <Box
        onLayout={this._onLayout}
        style={collapseStyles([
          this.props.style,
          this.props.retainHeight && styles.retaining,
          !!this.state.height && this.props.retainHeight && {height: this.state.height},
        ])}
      >
        {this.state.children}
        <AnimatedAshTower
          exploded={this.props.retainHeight}
          explodedBy={this.props.explodedBy}
          numImages={this.state.numImages}
        />
      </Box>
    )
  }
}

type AshTowerProps = {exploded: boolean, explodedBy: ?string, numImages: number}
type AshTowerState = {width: NativeAnimated.Value}
class AnimatedAshTower extends React.Component<AshTowerProps, AshTowerState> {
  state = {width: this.props.exploded ? new NativeAnimated.Value(100) : new NativeAnimated.Value(0)}

  componentDidUpdate(prevProps: AshTowerProps) {
    if (!prevProps.exploded && this.props.exploded) {
      // just exploded! animate
      NativeAnimated.timing(this.state.width, {
        duration: animationDurationMs,
        easing: NativeEasing.inOut(NativeEasing.ease),
        toValue: 100,
      }).start()
    }
  }

  render() {
    const width = this.state.width.interpolate({
      inputRange: [0, 100],
      outputRange: ['0%', '100%'],
    })
    return (
      <NativeAnimated.View style={[{width}, styles.slider]}>
        <AshTower {...this.props} />
        <EmojiTower animatedValue={this.state.width} numImages={this.props.numImages} />
      </NativeAnimated.View>
    )
  }
}

class EmojiTower extends React.Component<
  {numImages: number, animatedValue: NativeAnimated.Value},
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
      this.setState({running: true}, this._update())
      return
    }
    this._update()
  }

  _update = throttle(() => this.forceUpdate(), 100)

  render() {
    if (!this.state.running) {
      return null
    }
    const children = []
    for (let i = 0; i < this.props.numImages * 4; i++) {
      const r = Math.random()
      let emoji
      if (r < 0.33) {
        emoji = '💥'
      } else if (r < 0.66) {
        emoji = '💣'
      } else {
        emoji = isAndroid ? '🎇' : '🤯'
      }
      children.push(
        <Text key={i} type="Body">
          {emoji}
        </Text>
      )
    }
    return <Box style={styles.emojiTower}>{children}</Box>
  }
}

const AshTower = (props: {explodedBy: ?string, numImages: number}) => {
  const children = []
  for (let i = 0; i < props.numImages; i++) {
    children.push(<NativeImage key={i} source={explodedIllustrationURL} style={styles.ashes} />)
  }
  return (
    <React.Fragment>
      {children}
      <Box style={styles.tagBox}>
        {!props.explodedBy ? (
          <Text type="BodySmall" style={styles.exploded}>
            EXPLODED
          </Text>
        ) : (
          <Text lineClamp={1} type="BodySmall" style={styles.exploded}>
            EXPLODED BY{' '}
            <ConnectedUsernames
              type="BodySmallSemibold"
              clickable={true}
              usernames={[props.explodedBy]}
              inline={true}
              colorFollowing={true}
            />
          </Text>
        )}
      </Box>
    </React.Fragment>
  )
}

const styles = styleSheetCreate({
  ashes: {
    width: 400,
    height: 80,
  },
  emojiTower: {
    ...globalStyles.flexBoxColumn,
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    width: 20,
    overflow: 'hidden',
  },
  exploded: {
    backgroundColor: globalColors.white,
    color: globalColors.black_20_on_white,
  },
  retaining: {
    overflow: 'hidden',
  },
  slider: {
    backgroundColor: globalColors.white,
    height: '100%',
    overflow: 'hidden',
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
  },
  tagBox: {
    ...globalStyles.flexBoxColumn,
    alignItems: 'flex-end',
    position: 'absolute',
    right: 0,
    bottom: 2,
    minWidth: 200,
  },
})

export default ExplodingHeightRetainer
