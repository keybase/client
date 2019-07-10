import React, {PureComponent} from 'react'
import * as Flow from '../util/flow'
import AutoSizer from 'react-virtualized-auto-sizer'
import {FixedSizeList, VariableSizeList} from 'react-window'
import {Props} from './list2'
import {smallHeight, largeHeight} from './list-item2'

class List2<T> extends PureComponent<Props<T>> {
  _keyExtractor = index => {
    const item = this.props.items[index]
    if (this.props.indexAsKey || !item) {
      return String(index)
    }

    const keyProp = this.props.keyProperty || 'key'
    return item[keyProp]
  }

  // This has to be a separate variable since if we construct it inside render
  // it's a new function everytime, and that triggers react-window to unmount
  // all rows and mount again.
  _row = ({index, style}) => <div style={style}>{this.props.renderItem(index, this.props.items[index])}</div>

  // Need to pass in itemData to make items re-render on prop changes.
  _fixed = ({height, width, itemHeight}) => (
    <FixedSizeList
      style={this.props.style as React.CSSProperties}
      height={height}
      width={width}
      itemCount={this.props.items.length}
      itemData={this.props.items}
      itemKey={this._keyExtractor}
      itemSize={itemHeight}
    >
      {this._row}
    </FixedSizeList>
  )

  _variable = ({height, width, getItemLayout}) => (
    <VariableSizeList
      style={this.props.style as React.CSSProperties}
      height={height}
      width={width}
      itemCount={this.props.items.length}
      itemData={this.props.items}
      itemKey={this._keyExtractor}
      itemSize={index => getItemLayout(index, this.props.items[index]).length}
      estimatedItemSize={this.props.estimatedItemHeight}
    >
      {this._row}
    </VariableSizeList>
  )

  render() {
    return (
      <AutoSizer>
        {({height, width}) => {
          switch (this.props.itemHeight.type) {
            case 'fixed':
              return this._fixed({height, itemHeight: this.props.itemHeight.height, width})
            case 'fixedListItem2Auto': {
              const itemHeight = this.props.itemHeight.sizeType === 'Large' ? largeHeight : smallHeight
              return this._fixed({height, itemHeight, width})
            }
            case 'variable':
              return this._variable({getItemLayout: this.props.itemHeight.getItemLayout, height, width})
            default:
              Flow.ifFlowComplainsAboutThisFunctionYouHaventHandledAllCasesInASwitch(this.props.itemHeight)
              return null
          }
        }}
      </AutoSizer>
    )
  }
}

export default List2
