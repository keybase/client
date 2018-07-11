// @flow
import * as React from 'react'
import ReactList from 'react-list'
import ScrollView from './scroll-view'
import type {Props} from './section-list'

type State = {
  items: any[],
}
export default class extends React.Component<Props, State> {
  state = {items: []}

  componentDidMount() {
    this._storeItems()
  }

  componentDidUpdate(prevProps: Props, prevState: State) {
    if (prevProps.sections !== this.props.sections) {
      this._storeItems()
    }
  }

  _makeItems = () => {
    return this.props.sections.reduce((arr, section, sectionIndex) => {
      arr.push({type: 'header', sectionIndex})
      section.data.length && arr.push(...section.data.map(item => ({item, sectionIndex, type: 'body'})))
      return arr
    }, [])
  }

  _storeItems = () => this.setState({items: this._makeItems()})

  _itemRenderer = (index, key) => {
    const item = this.state.items[index]
    const section = this.props.sections[item.sectionIndex]
    const indexWithinSection = section.data.indexOf(item.item)
    return item.type === 'header'
      ? this.props.renderSectionHeader({section})
      : this.props.renderItem({index: indexWithinSection, item: item.item, section})
  }

  render() {
    return (
      <ScrollView>
        <ReactList itemRenderer={this._itemRenderer} length={this.state.items.length} />
      </ScrollView>
    )
  }
}
