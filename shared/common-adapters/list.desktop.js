// @flow
import React, {PureComponent} from 'react'
import ReactList from 'react-list'
import {globalStyles, collapseStyles, styleSheetCreate, platformStyles} from '../styles'
import logger from '../logger'

import type {Props} from './list'

class List extends PureComponent<Props<any>, void> {
  _list: ?ReactList
  _itemRender = index => {
    // ReactList has an issue where it caches the list length into its own state so can ask
    // for indices outside of the items...
    if (index >= this.props.items.length) {
      return null
    }
    const item = this.props.items[index]
    const children = this.props.renderItem(index, item)

    if (this.props.indexAsKey) {
      // if indexAsKey is set, just use index.
      return <React.Fragment key={String(index)}>{children}</React.Fragment>
    }
    if (item[this.props.keyProperty || 'key']) {
      const key = item[this.props.keyProperty]
      // otherwise, see if key is set on item directly.
      return <React.Fragment key={key}>{children}</React.Fragment>
    }
    // We still don't have a key. So hopefully renderItem will provide the key.
    logger.info(
      'Setting key from renderItem does not work on native. Please set it directly on items or use indexAsKey.'
    )
    return children
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
      <div style={collapseStyles([styles.outerDiv, this.props.style])}>
        <div style={globalStyles.fillAbsolute}>
          <div style={styles.innerDiv}>
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

const styles = styleSheetCreate({
  innerDiv: platformStyles({
    isElectron: {
      height: '100%',
      overflowY: 'auto',
      width: '100%',
    },
  }),
  outerDiv: {
    flexGrow: 1,
    position: 'relative',
  },
})

export default List
