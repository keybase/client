// @flow
import React, {Component} from 'react'
import {ComingSoon} from '../common-adapters'
import type {Props} from './render'

class SettingsRender extends Component<void, Props, void> {
  _renderComingSoon () {
    return <ComingSoon />
  }

  render () {
    if (this.props.showComingSoon) {
      return this._renderComingSoon()
    }

    return null
  }
}

export default SettingsRender
