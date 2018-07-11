// @flow
import * as React from 'react'
import ReactList from 'react-list'
import Box from './box'
import ScrollView from './scroll-view'
import type {Props} from './section-list'
import {platformStyles, styleSheetCreate} from '../styles'

type State = {
  items: any[][],
}
class SectionList extends React.Component<Props, State> {
  state = {items: [[]]}

  componentDidMount() {
    this._storeItems()
  }

  componentDidUpdate(prevProps: Props, prevState: State) {
    if (prevProps.sections !== this.props.sections) {
      this._storeItems()
    }
  }

  _makeItems = () => {
    return this.props.sections.reduce(
      (arr, section, sectionIndex) => {
        const next = []
        next.push({type: 'header', sectionIndex})
        section.data.length && next.push(...section.data.map(item => ({item, sectionIndex, type: 'body'})))
        arr.push(next)
        return arr
      },
      [[]]
    )
  }

  _storeItems = () => this.setState({items: this._makeItems()})

  _itemRenderer = (itemsIndex: number) => (index, key) => {
    const item = this.state.items[itemsIndex][index]
    const section = this.props.sections[item.sectionIndex]
    const indexWithinSection = section.data.indexOf(item.item)
    return item.type === 'header' ? (
      <Box style={styles.sectionHeader}>{this.props.renderSectionHeader({section})}</Box>
    ) : (
      this.props.renderItem({index: indexWithinSection, item: item.item, section})
    )
  }

  render() {
    return (
      <ScrollView>
        {this.state.items.map((item, index) => (
          <ReactList key={index} itemRenderer={this._itemRenderer(index)} length={item.length} />
        ))}
      </ScrollView>
    )
  }
}

const styles = styleSheetCreate({
  sectionHeader: platformStyles({
    isElectron: {
      position: 'sticky',
      top: -1,
      zIndex: '1', // needed to be on top of newly created stacking context
    },
  }),
})

export default SectionList
