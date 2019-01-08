// @flow
import React, {PureComponent} from 'react'
import AutoSizer from 'react-virtualized-auto-sizer'
import * as Styles from '../styles'
import {FixedSizeList, VariableSizeList} from 'react-window'
import type {Props} from './list2'

class List2 extends PureComponent<Props<any>, void> {
  _keyExtractor = index => {
    const item = this.props.items[index]
    if (this.props.indexAsKey || !item) {
      return String(index)
    }

    const keyProp = this.props.keyProperty || 'key'
    return item[keyProp]
  }

  _fixed = ({height, width}) => (
    <FixedSizeList
      style={Styles.collapseStyles([styles.list, this.props.style])}
      height={height}
      width={width}
      itemCount={this.props.items.length}
      itemKey={this._keyExtractor}
      itemSize={this.props.itemHeight}
    >
      {({index, style}) => <div style={style}>{this.props.renderItem(index, this.props.items[index])}</div>}
    </FixedSizeList>
  )

  // $FlowIssue doesn't know itemHeight can't be number here -- we only call this when it's a function.
  _variableItemSize = index => this.props.itemHeight(index, this.props.items[index])
  _variable = ({height, width}) => (
    <VariableSizeList
      style={this.props.style}
      height={height}
      width={width}
      itemCount={this.props.items.length}
      itemKey={this._keyExtractor}
      itemSize={this._variableItemSize}
      estimatedItemSize={this.props.estimatedItemHeight}
    >
      {({index, style}) => <div style={style}>{this.props.renderItem(index, this.props.items[index])}</div>}
    </VariableSizeList>
  )

  render() {
    // TODO: make this work after just-in-time measurement is merged in
    // react-window.
    return typeof this.props.itemHeight === 'number' ? (
      <AutoSizer>{this._fixed}</AutoSizer>
    ) : (
      <AutoSizer>{this._variable}</AutoSizer>
    )
  }
}

const styles = Styles.styleSheetCreate({})

export default List2
