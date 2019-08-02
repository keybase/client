import * as React from 'react'
import * as Styles from '../styles'
import ReactList from 'react-list'
import {Box2} from './box'
import ScrollView from './scroll-view'
import {Props} from './section-list'
import {debounce, throttle, once} from 'lodash-es'
import {memoize} from '../util/memoize'

/*
 * How this works: We take in the same data structure as RN does Array<Section> and flatten it into an array (this._flat)
 * We make 2 types 'body' and 'header' and bookkeep which header body parts are in. We then feed this into a react-list
 * If you have sticky headers on we extract whatever section you're currently in (by watching scroll). We render that item
 * as a sibling of the list. If you have wildly different header heights you'll definitely see things jumping around
 */

type State = {
  currentSectionFlatIndex: number
}

class SectionList extends React.Component<Props, State> {
  _flat: Array<any> = []
  state = {currentSectionFlatIndex: 0}
  _listRef: React.RefObject<any> = React.createRef()
  _mounted = true

  componentDidUpdate(prevProps: Props, _: State) {
    if (this.props.sections !== prevProps.sections) {
      // sections changed so let's also reset the onEndReached call
      this._onEndReached = once(() => this.props.onEndReached && this.props.onEndReached())
    }
    if (
      this.props.selectedIndex !== -1 &&
      this.props.selectedIndex !== prevProps.selectedIndex &&
      this.props.selectedIndex !== undefined &&
      this._listRef &&
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
  scrollToLocation() {
    console.warn('TODO desktop SectionList')
  }
  recordInteraction() {
    console.warn('TODO desktop SectionList')
  }
  flashScrollIndicators() {
    console.warn('TODO desktop SectionList')
  }
  /* =============================== */

  _itemRenderer = (index, _, renderingSticky) => {
    const item = this._flat[index]
    if (!item) {
      // data is switching out from under us. let things settle
      return null
    }
    const section = this._flat[item.flatSectionIndex]
    if (!section) {
      // data is switching out from under us. let things settle
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
        return <Box2 direction="vertical" key="stickyPlaceholder" />
      }
      return (
        <Box2
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
          {this.props.renderSectionHeader({section: section.section})}
        </Box2>
      )
    } else if (item.type === 'placeholder') {
      return (
        <Box2
          direction="vertical"
          key={`blankPlaceholder${item.flatSectionIndex}`}
          style={{height: 1}}
          fullWidth={true}
        />
      )
    } else {
      return (
        <Box2 direction="vertical" key={`${section.key}:${item.key}`} style={styles.box}>
          {(section.section.renderItem || this.props.renderItem)({
            index: item.indexWithinSection,
            item: item.item,
            section: section.section,
          })}
        </Box2>
      )
    }
  }

  _checkOnEndReached = throttle(target => {
    const diff = target.scrollHeight - (target.scrollTop + target.clientHeight)
    if (diff < 5) {
      this._onEndReached()
    }
  }, 100)

  // This matches the way onEndReached works for sectionlist on RN
  _onEndReached = once(() => this.props.onEndReached && this.props.onEndReached())

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

  _onScroll = e => {
    e.currentTarget && this._checkOnEndReached(e.currentTarget)
    this._checkStickyDebounced()
    this._checkStickyThrottled()
  }

  _flatten = memoize(sections => {
    this._flat = (sections || []).reduce((arr, section, sectionIndex) => {
      const flatSectionIndex = arr.length
      arr.push({
        flatSectionIndex,
        key:
          (this.props.keyExtractor && this.props.keyExtractor(section, sectionIndex)) ||
          section.key ||
          sectionIndex,
        section,
        type: 'header',
      })
      if (section.data.length) {
        arr.push(
          ...section.data.map((item, indexWithinSection) => ({
            flatSectionIndex,
            indexWithinSection,
            item,
            key:
              (this.props.keyExtractor && this.props.keyExtractor(item, indexWithinSection)) ||
              item.key ||
              indexWithinSection,
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
          key: 1,
          section: {
            data: [],
          },
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

  render() {
    this._flatten(this.props.sections)
    const stickyHeader =
      this.props.stickySectionHeadersEnabled &&
      this._itemRenderer(this.state.currentSectionFlatIndex, this.state.currentSectionFlatIndex, true)

    return (
      <Box2 direction="vertical" fullWidth={true} fullHeight={true} style={styles.container}>
        {this.props.disableAbsoluteStickyHeader && stickyHeader}
        <ScrollView
          style={Styles.collapseStyles([styles.scroll, this.props.style])}
          onScroll={this._onScroll}
        >
          {/*
          // @ts-ignore */}
          <ReactList
            itemRenderer={this._itemRenderer as any}
            itemSizeEstimator={this.props.itemSizeEstimator}
            length={this._flat.length}
            retrigger={this._flat}
            ref={this._listRef}
            type="variable"
          />
        </ScrollView>
        {!this.props.disableAbsoluteStickyHeader && stickyHeader}
      </Box2>
    )
  }
}

const styles = Styles.styleSheetCreate({
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
})

export default SectionList
