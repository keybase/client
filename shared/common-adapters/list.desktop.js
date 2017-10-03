// @flow
import React, {PureComponent} from 'react'
import ReactList from 'react-list'
import {globalStyles} from '../styles'

import type {Props} from './list'

class List extends PureComponent<Props<*>, void> {
  _list: ?ReactList
  _itemRender = index => {
    const item = this.props.items[index]
    return this.props.renderItem(index, item)
  }

  _setListRef = r => {
    this._list = r
  }

  componentDidUpdate(prevProps) {
    if (this.props.selectedIndex !== -1 && this.props.selectedIndex !== prevProps.selectedIndex) {
      this._list && this._list.scrollAround(this.props.selectedIndex)
    }
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
              useTranslate3d={true}
              useStaticSize={!!this.props.fixedHeight}
              itemRenderer={this._itemRender}
              length={this.props.items.length}
              type={this.props.fixedHeight ? 'uniform' : 'simple'}
            />
          </div>
        </div>
      </div>
    )
  }
}

export default List
