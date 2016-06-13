// @flow
import React, {Component} from 'react'
import {connect} from 'react-redux'
import {bindActionCreators} from 'redux'
import {search} from '../actions/search'
import Render from './render'
import type {Props} from './render'
import flags from '../util/feature-flags'

class Search extends Component<void, Props, void> {
  render () {
    return (
      <Render
        showComingSoon={/*!flags.searchEnabled*/false}
        searchHintText={this.props.searchHintText}
        onSearch={this.props.onSearch}
        searchText={this.props.searchText}
        searchIcon={this.props.searchIcon}
        results={this.props.results}
        />
    )
  }

  static parseRoute () {
    return {
      componentAtTop: {title: 'Search'}
    }
  }
}

export default connect(
  state => ({
    searchHintText: state.search.searchHintText,
    searchText: state.search.searchText,
    searchIcon: state.search.searchIcon,
    results: state.search.results
  }),
  dispatch => (bindActionCreators({
    onSearch: search
  }, dispatch)))(Search)
