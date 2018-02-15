// @flow
import React, {Component} from 'react'
import Row from '../result-row/container'
import {Box, Text, NativeFlatList} from '../../common-adapters/index.native'
import {globalColors, globalMargins} from '../../styles'
import EmptyResults from './empty'

import type {Props} from '.'

class SearchResultsList extends Component<Props> {
  _keyExtractor = id => id

  _renderItem = ({item: id}) => {
    const {disableIfInTeamName, onClick, onShowTracker} = this.props
    return (
      <Row
        disableIfInTeamName={disableIfInTeamName}
        id={id}
        onClick={() => onClick(id)}
        onShowTracker={onShowTracker ? () => onShowTracker(id) : undefined}
      />
    )
  }

  render() {
    const {showSearchSuggestions, style, items} = this.props
    if (items == null) {
      return <Box />
    } else if (!items.length) {
      return <EmptyResults style={style} />
    }

    return (
      <Box style={{width: '100%', ...style}}>
        {showSearchSuggestions && (
          <Box style={{padding: globalMargins.tiny}}>
            <Text type="BodySmallSemibold" style={{color: globalColors.black_40}}>
              Recommendations
            </Text>
          </Box>
        )}
        <NativeFlatList
          data={items}
          renderItem={this._renderItem}
          keyExtractor={this._keyExtractor}
          keyboardDismissMode={this.props.keyboardDismissMode}
        />
      </Box>
    )
  }
}

export default SearchResultsList
