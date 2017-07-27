// @flow
import React, {Component} from 'react'
import ReactList from 'react-list'
import Row from '../result-row/container'
import {Box, Text} from '../../common-adapters'
import {globalColors, globalMargins} from '../../styles'
import EmptyResults from './empty'

import type {Props} from '.'

class SearchResultsList extends Component<void, Props, void> {
  _itemRenderer = index => {
    const id = this.props.items[index]
    const {onClick, onMouseOver, onShowTracker} = this.props
    return (
      <Row
        id={id}
        key={id}
        onClick={() => onClick(id)}
        onMouseOver={() => onMouseOver && onMouseOver(id)}
        onShowTracker={onShowTracker ? () => onShowTracker(id) : undefined}
        selected={this.props.selectedId === id}
      />
    )
  }

  _list = null
  _setRef = r => (this._list = r)

  componentWillReceiveProps(nextProps: Props) {
    if (this.props.selectedId !== nextProps.selectedId) {
      const list = this._list
      if (list && nextProps.selectedId) {
        const idx = nextProps.items.indexOf(nextProps.selectedId)
        if (idx !== -1) {
          list.scrollAround(idx)
        }
      }
    }
  }

  render() {
    const {showSearchSuggestions, style, items} = this.props
    if (items == null) {
      return <Box style={{height: 256}} />
    } else if (!items.length) {
      return <EmptyResults style={style} />
    }
    return (
      <Box style={{width: '100%', height: 256, ...style}}>
        {showSearchSuggestions &&
          <Box style={{padding: globalMargins.tiny}}>
            <Text type="BodySmallSemibold" style={{color: globalColors.black_60}}>
              Recommendations
            </Text>
          </Box>}
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
