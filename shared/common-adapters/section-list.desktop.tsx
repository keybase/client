import * as React from 'react'
import * as Styles from '../styles'
import SafeReactList from './safe-react-list'
import {Box2} from './box'
import ScrollView from './scroll-view'
import debounce from 'lodash/debounce'
import throttle from 'lodash/throttle'
import once from 'lodash/once'
import {memoize} from '../util/memoize'
import {renderElementOrComponentOrNot} from '../util/util'
import type RL from 'react-list'
import type {Props, Section, ItemTFromSectionT} from './section-list'

const Kb = {
  Box2,
  ScrollView,
}

/*
 * How this works: We take in the same data structure as RN does Array<Section> and flatten it into an array (this._flat)
 * We make 2 types 'body' and 'header' and bookkeep which header body parts are in. We then feed this into a react-list
 * If you have sticky headers on we extract whatever section you're currently in (by watching scroll). We render that item
 * as a sibling of the list. If you have wildly different header heights you'll definitely see things jumping around
 */

type State = {
  currentSectionFlatIndex: number
}

class SectionList<T extends Section<any, any>> extends React.Component<Props<T>, State> {
  _flat: Array<FlatListElement<T>> = []
  _sectionIndexToFlatIndex: Array<number> = []
  state = {currentSectionFlatIndex: 0}
  _listRef = React.createRef<RL>()
  _mounted = true

  componentDidUpdate(prevProps: Props<T>, _: State) {
    if (this.props.sections !== prevProps.sections) {
      // sections changed so let's also reset the onEndReached call
      this._onEndReached = once(info => this.props.onEndReached?.(info))
    }
    if (
      this.props.selectedIndex !== -1 &&
      this.props.selectedIndex !== prevProps.selectedIndex &&
      this.props.selectedIndex !== undefined &&
      this._listRef.current
    ) {
      const index = this._itemIndexToFlatIndex(this.props.selectedIndex)
      // If index is 1, scroll to 0 instead to show the first section header as well.
      this._listRef.current.scrollAround(index === 1 ? 0 : index)
    }
  }

  componentWillUnmount() {
    this._mounted = false
  }

  /* Methods from native SectionList */
  scrollToLocation(params?: {sectionIndex: number}) {
    // TODO desktop SectionList is limited to sectionIndex
    const sectionIndex = params?.sectionIndex
    const flatIndex = sectionIndex && this._sectionIndexToFlatIndex[sectionIndex]
    if (typeof flatIndex === 'number') {
      this._listRef.current?.scrollTo(flatIndex)
    }
  }
  recordInteraction() {
    console.warn('TODO desktop SectionList')
  }
  flashScrollIndicators() {
    console.warn('TODO desktop SectionList')
  }
  /* =============================== */

