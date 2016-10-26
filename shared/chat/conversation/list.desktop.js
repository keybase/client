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
  scrollTop: number,
}

class ConversationList extends Component<void, Props, State> {
  _cellCache: any;
  _cellMeasurer: any;
  state: State;

  constructor (props: Props) {
    super(props)

    this.state = {
      isLockedToBottom: true,
      scrollTop: 0,
    }

    this._cellCache = new CellSizeCache(this._indexToID)

    // TEMP
    // setInterval(() => {
      // if (this.props.moreToLoad) {
        // this.props.loadMoreMessages()
      // }
    // }, 5000)
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

  componentDidUpdate (prevProps: Props) {
    if (!this.state.isLockedToBottom && this.props.messages !== prevProps.messages && prevProps.messages.count() > 1) {
      // find diff where the subset is
      const prependedCount = this.props.messages.indexOf(prevProps.messages.first())
      if (prependedCount !== -1) {
        // measure new items
        // Disabling eslint as we normally don't want to call setState in a componentDidUpdate in case you infinitely re-render
        this.setState({scrollTop: this.state.scrollTop + _.range(0, prependedCount) // eslint-disable-line react/no-did-update-set-state
          .map(index => this._cellMeasurer.getRowHeight({index: index + 1})) // +1 since 0 is the loading message
          .reduce((total, height) => total + height, 0)})
      }
    }
  }

  _rowRenderer = ({index, key, style, isScrolling}: {index: number, key: string, style: Object, isScrolling: boolean}) => {
    if (!index) {
      return <LoadingMore style={style} key={key || index} loading={this.props.moreToLoad} />
    }

    const message = this.props.messages.get(index - 1)
    return messageFactory(message, index, key, style, isScrolling)
  }

  _onScroll = _.throttle(({clientHeight, scrollHeight, scrollTop}) => {
    // not really loaded
    if (!clientHeight) {
      return
    }

    // TODO do this if you're sitting on zero for awhile and cancel otherwise...
    if (scrollTop === 0) {
      this.props.loadMoreMessages()
    }

    const isLockedToBottom = scrollTop + clientHeight === scrollHeight
    const newState = {
      isLockedToBottom,
      scrollTop,
    }
    this.setState(newState)
  }, 100)

  render () {
    const countWithLoading = this.props.messages.size + 1 // Loading row on top always for now
    let scrollToIndex = this.state.isLockedToBottom ? countWithLoading - 1 : undefined
    let scrollTop = scrollToIndex ? undefined : this.state.scrollTop

    return (
      <Box style={{...globalStyles.flexBoxColumn, flex: 1}}>
        <style>{demoAnimation}</style>
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
