// @flow
import * as Constants from '../../../constants/chat'
import React, {Component} from 'react'
import {withPropsOnChange} from 'recompose'
import messageFactory from '../messages'
import {Box, NativeScrollView, NativeKeyboard, NativeFlatList} from '../../../common-adapters/index.native'
import {globalStyles} from '../../../styles'

import type {Props} from '.'

class ConversationList extends Component<Props> {
  _scrollRef: ?any

  _onAction = (message: Constants.ServerMessage) => {
    NativeKeyboard.dismiss()
    this.props.onMessageAction(message)
  }

  // This is handled slightly differently on mobile, leave this blank
  _onShowEditor = () => {}

  // This is handled slightly differently on mobile, leave this blank
  _measure = () => {}

  _renderItem = ({item: messageKey, index}) => {
    const prevMessageKey = this.props.messageKeys.get(index + 1) // adding instead of subtracting because of reversed index
    const isSelected = false
    return (
      // We have to invert transform the message or else it will look flipped
      (
        <Box style={verticallyInvertedStyle}>
          {messageFactory(
            messageKey,
            prevMessageKey,
            this._onAction,
            this._onShowEditor,
            isSelected,
            this._measure
          )}
        </Box>
      )
    )
  }

  _keyExtractor = messageKey => messageKey

  // Don't load if we have no messages in there. This happens a lot when we're dealing with stale messages
  _onEndReached = () => {
    if (this.props.messageKeys.count() > 1) {
      this.props.onLoadMoreMessages()
    }
  }

  componentDidUpdate(prevProps: Props) {
    // TODO do we need this? I think the list may work how we want w/o this
    if (this.props.listScrollDownCounter !== prevProps.listScrollDownCounter && this._scrollRef) {
      this._scrollRef.scrollTo({animated: false, y: 0})
    }
  }

  _renderScrollComponent = props => (
    <NativeScrollView
      {...props}
      ref={this._captureScrollRef}
      style={[verticallyInvertedStyle, props.style]}
    />
  )

  _captureScrollRef = r => {
    this._scrollRef = r
  }

  render() {
    return (
      <Box style={globalStyles.fillAbsolute}>
        <NativeFlatList
          data={this.props.messageKeys.toArray()}
          renderItem={this._renderItem}
          renderScrollComponent={this._renderScrollComponent}
          onEndReached={this._onEndReached}
          onEndReachedThreshold={0}
          keyExtractor={this._keyExtractor}
          // Limit the number of pages rendered ahead of time (which also limits attachment previews loaded)
          windowSize={5}
        />
      </Box>
    )
  }
}

const verticallyInvertedStyle = {
  transform: [{scaleY: -1}],
}

// Reverse the order of messageKeys to compensate for vertically reversed display
const withReversedMessageKeys = withPropsOnChange(['messageKeys'], ({messageKeys}) => ({
  messageKeys: messageKeys.reverse(),
}))

export default withReversedMessageKeys(ConversationList)
