// @flow
//
import React, {Component} from 'react'
import {Box, Icon} from '../../common-adapters'
import {NativeListView} from '../../common-adapters/index.native'
import hoc from './list-hoc'
import messageFactory from './messages'
import shallowEqual from 'shallowequal'

import type {Props} from './list'
import type {Message, ServerMessage} from '../../constants/chat'

type State = {
  dataSource: NativeListView.DataSource,
  isLockedToBottom: boolean,
  scrollViewHeight: ?number,
  contentHeight: ?number,
}

const lockedToBottomSlop = 20

class ConversationList extends Component <void, Props, State> {
  state: State;
  _listRef: any;

  constructor (props: Props) {
    super(props)
    const ds = this._makeDataSource()
    this.state = {
      contentHeight: null,
      dataSource: ds.cloneWithRows(this._allMessages(props).toArray()),
      isLockedToBottom: true,
      scrollViewHeight: null,
    }
  }

  // Have to remake this else it won't pick up changes. Hopefully ditch this with new flatlist
  _makeDataSource () {
    return new NativeListView.DataSource({
      rowHasChanged: (r1, r2) => {
        return r1 !== r2 || r1 === this.props.editingMessage || r2 === this.props.editingMessage
      },
    })
  }

  _updateDataSource (nextProps) {
    const ds = this._makeDataSource()
    this.setState({
      dataSource: ds.cloneWithRows(this._allMessages(nextProps).toArray()),
    })
  }

  shouldComponentUpdate (nextProps: Props, nextState: State) {
    const {contentHeight, scrollViewHeight} = this.state
    const {contentHeight: nextContentHeight, scrollViewHeight: nextScrollViewHeight} = nextState

    if (contentHeight !== nextContentHeight || scrollViewHeight !== nextScrollViewHeight) {
      return true
    }

    return !shallowEqual(this.props, nextProps) || this.state.dataSource !== nextState.dataSource
  }

  componentWillUpdate (nextProps: Props, nextState: State) {
    if (!shallowEqual(this.props, nextProps)) {
      this._updateDataSource(nextProps)
    }
  }

  _scrollToBottom (animated?: boolean = true) {
    const {contentHeight, scrollViewHeight} = this.state
    if (!contentHeight || !scrollViewHeight) {
      return
    }

    if (contentHeight > scrollViewHeight && this._listRef) {
      this._listRef.scrollToEnd({animated})
    }
  }

  componentWillReceiveProps (nextProps: Props) {
    const willScrollDown = nextProps.listScrollDownState !== this.props.listScrollDownState

    if (willScrollDown) {
      this.setState({isLockedToBottom: true})
    }
  }

  componentDidUpdate (prevProps: Props, prevState: State) {
    const {contentHeight: prevContentHeight, scrollViewHeight: prevScrollViewHeight} = prevState
    const {contentHeight, scrollViewHeight} = this.state
    if (contentHeight && scrollViewHeight && (contentHeight !== prevContentHeight || scrollViewHeight !== prevScrollViewHeight)) {
      this.state.isLockedToBottom && this._scrollToBottom()
    }
  }

  _onLayout = ({nativeEvent: {layout: {height: scrollViewHeight}}}) => {
    this.setState({scrollViewHeight: Math.floor(scrollViewHeight)})
  }

  _onContentSizeChange = (contentWidth, contentHeight) => {
    this.setState({contentHeight: Math.floor(contentHeight)})
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

  _allMessages (props) {
    return props.headerMessages.concat(props.messages)
  }

  _onAction = (message: ServerMessage, event: any) => {
    this.props.onMessageAction(message)
  }

  // This is handled slightly differently on mobile, leave this blank
  _onShowEditor = (message: Message, event: any) => { }

  _renderRow = (message, sectionID, rowID) => {
    const messages = this._allMessages(this.props)
    const isFirstMessage = rowID === 0
    const prevMessage = messages.get(rowID - 1)
    const isSelected = false
    const isScrolling = false
    const options = this.props.optionsFn(message, prevMessage, isFirstMessage, isSelected, isScrolling, message.key || `other-${rowID}`, {}, this._onAction, this._onShowEditor, this.props.editingMessage === message)

    return messageFactory(options)
  }

  render () {
    const {
      moreToLoad,
      messages,
    } = this.props

    if (moreToLoad && messages.count() === 0) {
      return (
        <Box style={{alignItems: 'center', flexGrow: 1, justifyContent: 'flex-start'}}>
          <Icon type='icon-securing-static-266' />
        </Box>
      )
    }

    if (messages.count() === 0) {
      return (
        <Box style={{alignItems: 'center', flexGrow: 1, justifyContent: 'flex-start'}}>
          <Icon type='icon-secure-static-266' />
        </Box>
      )
    }

    return (
      <NativeListView
        enableEmptySections={true}
        ref={r => { this._listRef = r; window._listRef = r }}
        dataSource={this.state.dataSource}
        renderRow={this._renderRow}
        onLayout={this._onLayout}
        onContentSizeChange={this._onContentSizeChange}
        onScroll={this._onScroll}
        initialListSize={this._allMessages(this.props).count()}
      />
    )
  }
}

export default hoc(ConversationList)
