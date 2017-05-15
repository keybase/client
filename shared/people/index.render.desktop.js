// @flow
import React, {Component} from 'react'
import {ComingSoon} from '../common-adapters'

export default class PeopleRender extends Component {
  _renderComingSoon() {
    return <ComingSoon />
  }

  render() {
    if (this.props.showComingSoon) {
      return this._renderComingSoon()
    }

    return null
  }
}
