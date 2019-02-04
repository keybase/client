// @flow
import * as React from 'react'
import * as Styles from '../styles'
import ReactList from 'react-list'
import {Box2} from './box'
import ScrollView from './scroll-view'
import type {Props} from './section-list'
import {throttle, once} from 'lodash-es'
import {memoize} from '../util/memoize'

/*
 * How this works: We take in the same data structure as RN does Array<Section> and flatten it into an array (this._flat)
 * We make 2 types 'body' and 'header' and bookkeep which header body parts are in. We then feed this into a react-list
 * If you have sticky headers on we extract whatever section you're currently in (by watching scroll). We render that item
 * as a sibling of the list. If you have wildly different header heights you'll definitely see things jumping around
 */

type State = {
  currentSectionFlatIndex: number,
}
class SectionList extends React.Component<Props, State> {
  _flat = []
  state = {currentSectionFlatIndex: 0}
  _listRef = React.createRef()
  _mounted = true

  componentDidUpdate(prevProps: Props, prevState: State) {
    if (this.props.items !== prevProps.items) {
      // Items changed so let's also reset the onEndReached call
      this._onEndReached = once(() => this.props.onEndReached && this.props.onEndReached())
    }
  }

  componentWillUnmount() {
    this._mounted = false
  }

  /* Methods from native SectionList */
  scrollToLocation(params: any) {
    console.warn('TODO desktop SectionList')
  }
  recordInteraction() {
    console.warn('TODO desktop SectionList')
  }
  flashScrollIndicators() {
    console.warn('TODO desktop SectionList')
  }
  /* =============================== */

  _itemRenderer = (index, renderingSticky) => {
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
      if (this.props.stickySectionHeadersEnabled && !renderingSticky && item.flatSectionIndex === 0) {
        // don't render the first one since its always there
        return null
      }
      return (
        <Box2 direction="vertical" key={`${renderingSticky ? 'sticky:' : ''}${item.key}:`} style={styles.box}>
          {this.props.renderSectionHeader({section: section.section})}
        </Box2>
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

  _checkSticky = throttle(() => {
    // need to defer this as the list itself is changing after scroll
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
  }, 20)

  _onScroll = e => {
    e.currentTarget && this._checkOnEndReached(e.currentTarget)
    this._checkSticky()
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
      section.data.length &&
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
      return arr
    }, [])
  })

  render() {
    this._flatten(this.props.sections)
    const stickyHeader =
      this.props.stickySectionHeadersEnabled && this._itemRenderer(this.state.currentSectionFlatIndex, true)

    return (
      <Box2 direction="vertical" fullWidth={true} fullHeight={true} style={styles.container}>
        {stickyHeader}
        <ScrollView
          style={Styles.collapseStyles([styles.scroll, this.props.style])}
          onScroll={this._onScroll}
        >
          <ReactList
            itemRenderer={this._itemRenderer}
            length={this._flat.length}
            retrigger={this._flat}
            ref={this._listRef}
            type="variable"
          />
        </ScrollView>
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
  },
  scroll: {
    flexGrow: 1,
  },
})

export default SectionList
