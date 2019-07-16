import React, {PureComponent} from 'react'
import ReactList from 'react-list'
import {globalStyles, collapseStyles, styleSheetCreate, platformStyles} from '../styles'
import logger from '../logger'
import {throttle, once} from 'lodash-es'

import {Props} from './list'

class List extends PureComponent<Props<any>> {
  _list: ReactList | null = null
  _itemRender = index => {
    // ReactList has an issue where it caches the list length into its own state so can ask
    // for indices outside of the items...
    if (index >= this.props.items.length) {
      return null
    }
    const item = this.props.items[index]
    let children

    // If we're in dev, let's warn if we're using margins (not supported by react-list)
    if (__DEV__ && !!this.props.itemSizeEstimator) {
      const renderedItem = this.props.renderItem(index, item)
      // @ts-ignore - Not every rendered item has props
      if (renderedItem && renderedItem.props && renderedItem.props.style) {
        // @ts-ignore - Not every rendered item has props
        const hasMargin = Object.keys(renderedItem.props.style).some(styleProp => styleProp.match(/^margin/))
        hasMargin &&
          console.warn(
            `Item at ${index} (key: ${
              item[this.props.keyProperty || 'key']
            }) has margins. Margins do not work on react-list`
          )
      }

      children = renderedItem
    } else {
      children = this.props.renderItem(index, item)
    }

    if (this.props.indexAsKey) {
      // if indexAsKey is set, just use index.
      return <React.Fragment key={String(index)}>{children}</React.Fragment>
    }
    const keyProp = this.props.keyProperty || 'key'
    if (item[keyProp]) {
      const key = item[keyProp]
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
      this.props.selectedIndex !== undefined &&
        this._list &&
        this._list.scrollAround(this.props.selectedIndex)
    }

    if (this.props.items !== prevProps.items) {
      // Items changed so let's also reset the onEndReached call
      this._onEndReached = once(() => this.props.onEndReached && this.props.onEndReached())
    }
  }

  _getType() {
    if (this.props.itemSizeEstimator) {
      return 'variable'
    }
    return this.props.fixedHeight ? 'uniform' : 'simple'
  }

  _checkOnEndReached = throttle(target => {
    const diff = target.scrollHeight - (target.scrollTop + target.clientHeight)
    if (diff < 5) {
      this._onEndReached()
    }
  }, 100)

  // This matches the way onEndReached works for flatlist on RN
  _onEndReached = once(() => this.props.onEndReached && this.props.onEndReached())

  _onScroll = e => e.currentTarget && this._checkOnEndReached(e.currentTarget)

  render() {
    return (
      <div style={collapseStyles([styles.outerDiv, this.props.style])}>
        <div style={globalStyles.fillAbsolute}>
          <div
            style={collapseStyles([styles.innerDiv, this.props.contentContainerStyle])}
            onScroll={this.props.onEndReached ? this._onScroll : undefined}
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
