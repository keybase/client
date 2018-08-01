// @flow
import React, {Component} from 'react'
import ReactList from 'react-list'
import Row from '../result-row/container'
import {Box, Text} from '../../common-adapters'
import {globalColors, globalMargins} from '../../styles'
import EmptyResults from './empty'

import type {Props} from '.'

class SearchResultsList extends Component<Props> {
  _itemRenderer = index => {
    const id = this.props.items[index]
    const {onClick, onMouseOver, onShowTracker, searchKey} = this.props
    return (
      <Row
        id={id}
        key={id}
        onClick={() => onClick(id)}
        onMouseOver={() => onMouseOver && onMouseOver(id)}
        onShowTracker={onShowTracker ? () => onShowTracker(id) : undefined}
        searchKey={searchKey}
        selected={this.props.selectedId === id}
        disableIfInTeamName={this.props.disableIfInTeamName}
      />
    )
  }

  _list = null
  _setRef = r => (this._list = r)

  componentDidUpdate(prevProps: Props) {
    if (this.props.selectedId !== prevProps.selectedId) {
      const list = this._list
      if (list && this.props.selectedId) {
        const idx = this.props.items.indexOf(this.props.selectedId)
        if (idx !== -1) {
          list.scrollAround(idx)
        }
      }
    }
  }

  render() {
    const {showSearchSuggestions, style, items} = this.props
    if (items == null) {
      return <Box style={{height: 240, ...style}} />
    } else if (!items.length) {
      return <EmptyResults style={style} />
    }
    return (
      <Box style={{width: '100%', height: 240, ...style}}>
        {showSearchSuggestions && (
          <Box style={{padding: globalMargins.tiny}}>
            <Text type="BodySmallSemibold" style={{color: globalColors.black_40}}>
              Recommendations
            </Text>
          </Box>
        )}
        <ReactList
          useTranslate3d={true}
          useStaticSize={true}
          itemRenderer={this._itemRenderer}
          ref={this._setRef}
          length={items.length}
          type="uniform"
        />
      </Box>
    )
  }
}

export default SearchResultsList
