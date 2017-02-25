// @flow
//
import React, {Component} from 'react'
import {Text} from '../../common-adapters'
import {NativeListView} from '../../common-adapters/index.native'
import hoc from './list-hoc'
import messageFactory from './messages'

import type {Props} from './list'

type State = {
  dataSource: NativeListView.DataSource,
  isLockedToBottom: boolean,
}

const lockedToBottomSlop = 20

class ConversationList extends Component <void, Props, State> {
  state: State;
  _listRef: any;

  constructor (props: Props) {
    super(props)
    const ds = new NativeListView.DataSource({rowHasChanged: (r1, r2) => r1.key !== r2.key})
    this.state = {
      dataSource: ds.cloneWithRows(props.messages.toArray()),
      isLockedToBottom: true,
    }
  }

  _updateDataSource (newMessages) {
    this.setState({
      dataSource: this.state.dataSource.cloneWithRows(newMessages.toArray()),
    })
  }

  componentWillUpdate (nextProps: Props, nextState) {
    if (this.props.messages !== nextProps.messages) {
      this._updateDataSource(nextProps.messages)
    }
  }

  _scrollToBottom (animated?: boolean = true) {
    // setTimeout is necessary here. Something is racey with when the list finishes
    setTimeout(() => this._listRef && this._listRef.scrollToEnd({animated}), 0)
  }

  componentDidMount () {
    this._scrollToBottom()
  }

  componentWillReceiveProps (nextProps: Props) {
    const willScrollDown = nextProps.listScrollDownState !== this.props.listScrollDownState

    if (willScrollDown) {
      this.setState({isLockedToBottom: true})
    }
  }

  componentDidUpdate (prevProps: Props, prevState: State) {
    if ((this.props.selectedConversation !== prevProps.selectedConversation) ||
        (this.state.dataSource !== prevState.dataSource)) {
      this.state.isLockedToBottom && this._scrollToBottom()
    }
  }

  _onScroll = (scrollEvent) => {
    const {
      nativeEvent: {
        contentOffset: {y: scrollTop},
        contentSize: {height: scrollHeight},
        layoutMeasurement: {height: clientHeight},
      },
    } = scrollEvent

    // At the top, load more messages. Action handles loading state and if there's actually any more
    if (scrollTop === 0 && !this.state.isLockedToBottom) {
      this.props.onLoadMoreMessages()
    }

    const isLockedToBottom = scrollTop + clientHeight >= scrollHeight - lockedToBottomSlop
    this.setState({
      isLockedToBottom,
    })
  }

  _renderRow = (message, sectionID, rowID) => {
    const isFirstMessage = rowID === 0
    const prevMessage = this.props.messages.get(rowID - 1)
    const isSelected = false
    const isScrolling = false
    const options = this.props.optionsFn(message, prevMessage, isFirstMessage, isSelected, isScrolling, message.key || `other-${rowID}`, {}, () => console.log('todo'))

    return messageFactory(options)
  }

  render () {
    const {
      moreToLoad,
      messages,
    } = this.props

    if (moreToLoad && messages.count() === 0) {
      return <Text type='Body'>Loading Messages...</Text>
    }

    if (messages.count() === 0) {
      return <Text type='Body'>No messages here</Text>
    }

    return (
      <NativeListView
        ref={r => { this._listRef = r; window._listRef = r }}
        dataSource={this.state.dataSource}
        renderRow={this._renderRow}
        onScroll={this._onScroll}
        initialListSize={messages.count()}
      />
    )
  }
}

export default hoc(ConversationList)
