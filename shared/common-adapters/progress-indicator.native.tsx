import React, {Component} from 'react'
import {Props} from './progress-indicator'
import {NativeActivityIndicator} from './native-wrappers.native'
import {globalColors, collapseStyles} from '../styles'

class ProgressIndicator extends Component<Props> {
  render() {
    const size = this.props.type === 'Large' ? 'large' : 'small'

    return (
      <NativeActivityIndicator
        color={this.props.white ? globalColors.white : globalColors.black}
        size={size}
        style={collapseStyles([style, this.props.style])}
      />
    )
  }
}

const style = {
  alignItems: 'center',
  justifyContent: 'center',
}

export default ProgressIndicator
