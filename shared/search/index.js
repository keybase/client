// @flow
import React, {Component} from 'react'
import {search, selectPlatform} from '../actions/search'
import Render from './render'
import {TypedConnector} from '../util/typed-connect'

import type {TypedState} from '../constants/reducer'
import type {Props} from './render'
import type {SearchActions} from '../constants/search'
import type {TypedDispatch} from '../constants/types/flux'

import flags from '../util/feature-flags'

type OwnProps = {}

class Search extends Component<void, Props, void> {
  render () {
    return (
      <Render
        showComingSoon={this.props.showComingSoon}
        username={this.props.username}
        searchHintText={this.props.searchHintText}
        onSearch={term => this.props.onSearch(term, this.props.selectedService)}
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

const connector: TypedConnector<TypedState, TypedDispatch<SearchActions>, OwnProps, Props> = new TypedConnector()

export default connector.connect(
  ({search: {searchHintText, searchPlatform, searchText, searchIcon, results}, config: {username}}, dispatch, ownProps) => ({
    username: username || '',
    searchHintText,
    searchText,
    searchIcon,
    results,
    showComingSoon: !flags.searchEnabled,
    onClickResult: () => console.log('TODO'),
    selectedService: searchPlatform,
    onSearch: (term, platform) => { dispatch(search(term, platform)) },
    onClickService: platform => { dispatch(selectPlatform(platform)) },
  }))(Search)
