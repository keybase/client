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
      <UserSearch
        searchHintText={this.props.searchHintText}
        onSearch={this.props.onSearch}
        searchText={this.props.searchText}
        searchIcon={this.props.searchIcon}
        results={this.props.results}
        />
    )
  }
}

export default Render
