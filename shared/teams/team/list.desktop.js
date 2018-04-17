// @flow
import * as React from 'react'
import {List} from '../../common-adapters'
import type {Props} from './list'
import {globalStyles} from '../../styles'

export default class extends React.PureComponent<Props> {
  itemSizeEstimator = (index: number, cache: {[index: number]: number}) => {
    if (this.props.rows[index].type === 'member') {
      return 48
    }
    return cache[index]
  }

  _renderItem = (index, item) => this.props.renderRow(item)

  render() {
    return (
      <List
        items={this.props.rows}
        itemSizeEstimator={this.itemSizeEstimator}
        style={styleList}
        renderItem={this._renderItem}
        windowsSize={10}
      />
    )
  }
}

const styleList = {
  ...globalStyles.fillAbsolute,
  ...globalStyles.flexBoxColumn,
  alignItems: 'center',
}
