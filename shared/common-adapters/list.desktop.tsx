import * as Styles from '@/styles'
import * as React from 'react'
import SafeReactList from './safe-react-list'
import logger from '@/logger'
import once from 'lodash/once'
import throttle from 'lodash/throttle'
import type RL from 'react-list'
import type {Props} from './list'
import {renderElementOrComponentOrNot} from '@/util/util'

class List<T> extends React.PureComponent<Props<T>> {
  _list: RL | null = null
  _itemRender = (index: number, _: number | string): React.JSX.Element => {
    // ReactList has an issue where it caches the list length into its own state so can ask
    // for indices outside of the items...
    if (index >= this.props.items.length) {
      return <></>
    }
    const item = this.props.items[index]
    const children = item ? this.props.renderItem(index, item) : <></>

    if (this.props.indexAsKey) {
      // if indexAsKey is set, just use index.
      return <React.Fragment key={String(index)}>{children}</React.Fragment>
    }
    const keyProp = this.props.keyProperty || 'key'
    const i = item as {[key: string]: unknown} | undefined
    if (i?.[keyProp]) {
      const key = i[keyProp]
      // otherwise, see if key is set on item directly.
      return <React.Fragment key={String(key)}>{children}</React.Fragment>
    }
    // We still don't have a key. So hopefully renderItem will provide the key.
    logger.info(
      'Setting key from renderItem does not work on native. Please set it directly on items or use indexAsKey.'
    )
    return children
  }

  _setListRef = (r: RL | null) => {
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

  _checkOnEndReached = throttle((target: HTMLDivElement) => {
    const diff = target.scrollHeight - (target.scrollTop + target.clientHeight)
    if (diff < 5) {
      this._onEndReached()
    }
  }, 100)

  // This matches the way onEndReached works for flatlist on RN
  _onEndReached = once(() => this.props.onEndReached && this.props.onEndReached())

  _onScroll = (e: React.BaseSyntheticEvent<unknown, HTMLDivElement | undefined>) =>
    e.currentTarget && this._checkOnEndReached(e.currentTarget)

  render() {
    return (
      <div style={Styles.collapseStyles([styles.outerDiv, this.props.style]) as React.CSSProperties}>
        <div style={Styles.globalStyles.fillAbsolute}>
          <div
            style={
              Styles.collapseStyles([
                styles.innerDiv,
                this.props.contentContainerStyle,
              ]) as React.CSSProperties
            }
            onScroll={this.props.onEndReached ? this._onScroll : undefined}
          >
            {renderElementOrComponentOrNot(this.props.ListHeaderComponent)}
            <SafeReactList
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
