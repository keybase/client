import * as React from 'react'
import AutoSizer from 'react-virtualized-auto-sizer'
import {FixedSizeList, VariableSizeList} from 'react-window'
import type {Props} from './list2'
import {smallHeight, largeHeight} from './list-item2'

class List2<T> extends React.PureComponent<Props<T>> {
  _keyExtractor = (index: number) => {
    const item = this.props.items[index]
    if (this.props.indexAsKey || !item) {
      return String(index)
    }

    const keyProp = this.props.keyProperty || 'key'
    const i: {[key: string]: string} = item
    return i[keyProp] ?? String(index)
  }

  // This has to be a separate variable since if we construct it inside render
  // it's a new function everytime, and that triggers react-window to unmount
  // all rows and mount again.
  _row = (p: {index: number; style: React.CSSProperties}) => {
    const {index, style} = p
    const item = this.props.items[index]
    return item ? <div style={style}>{this.props.renderItem(index, item)}</div> : null
  }

  // Need to pass in itemData to make items re-render on prop changes.
  _fixed = (p: {height: number; width: number; itemHeight: number}) => {
    const {height, width, itemHeight} = p
    return (
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
  }

  private variableSizeListRef = React.createRef<VariableSizeList>()
  _variableItemSize = (index: number) =>
    this.props.itemHeight.type === 'variable'
      ? this.props.itemHeight.getItemLayout(index, this.props.items[index]).length
      : 0
  _variable = (p: {height: number; width: number}) => {
    const {height, width} = p
    return (
      <VariableSizeList
        ref={this.variableSizeListRef}
        style={this.props.style as React.CSSProperties}
        height={height}
        width={width}
        itemCount={this.props.items.length}
        itemData={this.props.items}
        itemKey={this._keyExtractor}
        itemSize={this._variableItemSize}
        estimatedItemSize={this.props.estimatedItemHeight}
      >
        {this._row}
      </VariableSizeList>
    )
  }

  componentDidUpdate(prevProps: Props<T>) {
    if (prevProps.forceLayout !== this.props.forceLayout) {
      this.variableSizeListRef.current?.resetAfterIndex(0, true)
    }
  }

  render() {
    if (this.props.items.length === 0) return null
    return (
      <AutoSizer doNotBailOutOnEmptyChildren={true}>
        {(p: {height?: number; width?: number}) => {
          let {height = 1, width = 1} = p
          if (isNaN(height)) {
            height = 1
          }
          if (isNaN(width)) {
            width = 1
          }
          switch (this.props.itemHeight.type) {
            case 'fixed':
              return this._fixed({height, itemHeight: this.props.itemHeight.height, width})
            case 'fixedListItem2Auto': {
              const itemHeight = this.props.itemHeight.sizeType === 'Large' ? largeHeight : smallHeight
              return this._fixed({height, itemHeight, width})
            }
            case 'variable':
              return this._variable({height, width})
            default:
              return <></>
          }
        }}
      </AutoSizer>
    )
  }
}

export default List2
