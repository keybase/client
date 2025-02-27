import * as React from 'react'
import {useThrottledCallback} from 'use-debounce'
import * as Styles from '@/styles'
import SafeReactList from './safe-react-list'
import {Box2} from './box'
import ScrollView from './scroll-view'
import once from 'lodash/once'
import noop from 'lodash/noop'
import {renderElementOrComponentOrNot} from '@/util/util'
import type RL from 'react-list'
import type {Props, Section, ItemTFromSectionT} from './section-list'

const Kb = {Box2, ScrollView}

/*
 * How this works: We take in the same data structure as RN does Array<Section> and flatten it into an array (this._flat)
 * We make 2 types 'body' and 'header' and bookkeep which header body parts are in. We then feed this into a react-list
 * If you have sticky headers on we extract whatever section you're currently in (by watching scroll). We render that item
 * as a sibling of the list. If you have wildly different header heights you'll definitely see things jumping around
 */
// @ts-ignore
const SectionList = React.forwardRef<any, any>(function SectionList<T extends Section<any>>(
  props: Props<T>,
  ref: React.Ref<any>
) {
  const {sectionKeyExtractor, keyExtractor} = props
  const {sections, selectedIndex, stickySectionHeadersEnabled} = props
  const {disableAbsoluteStickyHeader, renderSectionHeader, renderItem, onEndReached, getItemHeight} = props
  const {onSectionChange, getSectionHeaderHeight, desktopItemSizeEstimatorOverride} = props
  const {desktopReactListTypeOverride, contentContainerStyle, style, ListHeaderComponent} = props

  const {sectionIndexToFlatIndex, flat} = React.useMemo(() => {
    const sectionIndexToFlatIndex = new Array<number>()
    const flat = sections.reduce<Array<FlatListElement<T>>>((arr, section, sectionIndex) => {
      const flatSectionIndex = arr.length
      sectionIndexToFlatIndex.push(flatSectionIndex)
      arr.push({
        flatSectionIndex,
        key: sectionKeyExtractor?.(section, sectionIndex) || section.key || sectionIndex,
        section,
        sectionIndex,
        type: 'header',
      })
      if (section.data.length) {
        arr.push(
          ...section.data.map((item: ItemTFromSectionT<T>, indexWithinSection) => ({
            flatSectionIndex,
            indexWithinSection,
            item,
            key:
              keyExtractor?.(item, indexWithinSection) ||
              (item as {key?: string}).key ||
              `${sectionIndex}-${indexWithinSection}`,
            sectionIndex,
            type: 'body' as const,
          }))
        )
      } else {
        // These placeholders allow us to get the first section's sticky header back on the screen if
        // the item has no body items. Since we don't draw it in _itemRenderer (to avoid duplicating it
        // all the time), we need something in the ReactList to trigger the flatSectionIndex check
        // to get the sticky header back on the screen.
        arr.push({
          flatSectionIndex,
          sectionIndex,
          type: 'placeholder',
        })
      }
      return arr
    }, [])
    return {flat, sectionIndexToFlatIndex}
  }, [sections, sectionKeyExtractor, keyExtractor])

  const listRef = React.useRef<RL>(null)
  const [currentSectionFlatIndex, setCurrentSectionFlatIndex] = React.useState(0)
  const mountedRef = React.useRef(true)

  React.useImperativeHandle(ref, () => {
    return {
      scrollToLocation: (params?: {sectionIndex: number}) => {
        // TODO desktop SectionList is limited to sectionIndex
        const sectionIndex = params?.sectionIndex
        const flatIndex = sectionIndex && sectionIndexToFlatIndex[sectionIndex]
        if (typeof flatIndex === 'number') {
          listRef.current?.scrollTo(flatIndex)
        }
      },
    }
  }, [sectionIndexToFlatIndex])

  const _onEndReached = React.useRef(once((info: {distanceFromEnd: number}) => onEndReached?.(info)))

  const _itemIndexToFlatIndex = React.useCallback(
    (_index: number) => {
      let index = _index
      if (index < 0) {
        return 0
      }
      for (let i = 0; i < flat.length; i++) {
        const item = flat[i]!
        if (item.type === 'body') {
          // are we there yet?
          if (index === 0) {
            return i // yes
          }
          --index // no
        }
      }
      return flat.length - 1
    },
    [flat]
  )
  const lastSectionsRef = React.useRef(sections)
  const lastSelectedIndexRef = React.useRef(selectedIndex)
  React.useEffect(() => {
    if (lastSectionsRef.current !== sections) {
      // sections changed so let's also reset the onEndReached call
      _onEndReached.current = once((info: {distanceFromEnd: number}) => onEndReached?.(info))
    }
    if (
      selectedIndex !== -1 &&
      selectedIndex !== lastSelectedIndexRef.current &&
      selectedIndex !== undefined &&
      listRef.current
    ) {
      const index = _itemIndexToFlatIndex(selectedIndex)
      // If index is 1, scroll to 0 instead to show the first section header as well.
      listRef.current.scrollAround(index === 1 ? 0 : index)
    }

    lastSectionsRef.current = sections
    lastSelectedIndexRef.current = selectedIndex
  }, [sections, selectedIndex, listRef, _itemIndexToFlatIndex, onEndReached])

  React.useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
    }
  }, [mountedRef])

  const _checkOnEndReached = useThrottledCallback((target: HTMLDivElement) => {
    const diff = target.scrollHeight - (target.scrollTop + target.clientHeight)
    if (diff < 5) {
      _onEndReached.current({distanceFromEnd: diff})
    }
  }, 100)

  const _checkSticky = React.useCallback(() => {
    if (listRef.current) {
      const [firstIndex] = listRef.current.getVisibleRange()
      if (firstIndex === undefined) return
      const item = flat[firstIndex]
      if (item) {
        setCurrentSectionFlatIndex(item.flatSectionIndex)
      }
    }
  }, [listRef, flat, setCurrentSectionFlatIndex])

  const _checkStickyThrottled = useThrottledCallback(_checkSticky, 20)

  const triggerOnSectionChangeIfNeeded = React.useCallback(() => {
    if (!onSectionChange) {
      return
    }
    const visibleRange = listRef.current?.getVisibleRange()
    const sectionIndex = flat[visibleRange?.[0] ?? -1]?.sectionIndex ?? -1
    const section = sections[sectionIndex]
    section && onSectionChange(section)
  }, [onSectionChange, listRef, flat, sections])

  const onScrollDelayed = React.useCallback(() => {
    if (!mountedRef.current) {
      return
    }
    triggerOnSectionChangeIfNeeded()
    _checkStickyThrottled()
  }, [mountedRef, triggerOnSectionChangeIfNeeded, _checkStickyThrottled])

  const onScroll = React.useCallback(
    (e: {currentTarget?: HTMLDivElement}) => {
      e.currentTarget && _checkOnEndReached(e.currentTarget)
      // getVisibleRange() is racy, so delay it.
      setTimeout(() => onScrollDelayed(), 0)
    },
    [onScrollDelayed, _checkOnEndReached]
  )

  const getItemSizeGetter = React.useCallback(
    (index: number) => {
      if (!getItemHeight || !getSectionHeaderHeight) return 0
      const item = flat[index]
      if (!item) {
        // data is switching out from under us. let things settle
        return 0
      }
      return item.type === 'header'
        ? getSectionHeaderHeight(item.sectionIndex)
        : item.type === 'body'
          ? getItemHeight(item.item, item.sectionIndex, item.indexWithinSection)
          : 0
    },
    [getItemHeight, getSectionHeaderHeight, flat]
  )

  const _itemRenderer = React.useCallback(
    (index: number, _: number | string, renderingSticky: boolean): React.ReactElement => {
      const item = flat[index]
      if (!item) {
        // data is switching out from under us. let things settle
        return <></>
      }
      const section = flat[item.flatSectionIndex] as HeaderFlatListElement<T> | undefined
      if (!section) {
        // data is switching out from under us. let things settle
        return <></>
      }

      if (item.type === 'header') {
        if (
          stickySectionHeadersEnabled &&
          disableAbsoluteStickyHeader &&
          !renderingSticky &&
          item.flatSectionIndex === 0
        ) {
          // don't render the first one since its always there
          return <Kb.Box2 direction="vertical" key="stickyPlaceholder" />
        }
        return (
          <Kb.Box2
            direction="vertical"
            key={`${renderingSticky ? 'sticky:' : ''}${item.key}:`}
            style={
              stickySectionHeadersEnabled && !disableAbsoluteStickyHeader && renderingSticky
                ? styles.stickyBox
                : styles.box
            }
            fullWidth={true}
          >
            {renderSectionHeader?.({section: item.section})}
          </Kb.Box2>
        )
      } else if (item.type === 'placeholder') {
        return (
          <Kb.Box2
            direction="vertical"
            key={`blankPlaceholder${item.flatSectionIndex}`}
            style={{height: 1}}
            fullWidth={true}
          />
        )
      } else {
        return (
          <Kb.Box2 direction="vertical" key={`${section.key}:${item.key}`} style={styles.box}>
            {(section.section.renderItem || renderItem)?.({
              index: item.indexWithinSection,
              item: item.item,
              // eslint-disable-next-line
              section: section.section as any,
              separators: {
                highlight: noop,
                unhighlight: noop,
                updateProps: noop,
              },
            })}
          </Kb.Box2>
        )
      }
    },
    [stickySectionHeadersEnabled, disableAbsoluteStickyHeader, renderSectionHeader, renderItem, flat]
  )

  const itemRenderer = React.useCallback(
    (index: number, key: string | number) => _itemRenderer(index, key, false),
    [_itemRenderer]
  )

  const stickyHeader =
    stickySectionHeadersEnabled && _itemRenderer(currentSectionFlatIndex, currentSectionFlatIndex, true)

  return (
    <Kb.Box2 direction="vertical" fullWidth={true} fullHeight={true} style={styles.container}>
      {disableAbsoluteStickyHeader && stickyHeader}
      <Kb.ScrollView
        contentContainerStyle={contentContainerStyle}
        style={Styles.collapseStyles([styles.scroll, style])}
        onScroll={onScroll}
      >
        {renderElementOrComponentOrNot(ListHeaderComponent)}
        <SafeReactList
          itemRenderer={itemRenderer}
          itemSizeEstimator={desktopItemSizeEstimatorOverride}
          itemSizeGetter={getItemHeight && getSectionHeaderHeight ? getItemSizeGetter : undefined}
          length={flat.length}
          extraData={flat}
          ref={listRef}
          type={desktopReactListTypeOverride ?? 'variable'}
        />
      </Kb.ScrollView>
      {!disableAbsoluteStickyHeader && stickyHeader}
    </Kb.Box2>
  )
})

type HeaderFlatListElement<SectionT extends Section<any>> = {
  flatSectionIndex: number
  key: React.Key
  section: SectionT
  sectionIndex: number
  type: 'header'
}

type FlatListElement<T extends Section<any>> =
  | {
      flatSectionIndex: number
      indexWithinSection: number
      item: ItemTFromSectionT<T>
      key: React.Key
      sectionIndex: number
      type: 'body'
    }
  | HeaderFlatListElement<T>
  | {
      flatSectionIndex: number
      sectionIndex: number
      type: 'placeholder'
    }

const styles = Styles.styleSheetCreate(
  () =>
    ({
      box: {
        alignSelf: 'stretch',
        flexShrink: 0,
      },
      container: {
        alignSelf: 'flex-start',
        position: 'relative',
      },
      scroll: {
        flexGrow: 1,
      },
      stickyBox: {
        left: 0,
        position: 'absolute',
        top: 0,
      },
    }) as const
)

export default SectionList
