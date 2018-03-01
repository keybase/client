// @flow
import * as React from 'react'
import {List} from '../../common-adapters'
import type {Props} from './list.render'

const styleList = {
  position: 'absolute',
  top: 0,
  right: 0,
  bottom: 0,
  left: 0,
  display: 'flex',
  alignItems: 'center',
}

export default class extends React.PureComponent<Props> {
  itemSizeEstimator = (index: number, cache: {[index: number]: number}) => {
    if (this.props.rows[index].type === 'member') {
      return 48
    }
    return cache[index]
  }

  render() {
    return (
      <List
        items={this.props.rows}
        itemSizeEstimator={this.itemSizeEstimator}
        style={styleList}
        renderItem={this.props.renderRow}
        windowsSize={10}
      />
    )
  }
}
