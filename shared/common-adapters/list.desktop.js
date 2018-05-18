// @flow
import * as React from 'react'
import ReactList from 'react-list'
import {globalStyles} from '../styles'

type Props<Item> = {
  indexAsKey?: boolean,
  items: Array<Item>,
  style?: any,
  fixedHeight?: ?number,
  renderItem: (index: number, item: Item) => React.Node,
  keyProperty?: string, // if passed uses item[keyProperty] for the item keys (does nothing on desktop)
  selectedIndex?: number, // TODO work on mobile
  itemSizeEstimator?: (index: number, cache: {[index: number]: number}) => number, // Desktop only
  keyboardShouldPersistTaps?: 'never' | 'always' | 'handled', // mobile only
  windowSize?: number, // Mobile only, has a non-RN default
}

class List extends React.PureComponent<Props<any>, void> {
  _list: ?ReactList
  _itemRender = index => {
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
