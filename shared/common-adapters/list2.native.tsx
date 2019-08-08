import React, {PureComponent} from 'react'
import * as Flow from '../util/flow'
import {FlatList, View} from 'react-native'
import * as Styles from '../styles'
import {smallHeight, largeHeight} from './list-item2'

import {Props} from './list2'

class List2<T> extends PureComponent<Props<T>> {
  static defaultProps = {
    keyboardShouldPersistTaps: 'handled',
  }

  _itemRender = ({item, index}: {item: T; index: number}) => {
    return this.props.renderItem(index, item)
  }

  _getItemLayout = (data: Array<T> | null, index: number) => {
    switch (this.props.itemHeight.type) {
      case 'fixed':
        return {index, length: this.props.itemHeight.height, offset: this.props.itemHeight.height * index}
      case 'fixedListItem2Auto': {
        const itemHeight = this.props.itemHeight.sizeType === 'Large' ? largeHeight : smallHeight
        return {index, length: itemHeight, offset: itemHeight * index}
      }
      case 'variable':
        return {index, ...this.props.itemHeight.getItemLayout(index, data ? data[index] : undefined)}
      default:
        Flow.ifFlowComplainsAboutThisFunctionYouHaventHandledAllCasesInASwitch(this.props.itemHeight)
        return {index, length: 0, offset: 0}
    }
  }

  _keyExtractor = (item: T, index: number) => {
    if (this.props.indexAsKey || !item) {
      return String(index)
    }

    const keyProp = this.props.keyProperty || 'key'
    return item[keyProp]
  }

  render() {
    return (
      <View style={styles.outerView}>
        {/* need windowSize so iphone 6 doesn't have OOM issues */}
        <FlatList
          bounces={this.props.bounces}
          renderItem={this._itemRender}
          data={this.props.items}
          getItemLayout={(data, index) => this._getItemLayout(data, index)}
          keyExtractor={this._keyExtractor}
          keyboardShouldPersistTaps={this.props.keyboardShouldPersistTaps}
          onEndReached={this.props.onEndReached}
          windowSize={this.props.windowSize || 10}
          debug={false /* set to true to debug the list */}
          // @ts-ignore TODO fix styles
          contentContainerStyle={this.props.style}
        />
      </View>
    )
  }
}

const styles = Styles.styleSheetCreate({
  outerView: {
    flexGrow: 1,
    position: 'relative',
  },
})

export default List2
