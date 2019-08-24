import React, {Component} from 'react'
import Box from './box'
import {collapseStyles, globalColors} from '../styles'

import {Props} from './divider.d'

class Divider extends Component<Props> {
  render() {
    const orientationStyle = this.props.vertical ? {maxWidth: 1, minWidth: 1} : {maxHeight: 1, minHeight: 1}

    return <Box style={collapseStyles([styles.divider, orientationStyle, this.props.style])} />
  }
}

const styles = {
  divider: {
    backgroundColor: globalColors.black_10,
    flex: 1,
  },
}

export default Divider
