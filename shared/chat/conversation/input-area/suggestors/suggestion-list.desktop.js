// @flow
import * as React from 'react'
import ReactList from 'react-list'
import * as Kb from '../../../../common-adapters'
import * as Styles from '../../../../styles'
import type {Props} from './suggestion-list'

class SuggestionList extends React.Component<Props> {
  _listRef = React.createRef<ReactList>()

  componentDidUpdate(prevProps: Props) {
    if (prevProps.selectedIndex !== this.props.selectedIndex && this._listRef.current) {
      this._listRef.current.scrollAround(this.props.selectedIndex)
    }
  }

  render() {
    return (
      <Kb.ScrollView style={Styles.collapseStyles([styles.fullHeight, this.props.style])}>
        <ReactList
          ref={this._listRef}
          itemRenderer={index => this.props.renderItem(index, this.props.items[index])}
          length={this.props.items.length}
        />
      </Kb.ScrollView>
    )
  }
}

const styles = Styles.styleSheetCreate({
  fullHeight: {
    height: '100%',
  },
})

export default SuggestionList