  _itemRenderer = (index: number, _: number | string, renderingSticky: boolean): React.ReactElement => {
    const item = this._flat[index]
    if (!item) {
      // data is switching out from under us. let things settle
      // @ts-ignore
      return null
    }
    const section = this._flat[item.flatSectionIndex] as HeaderFlatListElement<T>
    if (!section) {
      // data is switching out from under us. let things settle
      // @ts-ignore
      return null
    }

    if (item.type === 'header') {
      if (
        this.props.stickySectionHeadersEnabled &&
        this.props.disableAbsoluteStickyHeader &&
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
            this.props.stickySectionHeadersEnabled &&
            !this.props.disableAbsoluteStickyHeader &&
            renderingSticky
              ? styles.stickyBox
              : styles.box
          }
          fullWidth={true}
        >
          {this.props.renderSectionHeader?.({section: item.section})}
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
          {
            // @ts-ignore TODO fix this
            (section.section.renderItem || this.props.renderItem)({
              index: item.indexWithinSection,
              item: item.item,
              section: section.section,
            })
          }
        </Kb.Box2>
      )
    }
  }

  _checkOnEndReached = throttle((target: HTMLDivElement) => {
    const diff = target.scrollHeight - (target.scrollTop + target.clientHeight)
    if (diff < 5) {
      this._onEndReached({distanceFromEnd: diff})
    }
  }, 100)

  // This matches the way onEndReached works for sectionlist on RN
  _onEndReached = once(info => this.props.onEndReached?.(info))

  _checkSticky = () => {
    if (this._listRef.current) {
      const [firstIndex] = this._listRef.current.getVisibleRange()
      const item = this._flat[firstIndex]
      if (item) {
        this.setState(p =>
          p.currentSectionFlatIndex !== item.flatSectionIndex
            ? {currentSectionFlatIndex: item.flatSectionIndex}
            : null
        )
      }
    }
  }
  // We use two "throttled" functions here to check the status of the viewable items in the
  // list for the purposes of the sticky header feature. A single throttle isn't good enough,
  // since the last scroll could end up on a throttle border and only be delayed a small amount. If that
  // happens we can render the header twice, since we will think we are in the wrong section. The debounce
  // fixes this, since it will always send one last call out on the time interval. We can't just use a
  // single debounce though, since we need events as the user is scrolling.
  _checkStickyDebounced = debounce(this._checkSticky, 20)
  _checkStickyThrottled = throttle(this._checkSticky, 20)

  private triggerOnSectionChangeIfNeeded() {
    if (!this.props.onSectionChange) {
      return
    }
    const visibleRange = this._listRef.current?.getVisibleRange()
    const sectionIndex = this._flat[visibleRange?.[0] ?? -1]?.sectionIndex ?? -1
    const section = this.props.sections[sectionIndex]
    section && this.props.onSectionChange(section)
  }

  private onScrollDelayed = () => {
    if (!this._mounted) {
      return
    }
    this.triggerOnSectionChangeIfNeeded()
    this._checkStickyDebounced()
    this._checkStickyThrottled()
  }

  private onScroll = (e: {currentTarget?: HTMLDivElement}) => {
    e.currentTarget && this._checkOnEndReached(e.currentTarget)
    // getVisibleRange() is racy, so delay it.
    setTimeout(() => this.onScrollDelayed())
  }

  _flatten = memoize((sections: ReadonlyArray<T>) => {
    this._sectionIndexToFlatIndex = []
    this._flat = (sections || []).reduce<Array<FlatListElement<T>>>((arr, section, sectionIndex) => {
      const flatSectionIndex = arr.length
      this._sectionIndexToFlatIndex.push(flatSectionIndex)
      arr.push({
        flatSectionIndex,
        // @ts-ignore TODO fix this
        key: this.props.sectionKeyExtractor?.(section, sectionIndex) || section.key || sectionIndex,
        section,
        sectionIndex,
        type: 'header',
      })
      // @ts-ignore TODO fix this
      if (section.data.length) {
        arr.push(
          // @ts-ignore TODO fix this
          ...section.data.map((item: ItemTFromSectionT<T>, indexWithinSection) => ({
            flatSectionIndex,
            indexWithinSection,
            item,
            key:
              this.props.keyExtractor?.(item, indexWithinSection) ||
              // @ts-ignore
              item.key ||
              `${sectionIndex}-${indexWithinSection}`,
            sectionIndex,
            type: 'body',
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
  })

  _itemIndexToFlatIndex = (index: number) => {
    if (index < 0) {
      return 0
    }
    for (let i = 0; i < this._flat.length; i++) {
      const item = this._flat[i]
      if (item.type === 'body') {
        // are we there yet?
        if (index === 0) {
          return i // yes
        }
        --index // no
      }
    }
    return this._flat.length - 1
  }

  private getItemSizeGetter = () => {
    const {getItemHeight, getSectionHeaderHeight} = this.props
    return getItemHeight && getSectionHeaderHeight
      ? (index: number): number => {
          const item = this._flat[index]
          if (!item) {
            // data is switching out from under us. let things settle
            return 0
          }
          return item.type === 'header'
            ? getSectionHeaderHeight(item.sectionIndex)
            : item.type === 'body'
            ? getItemHeight(item.item, item.sectionIndex, item.indexWithinSection)
            : 0
        }
      : undefined
  }

  render() {
    this._flatten(this.props.sections)
    const stickyHeader =
      this.props.stickySectionHeadersEnabled &&
      this._itemRenderer(this.state.currentSectionFlatIndex, this.state.currentSectionFlatIndex, true)

    return (
      <Kb.Box2 direction="vertical" fullWidth={true} fullHeight={true} style={styles.container}>
        {this.props.disableAbsoluteStickyHeader && stickyHeader}
        <Kb.ScrollView
          contentContainerStyle={this.props.contentContainerStyle}
          style={Styles.collapseStyles([styles.scroll, this.props.style])}
          onScroll={this.onScroll}
        >
          {renderElementOrComponentOrNot(this.props.ListHeaderComponent)}
          <SafeReactList
            itemRenderer={(index, key) => this._itemRenderer(index, key, false)}
            itemSizeEstimator={this.props.desktopItemSizeEstimatorOverride}
            itemSizeGetter={this.getItemSizeGetter()}
            length={this._flat.length}
            // @ts-ignore
            retrigger={this._flat}
            ref={this._listRef}
            type={this.props.desktopReactListTypeOverride ?? 'variable'}
          />
        </Kb.ScrollView>
        {!this.props.disableAbsoluteStickyHeader && stickyHeader}
      </Kb.Box2>
    )
  }
}

type HeaderFlatListElement<T> = {
  flatSectionIndex: number
  key: React.Key
  section: T
  sectionIndex: number
  type: 'header'
}
type FlatListElement<T> =
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
    } as const)
)

export default SectionList
