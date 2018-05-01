// @flow
import * as React from 'react'
import {Box} from '../../../../../common-adapters'
import {collapseStyles} from '../../../../../styles'
import type {Props} from '.'

type State = {
  height: ?number,
}
class HeightRetainer extends React.Component<Props, State> {
  state = {height: null}

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
        {!this.props.retainHeight && this.props.children}
      </Box>
    )
  }
}

export default HeightRetainer
