// @flow
import * as Constants from '../../../constants/chat'
import React, {Component} from 'react'
import messageFactory from '../messages'
// import shallowEqual from 'shallowequal'
// import {Box, Icon} from '../../../common-adapters'
import {NativeListView} from '../../../common-adapters/index.native'
import FlatList from '../../../fixme/Lists/FlatList'
import {debounce} from 'lodash'

import type {Props} from '.'

type State = {
  isLockedToBottom: boolean,
  // scrollViewHeight: ?number,
  // contentHeight: ?number,
}

class ConversationList extends Component <void, Props, State> {
  state: State;
  _listRef: ?any;
  _viewableItems = [];

  // _listRef: any;
  _ds = new NativeListView.DataSource({
    rowHasChanged: (r1, r2) => {
      return r1 !== r2
    },
  })

  _initiallyScrolledToBottom = false;

  constructor (props: Props) {
    super(props)
    this.state = {
      // contentHeight: null,
      isLockedToBottom: true,
      scrollToIndex: null,
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

  componentDidUpdate (prevProps: Props, prevState: State) {
    if (prevState.scrollToIndex !== this.state.scrollToIndex) {
      console.log('My scroll to index is different, I\'m going to scroll to', this.state.scrollToIndex)
      this._scrollToIndex(this.state.scrollToIndex)
    }
  }

  componentWillReceiveProps (nextProps: Props) {
    // const willScrollDown = nextProps.listScrollDownCounter !== this.props.listScrollDownCounter
    if (this.props.messageKeys !== nextProps.messageKeys && this.state.isLockedToBottom) {
      console.log('setting scrollToIndex to', nextProps.messageKeys.count() - 1)
      this.setState({scrollToIndex: nextProps.messageKeys.count() - 1})
      // this._scrollToEnd()
    }

    // if (willScrollDown) {
      // this.setState({isLockedToBottom: true})
    // }
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

  _isIdxVisible = (viewableItems, idx) => {
    return viewableItems && viewableItems.findIndex(({index}) => index === idx) !== -1
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

    return messageFactory(messageKey, prevMessageKey, this._onAction, this._onShowEditor, isSelected, this._measure)
  }

  // _renderRow = (message, sectionID, rowID) => {
    // const messages = this._allMessages(this.props)
    // const isFirstMessage = rowID === 0
    // const prevMessage = messages.get(rowID - 1)
    // const isSelected = false
    // const isScrolling = false
    // const options = this.props.optionsFn(message, prevMessage, isFirstMessage, isSelected, isScrolling, message.key || `other-${rowID}`, {}, this._onAction, this._onShowEditor, this.props.editingMessage === message)

    // return messageFactory(options)
  // }

  _captureRef = (ref) => { this._listRef = ref }

  _scrollToEnd = () => {
    console.log('scrolling to the end!!', this.props.messageKeys)
    this._listRef && this._listRef.scrollToEnd({animated: false})
  }

  _scrollToIndex = debounce((index) => {
    console.log('Going to try to scroll', index)
    console.log('isLastItemVisible?', index, this._isIdxVisible(this._viewableItems, index))
    if (index) {
      console.log('maybe scroll to ', index)
      if (!this._isIdxVisible(this._viewableItems, index)) {
        console.log('  scrolling to ', index)
        // Need to do getItemLayout
        console.log('  list ref is', this._listRef)
        // this._listRef && this._listRef.scrollToIndex({animated: false, index})
        this._listRef && this._listRef.scrollToEnd({animated: false, index})
        this.setState({scrollToIndex: null})
      } else {
        console.log('  already there')
        // this.setState({scrollToIndex: null})
      }
    }
  }, 1000, {trailing: true})

  _onLayout = ({nativeEvent: {layout: {x, y, width, height}}}) => {
    console.log('layout', x, y, width, height)
  }

  _onViewableItemsChanged = ({viewableItems}) => {
    console.log('viewable items', viewableItems)
    this._viewableItems = viewableItems

    // If the last item isn't visible we are not locked to the bottom
    const lastIdx = this.props.messageKeys.count() - 1
    if (!this._isIdxVisible(viewableItems, lastIdx)) {
      // If we're scrolling to the bottom then we want to be locked to the bottom
      // otherwise we are not locked
      this.setState({isLockedToBottom: this.state.scrollToIndex === lastIdx})
    }

    if (this._isIdxVisible(viewableItems, 0) && !this.state.isLockedToBottom) {
      this.props.onLoadMoreMessages()
    }
  }

  _keyExtractor = messageKey => messageKey

  _onEndReached = ({distanceFromEnd}) => {
    console.log('onEndReached!')
    this.setState({isLockedToBottom: true})
  }

  componentDidMount () {
    console.log('mounted!', this._listRef)
  }

  render () {
    console.log('isLockedToBottom', this.state.isLockedToBottom)
    console.log('scroll to index', this.state.scrollToIndex)

    return (
      <FlatList
        ref={this._captureRef}
        data={this.props.messageKeys.toArray()}
        renderItem={this._renderItem}
        onViewableItemsChanged={this._onViewableItemsChanged}
        onScroll={this._onScroll}
        onEndReached={this._onEndReached}
        onEndReachedThreshold={1}
        keyExtractor={this._keyExtractor}
        initialNumToRender={30}
      />
    )
  }
        // onRefresh={() => {
        //   console.log('refreshing')
        //   this.setState({refreshing: true})
        //   setTimeout(() => this.setState({refreshing: false}), 1e3)
        // }}
        // refreshing={this.state.refreshing || false}
  //
        // ref={r => { this._listRef = r; window._listRef = r }}
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
