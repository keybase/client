// @flow
import React, {Component} from 'react'
import Render from './index.render'
import type {Props} from './index.render'

class GPGSign extends Component<void, Props, void> {
  render () {
    return <Render {...this.props} />
  }
}

export default GPGSign
