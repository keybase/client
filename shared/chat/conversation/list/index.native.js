// @flow
import * as Constants from '../../../constants/chat'
import React, {Component} from 'react'
import messageFactory from '../messages'
// import shallowEqual from 'shallowequal'
// import {Box, Icon} from '../../../common-adapters'
import {NativeListView} from '../../../common-adapters/index.native'

import type {Props} from '.'

type State = {
  dataSource: NativeListView.DataSource,
  isLockedToBottom: boolean,
  // scrollViewHeight: ?number,
  // contentHeight: ?number,
}

// const lockedToBottomSlop = 20

class ConversationList extends Component <void, Props, State> {
  state: State;
  _list: any;

  _ds = new NativeListView.DataSource({
    rowHasChanged: (r1, r2) => {
      return r1 !== r2
    },
  })

  constructor (props: Props) {
    super(props)
    this.state = {
      // contentHeight: null,
      dataSource: this._ds.cloneWithRows(this.props.messageKeys.toArray()),
      isLockedToBottom: true,
      // scrollViewHeight: null,
    }
  }

  // _updateDataSource (nextProps) {
    // const ds = this._makeDataSource()
    // this.setState({
      // dataSource: ds.cloneWithRows(this._allMessages(nextProps).toArray()),
    // })
  // }

  // shouldComponentUpdate (nextProps: Props, nextState: State) {
    // const {contentHeight, scrollViewHeight} = this.state
    // const {contentHeight: nextContentHeight, scrollViewHeight: nextScrollViewHeight} = nextState

    // if (contentHeight !== nextContentHeight || scrollViewHeight !== nextScrollViewHeight) {
      // return true
    // }

    // return !shallowEqual(this.props, nextProps) || this.state.dataSource !== nextState.dataSource
  // }

  // componentWillUpdate (nextProps: Props, nextState: State) {
    // if (!shallowEqual(this.props, nextProps)) {
      // this._updateDataSource(nextProps)
    // }
  // }

  // _scrollToBottom (animated?: boolean = true) {
    // const {contentHeight, scrollViewHeight} = this.state
    // if (!contentHeight || !scrollViewHeight) {
      // return
    // }

    // if (contentHeight > scrollViewHeight && this._listRef) {
      // this._listRef.scrollToEnd({animated})
    // }
  // }

  componentWillReceiveProps (nextProps: Props) {
    if (this.props.selectedConversation !== nextProps.selectedConversation ||
      this.props.listScrollDownCounter !== nextProps.listScrollDownCounter) {
      this.setState({isLockedToBottom: true})
    }

    if (this.props.messageKeys !== nextProps.messageKeys) {
      this.setState({dataSource: this._ds.cloneWithRows(nextProps.messageKeys.toArray())})
    }
  }

  componentDidMount () {
    if (this.state.isLockedToBottom) {
      this._list && this._list.scrollToEnd({animated: false})
    }
  }

  componentDidUpdate (prevProps: Props, prevState: State) {
    // const {contentHeight: prevContentHeight, scrollViewHeight: prevScrollViewHeight} = prevState
    // const {contentHeight, scrollViewHeight} = this.state
    // if (contentHeight && scrollViewHeight && (contentHeight !== prevContentHeight || scrollViewHeight !== prevScrollViewHeight)) {
      // this.state.isLockedToBottom && this._scrollToBottom()
    // }
    if (this.state.isLockedToBottom && this.props.messageKeys.count() !== prevProps.messageKeys.count()) {
      this._list && this._list.scrollToEnd({animated: true})
    }
  }

  // _onLayout = ({nativeEvent: {layout: {height: scrollViewHeight}}}) => {
    // this.setState({scrollViewHeight: Math.floor(scrollViewHeight)})
  // }

  // _onContentSizeChange = (contentWidth, contentHeight) => {
    // this.setState({contentHeight: Math.floor(contentHeight)})
  // }

  // _onScroll = (scrollEvent) => {
    // const {
      // nativeEvent: {
        // contentOffset: {y: scrollTop},
        // contentSize: {height: scrollHeight},
        // layoutMeasurement: {height: clientHeight},
      // },
    // } = scrollEvent

    // // At the top, load more messages. Action handles loading state and if there's actually any more
    // if (scrollTop === 0 && !this.state.isLockedToBottom) {
      // this.props.onLoadMoreMessages()
    // }

    // const isLockedToBottom = scrollTop + clientHeight >= scrollHeight - lockedToBottomSlop
    // this.setState({
      // isLockedToBottom,
    // })
  // }

  // _allMessages (props) {
    // return props.headerMessages.concat(props.messages)
  // }

  _onAction = (message: Constants.ServerMessage, event: any) => {
    this.props.onMessageAction(message)
  }

  // // This is handled slightly differently on mobile, leave this blank
  _onShowEditor = (message: Constants.Message, event: any) => { }

  // // This is handled slightly differently on mobile, leave this blank
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

  render () {
    return (
      <NativeListView
        dataSource={this.state.dataSource}
        enableEmptySections={true}
        initialListSize={20}
        ref={this._setListRef}
        renderRow={this._renderRow}
      />
    )
  }
        // onScroll={this._onScroll}
        // onContentSizeChange={this._onContentSizeChange}
        // onLayout={this._onLayout}


    // return (
      // <NativeListView
        // enableEmptySections={true}
        // ref={r => { this._listRef = r; window._listRef = r }}
        // dataSource={this.state.dataSource}
        // renderRow={this._renderRow}
        // onLayout={this._onLayout}
        // onContentSizeChange={this._onContentSizeChange}
        // onScroll={this._onScroll}
        // initialListSize={this._allMessages(this.props).count()}
      // />
    // )
  // }
}

export default ConversationList
