import React, {PureComponent} from 'react'
import ReactList from 'react-list'
import * as Styles from '../styles'
import logger from '../logger'
import throttle from 'lodash/throttle'
import once from 'lodash/once'
import {renderElementOrComponentOrNot} from '../util/util'

import {Props} from './list'

class List extends PureComponent<Props<any>> {
  _list: ReactList | null = null
  _itemRender = (index: number, _: number | string): JSX.Element => {
    // ReactList has an issue where it caches the list length into its own state so can ask
    // for indices outside of the items...
    if (index >= this.props.items.length) {
      // @ts-ignore
      return null
    }
    const item = this.props.items[index]
    const children = this.props.renderItem(index, item)

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
      <div style={Styles.collapseStyles([styles.outerDiv, this.props.style])}>
        <div style={Styles.globalStyles.fillAbsolute}>
          <div
            style={Styles.collapseStyles([styles.innerDiv, this.props.contentContainerStyle])}
            onScroll={this.props.onEndReached ? this._onScroll : undefined}
          >
            {renderElementOrComponentOrNot(this.props.ListHeaderComponent)}
            <ReactList
              ref={this._setListRef}
              useTranslate3d={false}
              useStaticSize={!!this.props.fixedHeight}
              itemRenderer={this._itemRender}
              length={this.props.items.length}
              type={this._getType()}
            />
          </div>
        </div>
      </div>
    )
  }
}

const styles = Styles.styleSheetCreate(() => ({
  innerDiv: Styles.platformStyles({
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
}))

export default List
