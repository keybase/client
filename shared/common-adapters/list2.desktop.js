// @flow
import React, {PureComponent} from 'react'
import * as Flow from '../util/flow'
import AutoSizer from 'react-virtualized-auto-sizer'
import {FixedSizeList, VariableSizeList} from 'react-window'
import type {Props} from './list2'

class List2<T> extends PureComponent<Props<T>, void> {
  _keyExtractor = index => {
    const item = this.props.items[index]
    if (this.props.indexAsKey || !item) {
      return String(index)
    }

    const keyProp = this.props.keyProperty || 'key'
    return item[keyProp]
  }

  _fixed = ({height, width, itemHeight}) => (
    <FixedSizeList
      style={this.props.style}
      height={height}
      width={width}
      itemCount={this.props.items.length}
      itemKey={this._keyExtractor}
      itemSize={itemHeight}
    >
      {({index, style}) => <div style={style}>{this.props.renderItem(index, this.props.items[index])}</div>}
    </FixedSizeList>
  )

  _variable = ({height, width, getItemLayout}) => (
    <VariableSizeList
      style={this.props.style}
      height={height}
      width={width}
      itemCount={this.props.items.length}
      itemKey={this._keyExtractor}
      itemSize={index => getItemLayout(index, this.props.items[index]).height}
      estimatedItemSize={this.props.estimatedItemHeight}
    >
      {({index, style}) => <div style={style}>{this.props.renderItem(index, this.props.items[index])}</div>}
    </VariableSizeList>
  )

  render() {
    return (
      <AutoSizer>
        {({height, width}) => {
          switch (this.props.itemHeight.type) {
            case 'fixed':
              return this._fixed({height, itemHeight: this.props.itemHeight.height, width})
            case 'variable':
              return this._variable({getItemLayout: this.props.itemHeight.getItemLayout, height, width})
            default:
              Flow.ifFlowComplainsAboutThisFunctionYouHaventHandledAllCasesInASwitch(
                this.props.itemHeight.type
              )
              return null
          }
        }}
      </AutoSizer>
    )
  }
}

export default List2
