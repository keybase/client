import * as Styles from '@/styles'
import * as React from 'react'
import SafeReactList from './safe-react-list'
import logger from '@/logger'
import type RL from 'react-list'
import type {Props} from './list'
import {renderElementOrComponentOrNot} from '@/util/util'
import {useThrottledCallback} from 'use-debounce'

const List = React.memo(function List<T>(p: Props<T>) {
  const {
    items,
    renderItem,
    indexAsKey,
    keyProperty,
    fixedHeight,
    onEndReached: _onEndReached,
    selectedIndex,
  } = p
  const listRef = React.useRef<RL>(null)

  const itemRender = React.useCallback(
    (index: number, _: number | string): React.JSX.Element => {
      // ReactList has an issue where it caches the list length into its own state so can ask
      // for indices outside of the items...
      if (index >= items.length) {
        return <></>
      }
      const item = items[index]
      const children = item ? renderItem(index, item) : <></>

      if (indexAsKey) {
        // if indexAsKey is set, just use index.
        return <React.Fragment key={String(index)}>{children}</React.Fragment>
      }
      const keyProp = keyProperty || 'key'
      const i = item as {[key: string]: unknown} | undefined
      if (i?.[keyProp]) {
        const key: unknown = i[keyProp]
        // otherwise, see if key is set on item directly.
        return <React.Fragment key={String(key)}>{children}</React.Fragment>
      }
      // We still don't have a key. So hopefully renderItem will provide the key.
      logger.info(
        'Setting key from renderItem does not work on native. Please set it directly on items or use indexAsKey.'
      )
      return children
    },
    [items, renderItem, indexAsKey, keyProperty]
  )

  const lastSelectedIndexRef = React.useRef(selectedIndex)
  React.useEffect(() => {
    if (selectedIndex !== -1 && selectedIndex !== lastSelectedIndexRef.current) {
      lastSelectedIndexRef.current = selectedIndex
      if (selectedIndex !== undefined) {
        listRef.current?.scrollAround(selectedIndex)
      }
    }
  }, [selectedIndex])

  const type = fixedHeight ? 'uniform' : 'simple'
  const didOnEndReadchedRef = React.useRef(false)

  React.useEffect(() => {
    didOnEndReadchedRef.current = false
  }, [items])

  const onScroll = useThrottledCallback(
    (e: React.BaseSyntheticEvent<unknown, HTMLDivElement | undefined>) => {
      if (didOnEndReadchedRef.current) return
      const target = e.currentTarget
      if (!target) return
      const diff = target.scrollHeight - (target.scrollTop + target.clientHeight)
      if (diff < 5) {
        didOnEndReadchedRef.current = true
        _onEndReached?.()
      }
    },
    100
  )

  return (
    <div style={Styles.collapseStyles([styles.outerDiv, p.style]) as React.CSSProperties}>
      <div style={Styles.globalStyles.fillAbsolute}>
        <div
          style={Styles.collapseStyles([styles.innerDiv, p.contentContainerStyle]) as React.CSSProperties}
          onScroll={_onEndReached ? onScroll : undefined}
        >
          {renderElementOrComponentOrNot(p.ListHeaderComponent)}
          <SafeReactList
            ref={listRef}
            useTranslate3d={false}
            useStaticSize={!!fixedHeight}
            itemRenderer={itemRender}
            length={items.length}
            type={type}
          />
        </div>
      </div>
    </div>
  )
})

const styles = Styles.styleSheetCreate(
  () =>
    ({
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
    }) as const
)

export default List
