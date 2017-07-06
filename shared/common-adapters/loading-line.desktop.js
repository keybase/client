// @flow
import Box from './box'
import React, {Component} from 'react'
import {globalColors, globalStyles} from '../styles'

import type {Props} from './loading-line'

class LoadingLine extends Component<void, Props, void> {
  render() {
    const realCSS = `
    @keyframes fadeIn {
      from { opacity: 0; }
    }

    .loading-line {
      animation: fadeIn 1s infinite alternate;
    }
`
    return (
      <Box style={{position: 'relative'}}>
        <style>
          {realCSS}
        </style>
        <Box
          className="loading-line"
          style={{
            ...globalStyles.fillAbsolute,
            backgroundColor: globalColors.blue,
            height: 1,
            ...this.props.style,
          }}
        />
      </Box>
    )
  }
}

export default LoadingLine
