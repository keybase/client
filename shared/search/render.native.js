/* @flow */
import React, {Component} from 'react'
import {ComingSoon} from '../common-adapters'
import UserSearch from './user-search/render'
import type {Props} from './render'

class Render extends Component<void, Props, void> {
  _renderComingSoon () {
    return <ComingSoon />
  }

  render () {
    if (this.props.showComingSoon) {
      return this._renderComingSoon()
    }
    return (
      <UserSearch {...this.props} />
    )
  }
}

export default Render
