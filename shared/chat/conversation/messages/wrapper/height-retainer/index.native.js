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
    if (evt && evt.layout) {
    }
  }

  render() {
    return <Box style={collapseStyles([this.props.style])}>{this.props.children}</Box>
  }
}

export default HeightRetainer
