// @flow
// An infinite scrolling chat list. Using react-virtualized which doens't really handle this case out of the box
// We control which set of messages we render in our state object
// We load that in in our constructor, after you stop scrolling or if we get an update and we're not currently scrolling

import LoadingMore from './messages/loading-more'
import React, {Component} from 'react'
import _ from 'lodash'
import messageFactory from './messages'
import {AutoSizer, CellMeasurer, List, defaultCellMeasurerCellSizeCache} from 'react-virtualized'
import {Box} from '../../common-adapters'
import {globalStyles} from '../../styles'

import type {Message} from '../../constants/chat'
import type {Props} from './'

type State = {
  isLockedToBottom: boolean,
  isScrolling: boolean,
  messages: List<Message>,
  scrollTop: number,
}

class ConversationList extends Component<void, Props, State> {
  _cellCache: any;
  _cellMeasurer: any;
  _list: any;
  state: State;
  _toRemeasure: List;

  constructor (props: Props) {
    super(props)

    this.state = {
      isLockedToBottom: true,
      isScrolling: false,
      messages: props.messages,
      scrollTop: 0,
    }

    this._cellCache = new CellSizeCache(this._indexToID)
    this._toRemeasure = []
  }

  _indexToID = index => {
    // loader message
    if (index === 0) {
      return 0
    } else {
      // minus one because loader message is there
      const messageIndex = index - 1
      const message = this.state.messages.get(messageIndex)
      // We want a stable key -- messages have an outboxID but no messageID,
      // then later gain a messageID.  So if we prefer outboxIDs to messageIDs
      // for the key, every row keeps its key.
      const id = message && (message.outboxID || message.messageID)
      if (id == null) {
        console.warn('id is null for index:', messageIndex)
      }
      return id
    }
  }

  componentWillUpdate (nextProps: Props, nextState: State) {
    // If a message has moved from pending to sent, tell the List to discard
    // heights for it (which will re-render it and everything after it)
    if (this._toRemeasure.length) {
      this._toRemeasure.forEach(item => {
        this._list.recomputeRowHeights(item)
      })
      this._toRemeasure = []
    }
  }

  componentDidUpdate (prevProps: Props, prevState: State) {
    if (!this.state.isLockedToBottom && this.state.messages !== prevState.messages && prevState.messages.count() > 1) {
      // Figure out how many new items we have
      const prependedCount = this.state.messages.indexOf(prevState.messages.first())
      if (prependedCount !== -1) {
        // Measure the new items so we can adjust our scrollTop so your position doesn't jump
        const scrollTop = this.state.scrollTop + _.range(0, prependedCount)
          .map(index => this._cellMeasurer.getRowHeight({index: index + 1})) // +1 since 0 is the loading message
          .reduce((total, height) => total + height, 0)

        // Disabling eslint as we normally don't want to call setState in a componentDidUpdate in case you infinitely re-render
        this.setState({scrollTop}) // eslint-disable-line react/no-did-update-set-state
      }
    }
  }

  componentWillReceiveProps (nextProps: Props) {
    if (this.props.selectedConversation !== nextProps.selectedConversation) {
      this.setState({isLockedToBottom: true})
    }

    // If we're not scrolling let's update our internal messages
    if (!this.state.isScrolling) {
      this._invalidateChangedMessages(nextProps)
      this.setState({
        messages: nextProps.messages,
      })
    }
  }

  _invalidateChangedMessages (props: Props) {
    this.state.messages.forEach((item, index) => {
      if (item.messageID !== props.messages.get(index, {}).messageID) {
        this._toRemeasure.push(index + 1)
      }
    })
  }

  _onScrollSettled = _.debounce(() => {
    // If we've stopped scrolling let's update our internal messages
    this._invalidateChangedMessages(this.props)
    this.setState({
      isScrolling: false,
      ...(this.state.messages !== this.props.messages ? {messages: this.props.messages} : null),
    })
  }, 1000)

  _onScroll = _.throttle(({clientHeight, scrollHeight, scrollTop}) => {
    // Do nothing if we haven't really loaded anything
    if (!clientHeight) {
      return
    }

    // At the top, load more messages. Action handles loading state and if there's actually any more
    if (scrollTop === 0) {
      this.props.loadMoreMessages()
    }

    const isLockedToBottom = scrollTop + clientHeight === scrollHeight
    this.setState({
      isLockedToBottom,
      isScrolling: true,
      scrollTop,
    })

    // This is debounced so it resets the call
    this._onScrollSettled()
  }, 100)

  _rowRenderer = ({index, key, style, isScrolling}: {index: number, key: string, style: Object, isScrolling: boolean}) => {
    if (index === 0) {
      return <LoadingMore style={style} key={key || index} hasMoreItems={this.props.moreToLoad} />
    }

    const message = this.state.messages.get(index - 1)
    const prevMessage = this.state.messages.get(index - 2)
    const isFirstMessage = index - 1 === 0
    const skipMsgHeader = (prevMessage && prevMessage.type === 'Text' && prevMessage.author === message.author)

    return messageFactory(message, isFirstMessage || !skipMsgHeader, index, key, style, isScrolling)
  }

  render () {
    const countWithLoading = this.state.messages.count() + 1 // Loading row on top always
    let scrollToIndex = this.state.isLockedToBottom ? countWithLoading - 1 : undefined
    let scrollTop = scrollToIndex ? undefined : this.state.scrollTop

    return (
      <Box style={{...globalStyles.flexBoxColumn, flex: 1}}>
        <AutoSizer>
          {({height, width}) => (
            <CellMeasurer
              cellRenderer={({rowIndex, ...rest}) => this._rowRenderer({index: rowIndex, ...rest})}
              columnCount={1}
              ref={r => { this._cellMeasurer = r }}
              cellSizeCache={this._cellCache}
              rowCount={countWithLoading} >
              {({getRowHeight}) => (
                <List
                  height={height}
                  ref={r => { this._list = r }}
                  width={width}
                  onScroll={this._onScroll}
                  scrollTop={scrollTop}
                  scrollToIndex={scrollToIndex}
                  rowCount={countWithLoading}
                  rowHeight={getRowHeight}
                  rowRenderer={this._rowRenderer} />
              )}
            </CellMeasurer>
          )}
        </AutoSizer>
      </Box>
    )
  }
}

class CellSizeCache extends defaultCellMeasurerCellSizeCache {
  _indexToID: (index: number) => number;

  constructor (indexToID) {
    super({uniformColumnWidth: true})
    this._indexToID = indexToID
  }

  getRowHeight (index) {
    return super.getRowHeight(this._indexToID(index))
  }

  setRowHeight (index, height) {
    super.setRowHeight(this._indexToID(index), height)
  }

  hasRowHeight (index) {
    return super.hasRowHeight(this._indexToID(index))
  }

  clearRowHeight (index) {
    return super.clearRowHeight(this._indexToID(index))
  }
}

export default ConversationList
