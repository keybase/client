import * as React from 'react'
import {List} from '../../common-adapters'
import {Props} from './list'
import {globalStyles} from '../../styles'

export default class extends React.PureComponent<Props> {
  itemSizeEstimator = (index: number, cache: {[K in number]: number}) => {
    if (this.props.rows[index].type === 'member') {
      return 48
    }
    return cache[index]
  }

  _renderItem = (_, item) => this.props.renderRow(item)

  render() {
    return (
      <List
        items={this.props.rows}
        itemSizeEstimator={this.itemSizeEstimator}
        indexAsKey={true}
        style={styleList}
        renderItem={this._renderItem}
        windowSize={10}
      />
    )
  }
}

const styleList = {
  ...globalStyles.fillAbsolute,
  ...globalStyles.flexBoxColumn,
  alignItems: 'center',
} as const
