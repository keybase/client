// @flow
import LoadingMore from './messages/loading-more'
import React, {Component} from 'react'
import _ from 'lodash'
import messageFactory from './messages'
import {AutoSizer, CellMeasurer, List, defaultCellMeasurerCellSizeCache} from 'react-virtualized'

import type {Props} from './'

type State = {
  isLockedToBottom: boolean,
  // isMoving: boolean,
  scrollTop: number,
}

class Conversation extends Component<void, Props, State> {
  _cellCache: any;
  _cellMeasurer: any;
  state: State;

  constructor (props: Props) {
    super(props)

    this.state = {
      isLockedToBottom: true,
      // isMoving: false,
      scrollTop: 0,
      // prepending:
    }

    this._cellCache = new TimeBasedCellSizeCache({uniformColumnWidth: true})
    this._cellCache.updateLoadedMessages([])
  }

  _rowRenderer = ({index, key, style, isScrolling}: {index: number, key: string, style: Object, isScrolling: boolean}) => {
    // TODO make this smarter, don't just make this the top item
    if (!index) {
      return <LoadingMore style={style} key={key || index} loading={this.props.moreToLoad} />
    }

    const message = this.props.messages.get(index - 1)
    return messageFactory(message, index, key, style, isScrolling)
  }

  _onScroll = _.throttle(({clientHeight, scrollHeight, scrollTop}) => {
    this.setState({
      isLockedToBottom: scrollTop + clientHeight === scrollHeight,
      scrollTop,
      // moving: true,
    })
    // this._stoppedMoving()
    if (scrollTop === 0 && this.props.moreToLoad) {
      this.props.loadMoreMessages()
    }
  }, 100)

  render () {
    const rowCount = this.props.messages.size + 1 // Loading row on top always for now
    const countWithLoading = rowCount + 1

    return (
      <AutoSizer>
        {({height, width}) => (
          <CellMeasurer
            cellRenderer={params => this._rowRenderer(params)}
            columnCount={1}
            cellSizeCache={this._cellCache}
            ref={r => { this._cellMeasurer = r }}
            rowCount={rowCount} >
            {({getRowHeight}) => (
              <List
                height={height}
                width={width}
                onScroll={this._onScroll}
                scrollToIndex={this.state.isLockedToBottom ? this.props.messages.size : undefined}
                scrollTop={this.state.scrollTop}
                rowCount={countWithLoading}
                rowHeight={getRowHeight}
                rowRenderer={this._rowRenderer}
               />
            )}
          </CellMeasurer>
        )}
      </AutoSizer>
    )
    //
  }
}

class TimeBasedCellSizeCache extends defaultCellMeasurerCellSizeCache {
  updateLoadedMessages (newLoadedMessages) {
    this.loadedMessages = newLoadedMessages
  }

  getRowHeight (index) {
    let id
    // loader message
    if (index === 0) {
      id = 0
    } else {
      // minus one because loader message is there
      const m = this.loadedMessages[index - 1]
      id = m && m.timestamp
      if (id == null) {
        console.warn('id is null for index:', index - 1)
      }
    }
    return super.getRowHeight(id)
  }

  setRowHeight (index, height) {
    let id
    // loader message
    if (index === 0) {
      console.warn('setting height of cell 0', height)
      id = 0
    } else {
      // minus one because loader message is there
      const m = this.loadedMessages[index - 1]
      id = m && m.timestamp
      if (id == null) {
        console.warn('id is null for index:', index - 1)
      }
    }
    super.setRowHeight(id, height)
  }
}

export default Conversation
