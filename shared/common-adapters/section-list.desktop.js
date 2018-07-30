// @flow
import * as React from 'react'
import ReactList from 'react-list'
import Box from './box'
import ScrollView from './scroll-view'
import type {Props} from './section-list'
import {platformStyles, styleSheetCreate} from '../styles'

// NOTE: this ReactList is of type `simple` (by default)
// setting it to `variable` or something more complex
// causes the section headers to disappear once they
// are out of the viewport. This means that, while new
// items are incrementally rendered on scrolldown, nodes
// are never recycled, so none will be removed from the
// DOM as they leave the viewport. This makes performance
// very bad for lists that are long.

// TODO do some exploration into how we can fix that ^

type State = {
  items: any[],
}
class SectionList extends React.Component<Props, State> {
  state = {items: []}

  componentDidMount() {
    this._storeItems()
  }

  componentDidUpdate(prevProps: Props, prevState: State) {
    if (prevProps.sections !== this.props.sections) {
      this._storeItems()
    }
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

  _makeItems = () => {
    return this.props.sections.reduce((arr, section, sectionIndex) => {
      arr.push({sectionIndex, key: section.key || sectionIndex, type: 'header'})
      section.data.length && arr.push(...section.data.map(item => ({item, sectionIndex, type: 'body'})))
      return arr
    }, [])
  }

  _storeItems = () => this.setState({items: this._makeItems()})

  _itemRenderer = (index, key) => {
    const item = this.state.items[index]
    const section = this.props.sections[item.sectionIndex]
    if (!section) {
      // data is switching out from under us. let things settle
      return null
    }
    const indexWithinSection = section.data.indexOf(item.item)
    return item.type === 'header' ? (
      <Box key={item.key || key} style={styles.sectionHeader}>
        {this.props.renderSectionHeader({section})}
      </Box>
    ) : (
      this.props.renderItem({index: indexWithinSection, item: item.item, section})
    )
  }

  render() {
    return (
      <ScrollView style={styles.fullHeight}>
        <ReactList itemRenderer={this._itemRenderer} length={this.state.items.length} />
      </ScrollView>
    )
  }
}

const styles = styleSheetCreate({
  fullHeight: {
    height: '100%',
  },
  sectionHeader: platformStyles({
    isElectron: {
      position: 'sticky',
      top: 0,
      zIndex: 1, // needed to be on top of newly created stacking context
    },
  }),
})

export default SectionList
