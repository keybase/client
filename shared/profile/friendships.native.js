// @flow
import React, {Component} from 'react'
import {Box, ComingSoon} from '../common-adapters'
import type {Props} from './render'

class Render extends Component<void, Props, void> {
  _renderComingSoon () {
    return <ComingSoon />
  }

  render () {
    if (this.props.showComingSoon) {
      return this._renderComingSoon()
    }
    return <Box />
  }
}

export default Render
