// @flow
import React, {Component} from 'react'
import ReactList from 'react-list'
import Row from '../result-row/container'
import {Box, Text} from '../../common-adapters'
import {globalStyles} from '../../styles'

import type {Props} from '.'

const owl = `
 ,___,
 [O.o]
 /)__)
 -"--"-`

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
      />
    )
  }

  render() {
    const {style, items} = this.props

    // TODO maybe move to container so this is shared
    if (!items.length) {
      return (
        <Box style={{...globalStyles.flexBoxCenter, ...globalStyles.flexBoxColumn, height: 256, ...style}}>
          <Text type="BodySmallSemibold">Sorry, no humans match this.</Text>
          <Text type="BodySmallSemibold" style={{whiteSpace: 'pre', textAlign: 'center'}}>{owl}</Text>
        </Box>
      )
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
