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
    return (
      <Box>
        <Text type='Body' onClick={() => this.props.onSearch('chris')}>Search chris!</Text>
        <Text type='Body' onClick={() => this.props.onSearch('malg', 'Twitter')}>Search malg!</Text>
        <Text type='Body' onClick={() => this.props.onSearch('malg', 'Keybase')}>Search malg on keybase!</Text>
        Search : TODO
      </Box>
    )
  }
}

export default Render
