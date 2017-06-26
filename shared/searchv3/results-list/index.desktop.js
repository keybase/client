// @flow
import React, {Component} from 'react'
import ReactList from 'react-list'
import Row from '../result-row/container'
import {Box} from '../../common-adapters'
import EmptyResults from './empty'

import type {Props} from '.'

class SearchResultsList extends Component<void, Props, void> {
  _itemRenderer = index => {
    const id = this.props.items[index]
    const {onClick, onShowTracker} = this.props
    return (
      <Row
        id={id}
        key={id}
        onClick={() => onClick(id)}
        onShowTracker={onShowTracker ? () => onShowTracker(id) : undefined}
        selected={this.props.selectedId === id}
      />
    )
  }

  render() {
    const {style, items} = this.props
    if (items == null) {
      return <Box style={{height: 256}} />
    } else if (!items.length) {
      return <EmptyResults style={style} />
    }
    return (
      <Box style={{width: '100%', height: 256, ...style}}>
        <ReactList
          useTranslate3d={true}
          useStaticSize={true}
          itemRenderer={this._itemRenderer}
          length={items.length}
          type="uniform"
        />
      </Box>
    )
  }
}

export default SearchResultsList
