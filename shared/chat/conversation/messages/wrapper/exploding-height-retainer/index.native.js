// @flow
import * as React from 'react'
import {
  Box,
  ConnectedUsernames,
  NativeAnimated,
  NativeImage,
  Text,
  NativeEasing,
} from '../../../../../common-adapters/mobile.native'
import {collapseStyles, globalColors, globalStyles, styleSheetCreate} from '../../../../../styles'
import type {Props} from '.'

// If this image changes, some hard coded dimensions
// in this file also need to change.
const explodedIllustrationURL = require('../../../../../images/icons/pattern-ashes-mobile-400-80.png')

const animationDurationMs = 1500

type State = {
  height: ?number,
  numImages: number,
}
class ExplodingHeightRetainer extends React.Component<Props, State> {
  state = {height: 20, numImages: 1}

  _onLayout = evt => {
    if (evt.nativeEvent && evt.nativeEvent.layout.height !== this.state.height) {
      this.setState({
        height: evt.nativeEvent.layout.height,
        numImages: Math.ceil(evt.nativeEvent.layout.height / 80),
      })
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
        <AnimatedAshTower
          exploded={this.props.retainHeight}
          explodedBy={this.props.explodedBy}
          numImages={this.state.numImages}
        />
        {!this.props.retainHeight && this.props.children}
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
      </NativeAnimated.View>
    )
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
  exploded: {
    backgroundColor: globalColors.white,
    color: globalColors.black_20_on_white,
  },
  retaining: {
    overflow: 'hidden',
  },
  slider: {
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
