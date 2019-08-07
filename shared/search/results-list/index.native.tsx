import React, {Component} from 'react'
import Row from '../result-row/container'
import * as Kb from '../../common-adapters/mobile.native'
import {globalColors, globalMargins} from '../../styles'
import EmptyResults from './empty'
import {Props} from '.'

class SearchResultsList extends Component<Props> {
  _keyExtractor = id => id

  _renderItem = ({item: id}) => {
    const {disableIfInTeamName, onClick, onShowTracker, searchKey} = this.props
    return (
      <Row
        disableIfInTeamName={disableIfInTeamName}
        id={id}
        selected={false}
        onClick={() => onClick(id)}
        onShowTracker={onShowTracker ? () => onShowTracker(id) : undefined}
        searchKey={searchKey}
      />
    )
  }

  render() {
    const {showSearchSuggestions, style, items} = this.props
    if (items == null) {
      return <Kb.Box />
    } else if (!items.length) {
      return <EmptyResults style={style} />
    }

    const headerComponent = showSearchSuggestions ? (
      <Kb.Box style={{padding: globalMargins.tiny}}>
        <Kb.Text type="BodySmallSemibold" style={{color: globalColors.black_50}}>
          Recommendations
        </Kb.Text>
      </Kb.Box>
    ) : (
      undefined
    )

    return (
      <Kb.Box style={{width: '100%', ...style}}>
        <Kb.NativeFlatList
          data={items}
          renderItem={this._renderItem}
          keyExtractor={this._keyExtractor}
          keyboardDismissMode={this.props.keyboardDismissMode}
          keyboardShouldPersistTaps="handled"
          ListHeaderComponent={headerComponent}
        />
      </Kb.Box>
    )
  }
}

export default SearchResultsList
