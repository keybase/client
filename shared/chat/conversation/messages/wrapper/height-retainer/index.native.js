// @flow
import * as React from 'react'
import {Box, NativeImage} from '../../../../../common-adapters/native'
import {collapseStyles} from '../../../../../styles'
import type {Props} from '.'

const explodedUllustrationURL = require('../../../../../images/icons/pattern-ashes-mobile-400-80.png')

type State = {
  height: ?number,
}
class HeightRetainer extends React.Component<Props, State> {
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
        {!this.props.retainHeight && this.props.children}
      </Box>
    )
  }
}

export default HeightRetainer
