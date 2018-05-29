// @flow
import * as React from 'react'
import {Box, ConnectedUsernames, NativeImage, Text} from '../../../../../common-adapters/mobile.native'
import {collapseStyles, globalColors, styleSheetCreate} from '../../../../../styles'
import type {Props} from '.'

const explodedUllustrationURL = require('../../../../../images/icons/pattern-ashes-mobile-400-80.png')

type State = {
  height: ?number,
}
class ExplodingHeightRetainer extends React.Component<Props, State> {
  state = {height: 20}

  _onLayout = evt => {
    if (evt.nativeEvent && evt.nativeEvent.layout.height !== this.state.height) {
      this.setState({height: evt.nativeEvent.layout.height})
    }
  }

  render() {
    return (
      <Box
        onLayout={this._onLayout}
        style={collapseStyles([
          this.props.style,
          !!this.state.height && this.props.retainHeight && {height: this.state.height},
        ])}
      >
        {this.props.retainHeight && (
          <NativeImage
            source={explodedUllustrationURL}
            style={{width: '100%', height: '100%'}}
            resizeMode="repeat"
          />
        )}
        {this.props.retainHeight &&
          (!this.props.explodedBy ? (
            <Text type="BodySmall" style={styles.exploded}>
              EXPLODED
            </Text>
          ) : (
            <Text lineClamp={1} type="BodySmall" style={styles.exploded}>
              EXPLODED BY{' '}
              <ConnectedUsernames
                type="BodySmall"
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

const styles = styleSheetCreate({
  exploded: {
    backgroundColor: globalColors.white,
    color: globalColors.black_20_on_white,
    position: 'absolute',
    right: 0,
    bottom: 2,
  },
})

export default ExplodingHeightRetainer
