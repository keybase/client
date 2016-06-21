// @flow
import React, {Component} from 'react'
import {connect} from 'react-redux'
import {bindActionCreators} from 'redux'
import {search, selectPlatform} from '../actions/search'
import Render from './render'

import type {Props} from './render'
import type {SearchPlatforms} from '../constants/search'

import flags from '../util/feature-flags'

class Search extends Component<void, Props & {searchPlatform: SearchPlatforms}, void> {
  render () {
    return (
      <Render
        showComingSoon={!flags.searchEnabled}
        username={this.props.username}
        showComingSoon={/* !flags.searchEnabled */false}
        searchHintText={this.props.searchHintText}
        onSearch={term => this.props.onSearch(term, this.props.searchPlatform)}
        searchText={this.props.searchText}
        searchIcon={this.props.searchIcon}
        results={this.props.results}
        selectedService={this.props.selectedService}
        onClickService={this.props.onClickService}
        onClickResult={this.props.onClickResult} />
    )
  }

  static parseRoute () {
    return {
      componentAtTop: {title: 'Search'},
    }
  }
}

export default connect(
  state => ({
    username: state.config.username,
    searchHintText: state.search.searchHintText,
    searchPlatform: state.search.searchPlatform,
    searchText: state.search.searchText,
    searchIcon: state.search.searchIcon,
    results: state.search.results,
  }),
  dispatch => (bindActionCreators({
    onSearch: search,
    onClickService: selectPlatform,
  }, dispatch)))(Search)
