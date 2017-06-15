// @flow
import React, {Component} from 'react'
import Row from '../result-row/container'
import {Box} from '../../common-adapters'
// $FlowIssue
import FlatList from '../../fixme/Lists/FlatList'
import EmptyResults from './empty'

import type {Props} from '.'

class SearchResultsList extends Component<void, Props, void> {
  _keyExtractor = id => id

  _renderItem = ({item: id}) => {
    const {onClick, onShowTracker} = this.props
    return (
      <Row
        id={id}
        onClick={() => onClick(id)}
        onShowTracker={onShowTracker ? () => onShowTracker(id) : undefined}
      />
    )
  }

  render() {
    const {style, items} = this.props
    if (!items.length) {
      return <EmptyResults style={style} />
    }
    return (
      <Box style={{width: '100%', ...style}}>
        <FlatList data={items} renderItem={this._renderItem} keyExtractor={this._keyExtractor} />
      </Box>
    )
  }
}

export default SearchResultsList
