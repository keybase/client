// @flow
import React, {Component} from 'react'
import {connect} from 'react-redux'
import Render from './render'
import type {Props} from './render'
import flags from '../util/feature-flags'

class Search extends Component<void, Props, void> {
  render () {
    return (
      <Render
        showComingSoon={!flags.searchEnabled}
        username={this.props.username}
      />
    )
  }
}

export default connect(
  state => ({}),
  dispatch => ({}))(Search)
