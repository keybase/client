// @flow
import React, {PureComponent} from 'react'
import ReactList from 'react-list'
import {globalStyles} from '../styles'

import type {Props} from './list'

class List extends PureComponent<Props<any>, void> {
  _list: ?ReactList
  _itemRender = index => {
    // ReactList has an issue where it caches the list length into its own state so can ask
    // for indicies outside of the items...
    if (index >= this.props.items.length) {
      return null
    }
    const item = this.props.items[index]
    return this.props.renderItem(index, item)
  }

  _setListRef = r => {
    this._list = r
  }

  componentDidUpdate(prevProps: Props<any>) {
    if (this.props.selectedIndex !== -1 && this.props.selectedIndex !== prevProps.selectedIndex) {
      this._list && this._list.scrollAround(this.props.selectedIndex)
    }
  }

  _getType() {
    if (this.props.itemSizeEstimator) {
      return 'variable'
    }
    return this.props.fixedHeight ? 'uniform' : 'simple'
  }

  render() {
    return (
      <div
        style={{
          flexGrow: 1,
          position: 'relative',
          ...this.props.style,
        }}
      >
        <div style={globalStyles.fillAbsolute}>
          <div
            style={{
              height: '100%',
              overflowY: 'auto',
              width: '100%',
            }}
          >
            <ReactList
              ref={this._setListRef}
              useTranslate3d={false}
              useStaticSize={!!this.props.fixedHeight}
              itemRenderer={this._itemRender}
              itemSizeEstimator={this.props.itemSizeEstimator}
              length={this.props.items.length}
              type={this._getType()}
            />
          </div>
        </div>
      </div>
    )
  }
}

export default List
