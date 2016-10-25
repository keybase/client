// @flow
import LoadingMore from './messages/loading-more'
import React, {Component} from 'react'
import _ from 'lodash'
import messageFactory from './messages'
import {AutoSizer, CellMeasurer, List, defaultCellMeasurerCellSizeCache} from 'react-virtualized'
import {Box} from '../../common-adapters'
import {globalStyles} from '../../styles'

import type {Props} from './'

type State = {
  isLockedToBottom: boolean,
  // isMoving: boolean,
  scrollTop: number,
}

class ConversationList extends Component<void, Props, State> {
  _cellCache: any;
  _cellMeasurer: any;
  state: State;

  constructor (props: Props) {
    super(props)

    this.state = {
      isLockedToBottom: false,
      // isMoving: false,
      scrollTop: 0,
      // prepending:
    }

    this._cellCache = new CellSizeCache(this._indexToID)

    setInterval(() => {
      this.props.loadMoreMessages()
    }, 2000)
  }

  _indexToID = index => {
    // loader message
    if (index === 0) {
      return 0
    } else {
      // minus one because loader message is there
      const messageIndex = index - 1
      const message = this.props.messages.get(messageIndex)
      const id = message && message.messageID
      if (id == null) {
        console.warn('id is null for index:', messageIndex)
      }
      return id
    }
  }

  // componentDidUpdate (prevProps, prevState) {
    // if (prevState.inTransaction && !this.state.inTransaction && this.state.prepending) {
      // // 1 - 11 because you are prepending 10, and there is a loading message.
      // const scrollTop = this.state.scrollTop + _.range(1,11).map(index => this._cellMeasurer.getRowHeight({index})).reduce((acc, h) => acc + h, 0)
      // this.setState({scrollTop, prepending: false})
    // }
  // }

  // componentWillReceiveProps (nextProps: Props) {
    // if (nextProps.messages !== this.props.messages) {
      // this._cellCache.updateLoadedMessages(nextProps.messages)
    // }
  // }

  _rowRenderer = ({index, key, style, isScrolling}: {index: number, key: string, style: Object, isScrolling: boolean}) => {
    // TODO make this smarter, don't just make this the top item
    if (!index) {
      return <LoadingMore style={style} key={key || index} loading={this.props.moreToLoad} />
    }

    const message = this.props.messages.get(index - 1)
    return messageFactory(message, index, key, style, isScrolling)
  }

  _onScroll = _.throttle(({clientHeight, scrollHeight, scrollTop}) => {
    const newState = {
      // isLockedToBottom: scrollTop + clientHeight === scrollHeight,
      // scrollTop,
      // moving: true,
    }
    // console.log('aaa', newState)
    this.setState(newState)
    // this._stoppedMoving()
    // if (scrollTop === 0 && this.props.moreToLoad) {
      // this.props.loadMoreMessages()
    // }
  }, 100)

  render () {
    const countWithLoading = this.props.messages.size + 1 // Loading row on top always for now

                  // scrollTop={this.state.scrollTop}
    return (
      <Box style={{...globalStyles.flexBoxColumn, flex: 1}}>
        <style>{demoAnimation}</style>
        <AutoSizer>
          {({height, width}) => (
            <CellMeasurer
              cellRenderer={({rowIndex, ...rest}) => this._rowRenderer({index: rowIndex, ...rest})}
              columnCount={1}
              cellSizeCache={this._cellCache}
              ref={r => { this._cellMeasurer = r }}
              rowCount={countWithLoading} >
              {({getRowHeight}) => (
                <List
                  height={height}
                  width={width}
                  onScroll={this._onScroll}
                  scrollToIndex={this.state.isLockedToBottom ? this.props.messages.size : undefined}
                  rowCount={countWithLoading}
                  rowHeight={getRowHeight}
                  rowRenderer={this._rowRenderer}
                 />
              )}
            </CellMeasurer>
          )}
        </AutoSizer>
      </Box>
    )
  }
}

// This should just take a mapper from index -> id. Doesn't need loadedMessages
class CellSizeCache extends defaultCellMeasurerCellSizeCache {
  _indexToID: (index: number) => number;

  constructor (indexToID) {
    super({uniformColumnWidth: true})
    this._indexToID = indexToID
  }
  // updateLoadedMessages (newLoadedMessages) {
    // this.loadedMessages = newLoadedMessages
  // }

  // _toId (index) {
    // let id
    // // loader message
    // if (index === 0) {
      // id = 0
    // } else {
      // // minus one because loader message is there
      // const m = index && this.loadedMessages.get(index - 1)
      // id = m && m.messageID
      // if (id == null) {
        // console.warn('id is null for index:', index - 1)
      // }
    // }

    // return id
  // }

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

const demoAnimation = `
@-webkit-keyframes demo {
    0% {
        background-color: white;
        opacity:1;
    }
    50% {
        background-color: red;
    }
    100% {
        background-color: white;
    }
}

.demo {
    -webkit-animation-name: demo;
    -webkit-animation-duration: 900ms;
    -webkit-animation-iteration-count: 1;
    -webkit-animation-timing-function: ease-in-out;
}
`
export default ConversationList
