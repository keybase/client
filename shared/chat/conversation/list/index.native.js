// @flow
import * as Constants from '../../../constants/chat'
import React, {Component} from 'react'
import messageFactory from '../messages'
import {Box} from '../../../common-adapters'
import FlatList from '../../../fixme/Lists/FlatList'
import InvertibleScrollView from 'react-native-invertible-scroll-view'

import type {Props} from '.'

class ConversationList extends Component <void, Props, State> {
  state: State;
  _viewableItems = [];

  _onAction = (message: Constants.ServerMessage, event: any) => {
    this.props.onMessageAction(message)
  }

  // This is handled slightly differently on mobile, leave this blank
  _onShowEditor = (message: Constants.Message, event: any) => { }

  // This is handled slightly differently on mobile, leave this blank
  _measure = () => {}

  _setListRef = (r: any) => {
    this._list = r
  }

  _renderRow = (rowData, sectionID, rowID, highlightRow) => {
    const messageKey = rowData
    const prevMessageKey = this.props.messageKeys.get(rowID - 1)
    const isSelected = false

    return messageFactory(messageKey, prevMessageKey, this._onAction, this._onShowEditor, isSelected, this._measure)
  }

  _renderItem = ({item: messageKey, index}) => {
    const prevMessageKey = index !== 0 ? this.props.messageKeys.get(index - 1) : null
    const isSelected = false
    return (
      // We ahve to invert transform the message or else it will look flipped
      <Box style={verticallyInvertedStyle}>
        {messageFactory(messageKey, prevMessageKey, this._onAction, this._onShowEditor, isSelected, this._measure)}
      </Box>
    )
  }

  _keyExtractor = messageKey => messageKey

  _onEndReached = () => {
    this.props.onLoadMoreMessages()
  }

  componentDidUpdate (prevProps) {
    // TODO do we need this? I think the list may work how we want w/o this
    if (this.props.listScrollDownCounter !== prevProps.listScrollDownCounter && this._scrollRef) {
      this._scrollRef.scrollTo({y: 0, animated: false})
    }
  }

  _captureScrollRef = r => { this._scrollRef = r }

  render () {
    return (
      <FlatList
        data={this.props.messageKeys.reverse().toArray()}
        renderItem={this._renderItem}
        onViewableItemsChanged={this._onViewableItemsChanged}
        onScroll={this._onScroll}
        onEndReached={this._onEndReached}
        onEndReachedThreshold={0}
        keyExtractor={this._keyExtractor}
        renderScrollComponent={props => <InvertibleScrollView {...props} ref={this._captureScrollRef} inverted={true} />}
        initialNumToRender={30}
      />
    )
  }
}

const verticallyInvertedStyle = {
  flex: 1,
  transform: [
    {scaleY: -1},
  ],
}

export default ConversationList
