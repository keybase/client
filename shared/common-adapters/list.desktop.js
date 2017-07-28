// @flow
import React, {PureComponent} from 'react'
import ReactList from 'react-list'
import {globalStyles} from '../styles'

import type {Props} from './list'

class List extends PureComponent<void, Props<*>, void> {
  _itemRender = (index, key) => {
    const item = this.props.items[index]
    return this.props.renderItem(index, item, key)
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
