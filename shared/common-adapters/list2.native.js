// @flow
import React, {PureComponent} from 'react'
import * as Flow from '../util/flow'
import {FlatList, View} from 'react-native'
import * as Styles from '../styles'

import type {Props} from './list2'

class List2<T> extends PureComponent<Props<T>, void> {
  static defaultProps = {
    keyboardShouldPersistTaps: 'handled',
  }

  _itemRender = ({item, index}) => {
    // $ForceType
    const itemT: T = item
    return this.props.renderItem(index, itemT)
  }

  _getItemLayout = (data, index) => {
    switch (this.props.itemHeight.type) {
      case 'fixed':
        return {index, length: this.props.itemHeight.height, offset: this.props.itemHeight.height * index}
      case 'variable': {
        // $ForceType
        const itemT: T = data[index]
        const lay = this.props.itemHeight.getItemLayout(index, itemT)
        return {index, length: lay.height, offset: lay.offset}
      }
      default:
        Flow.ifFlowComplainsAboutThisFunctionYouHaventHandledAllCasesInASwitch(this.props.itemHeight.type)
        return {index, length: 0, offset: 0}
    }
  }

  _keyExtractor = (item, index: number) => {
    if (this.props.indexAsKey || !item) {
      return String(index)
    }

    const keyProp = this.props.keyProperty || 'key'
    // $ForceType
    const key: string = String(item[keyProp])
    return key
  }

  render() {
    return (
      <View style={Styles.collapseStyles([styles.outerView, this.props.style])}>
        {/* need windowSize so iphone 6 doesn't have OOM issues */}
        <FlatList
          bounces={this.props.bounces}
          renderItem={this._itemRender}
          data={this.props.items}
          getItemLayout={this._getItemLayout}
          keyExtractor={this._keyExtractor}
          keyboardShouldPersistTaps={this.props.keyboardShouldPersistTaps}
          onEndReached={this.props.onEndReached}
          windowSize={this.props.windowSize || 10}
          debug={false /* set to true to debug the list */}
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
