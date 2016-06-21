/* @flow */
import React, {Component} from 'react'
import {Box} from '../common-adapters'
import SearchHelp from './help.desktop'
import type {Props} from './render'

class Render extends Component<void, Props, void> {
  _renderComingSoon () {
    return <SearchHelp username={this.props.username} />
  }

  render () {
    if (this.props.showComingSoon) {
      return this._renderComingSoon()
    }
    return <Box>Search : TODO</Box>
  }
}

export default Render
