// @flow
import * as React from 'react'
import {Box, ConnectedUsernames, NativeImage, Text} from '../../../../../common-adapters/mobile.native'
import {collapseStyles, globalColors, styleSheetCreate} from '../../../../../styles'
import type {Props} from './index.types'

// If this image changes, some hard coded dimensions
// in this file also need to change.
const explodedIllustrationURL = require('../../../../../images/icons/pattern-ashes-mobile-400-80.png')

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
        {this.props.retainHeight && <AshTower numImages={this.state.numImages} />}
        {this.props.retainHeight &&
          (!this.props.explodedBy ? (
            <Text type="BodySmall" style={styles.exploded}>
              EXPLODED
            </Text>
          ) : (
            <Text lineClamp={1} type="BodySmall" style={styles.exploded}>
              EXPLODED BY{' '}
              <ConnectedUsernames
                type="BodySmallSemibold"
                clickable={true}
                usernames={[this.props.explodedBy]}
                inline={true}
                colorFollowing={true}
              />
            </Text>
          ))}
        {!this.props.retainHeight && this.props.children}
      </Box>
    )
  }
}

const AshTower = (props: {numImages: number}) => {
  const children = []
  for (let i = 0; i < props.numImages; i++) {
    children.push(<NativeImage key={i} source={explodedIllustrationURL} style={styles.ashes} />)
  }
  return <React.Fragment>{children}</React.Fragment>
}

const styles = styleSheetCreate({
  ashes: {
    width: 400,
    height: 80,
  },
  exploded: {
    backgroundColor: globalColors.white,
    color: globalColors.black_20_on_white,
    position: 'absolute',
    right: 0,
    bottom: 2,
  },
  retaining: {
    overflow: 'hidden',
  },
})

export default ExplodingHeightRetainer
