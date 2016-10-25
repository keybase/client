// @flow

import React, {Component} from 'react'
import _ from 'lodash'
import {Box, Avatar} from '../../common-adapters'
import {AutoSizer, InfiniteLoader, Grid, List, WindowScroller, CellMeasurer, defaultCellMeasurerCellSizeCache} from 'react-virtualized'
import {globalStyles, globalColors} from '../../styles'
import ReactList from 'react-list'

function ChatMessage ({username, messageLengths, i, style}): {username: string} {
  if (messageLengths == null) {
    console.log('null message')
    return null
  }
  return (
    <Box className={'demo'} style={{...globalStyles.flexBoxRow, ...style}}>
      <Avatar size={24} username={username}/>
      <Box style={globalStyles.flexBoxColumn}>
      <Box>{username} - {i}</Box>
      {messageLengths.map((l, i) => (
        <Box key={i} style={{backgroundColor: globalColors.grey, height: 16, marginBottom: 8, width: l * 10}} />
      ))}
      </Box>
    </Box>
  )
}

function LoadingMessage ({style}): {} {
  return (
    <Box style={{...globalStyles.flexBoxRow, ...style}}>
      <Box>--- Loading More Messages ---</Box>
    </Box>
  )
}

const usernames = ['marcopolo', 'cecileb']

// This should just take a mapper from index -> id. Doesn't need loadedMessages
class IdBasedCellSizeCache extends defaultCellMeasurerCellSizeCache{
  updateLoadedMessages (newLoadedMessages) {
    this.loadedMessages = newLoadedMessages
  }

  _toId (index) {
    let id
    // loader message
    if (index === 0) {
      id = 0
    } else {
      // minus one because loader message is there
      const m = index && this.loadedMessages[index - 1]
      id = m && m.id
      if (id == null) {
        console.warn('id is null for index:', index - 1)
      }
    }

    return id
  }

  getRowHeight (index) {
    return super.getRowHeight(this._toId(index))
  }

  setRowHeight (index, height) {
    super.setRowHeight(this._toId(index), height)
  }

  hasRowHeight (index) {
    return super.hasRowHeight(this._toId(index))
  }

  clearRowHeight (index) {
    return super.clearRowHeight(this._toId(index))
  }
}

let id = 1
const idMaker = () => id++

class ChatDemo extends Component {
  constructor () {
    super()
    this.state = {
      loadedMessages: [],
      scrollTop: 0,
      prepending: false
    }

    this._cellCache = new IdBasedCellSizeCache({uniformColumnWidth: true})
    this._cellCache.updateLoadedMessages([])
    window._cellCache = this._cellCache
    this._stoppedMoving = _.debounce(() => {
      this.state.onStoppedMoving && this.state.onStoppedMoving()
      this.setState({moving: false, onStoppedMoving: null})
    }, 1e3)


    this._throttledOnScroll = _.throttle(this._handleOnScroll.bind(this), 100)

    this._transactions = []

    this._cm = null
  }

  _genRandomMessage (i: number) {
    const username = usernames[_.random(0, usernames.length - 1)]
    const messageLengths = _.range(0, _.random(1, 5)).map(i => _.random(5, 18))
    return {username, messageLengths, i, id: i}
  }

  componentWillMount () {
    if (!this.state.loadedMessages.length) {
      this._getMoreMessages(0, 20, 0).then(() => {
        window._cm = this._cellMeasurer
        this.setState({isOnBottom: true})

        setInterval(() => {
          if (this.state.inTransaction || this._transactions.length === 0) {
            return
          }
          const [nextTransaction, ...restTransactions] = this._transactions
          this.setState({inTransaction: true})
          this._transactions = restTransactions
          nextTransaction().then(() => {
            this.setState({inTransaction: false})
          })
        }, 100)
      })
      // setInterval(() => {
        // if (Math.random() > 0.50) {
          // this._appendMoreMessages(1, 0)
        // } else {
          // if (this._transactions.length === 0 && this.state.loadedMessages.length > 20) {
            // this._insertMiddleMoreMessages(20, 1, 0)
          // }
        // }
      // }, 1e3)

    }
  }

  _prependMoreMessages (count, timeout = 3e3) {
    this._transactions = this._transactions.concat(() => {
      let loadedMessages = [...this.state.loadedMessages]
      console.log('prepending messages, i know:', loadedMessages)
      loadedMessages.unshift.apply(loadedMessages, _.range(0, count).map(() => undefined))
      this.setState({prepending: true})
      return this._getMoreMessages(0, count, timeout, loadedMessages, true)
    })
  }

  _insertMiddleMoreMessages (insertAt, count, timeout = 3e3) {
    this._transactions = this._transactions.concat(() => {
      let loadedMessages = [...this.state.loadedMessages]
      loadedMessages.splice.apply(loadedMessages, [insertAt, 0].concat(_.range(0, count).map(() => undefined)))
      this.setState({insertingAtMiddle: {insertAt, count}})
      return this._getMoreMessages(insertAt, insertAt + count, timeout, loadedMessages, true)
    })
  }

  _appendMoreMessages (count, timeout = 3e3) {
    this._transactions = this._transactions.concat(() => {
      let loadedMessages = [...this.state.loadedMessages]
      const startIndex = loadedMessages.length
      loadedMessages = loadedMessages.concat(_.range(0, count).map(() => undefined))
      return this._getMoreMessages(startIndex, startIndex + count, timeout, loadedMessages, false)
    })
  }

  _getMoreMessages (startIndex, endIndex, timeout = 3e3, loadedMessages = null) {
    loadedMessages = [...(loadedMessages || this.state.loadedMessages)]

    return new Promise((resolve, reject) => {
      setTimeout(() => {
        _.range(startIndex, endIndex).forEach(i => {
          if (!loadedMessages[i]) {
            loadedMessages[i] = this._genRandomMessage(idMaker())
          }
        })

        const onStoppedMoving = () => {
          //this._cellMeasurer && this._cellMeasurer.resetMeasurements()
          this._cellCache.updateLoadedMessages(loadedMessages)
          this.setState({loadedMessages})
          resolve()
        }

        if (this.state.moving) {
          this.setState({onStoppedMoving})
        } else {
          onStoppedMoving()
        }
      }, timeout)
    })
  }

  componentDidUpdate (prevProps, prevState) {
    if (prevState.inTransaction && !this.state.inTransaction && this.state.prepending) {
      // +1 because there is a loading message.
      const scrollTop = this.state.scrollTop + _.range(0,10).map(index => this._cellMeasurer.getRowHeight({index: index + 1})).reduce((acc, h) => acc + h, 0)
      this.setState({scrollTop, prepending: false})
    }

    if (prevState.inTransaction && !this.state.inTransaction && this.state.insertingAtMiddle) {
      const {insertAt, count} = this.state.insertingAtMiddle
      const scrollTopToFirstInsertion = _.range(0, insertAt).map(index => this._cellMeasurer.getRowHeight({index: index + 1})).reduce((acc, h) => acc + h, 0)

      // We are scrolled above the where we inserted
      if (this.state.scrollTop > scrollTopToFirstInsertion) {
        const scrollTopDeltaOfInsertion = _.range(insertAt, insertAt + count).map(index => this._cellMeasurer.getRowHeight({index: index + 1})).reduce((acc, h) => acc + h, 0)
        const scrollTop = this.state.scrollTop + scrollTopDeltaOfInsertion
        this.setState({scrollTop, insertingAtMiddle: null})
      } else {
        this.setState({insertingAtMiddle: null})
      }
    }
  }

  _renderWithReactList () {
    return (
      <ReactList
        useTranslate3d={true}
        itemRenderer={(i, key) => <ChatMessage key={key} {...this.state.loadedMessages[i]} />}
        length={this.state.loadedMessages.length}
        type='uniform' />
    )
  }

  _handleOnScroll ({clientHeight, scrollHeight, scrollTop}) {
    const isOnBottom = scrollTop + clientHeight === scrollHeight
    this.setState({scrollTop, moving: true, isOnBottom})
    this._stoppedMoving()
    // if (scrollTop === 0) {
      // this._prependMoreMessages(10, 2e3)
    // }
  }

  _indexToKey (i) {
    return this.state.loadedMessages[i].id
  }

  _renderWithCellMeasurer () {
    console.log('on bottom', this.state.isOnBottom)
    const rowRenderer = ({index: i, style, key}) => this._isRowLoaded({index: i}) ? <ChatMessage style={style} key={this._indexToKey(i)} {...this.state.loadedMessages[i]} /> : <Box />
    const loadingRenderer = ({index, style, key, ...rest}) => index === 0 ? (<LoadingMessage style={style} key={key || index} {...rest} />) : rowRenderer({index: index - 1, style, key, ...rest})
    const rowCount = this.state.loadedMessages.length
    const countWithLoading = rowCount + 1
    return (
      <AutoSizer>
        {({height, width}) => (
          <CellMeasurer
            cellRenderer={({rowIndex, ...rest}) => loadingRenderer({index: rowIndex, ...rest})}
            columnCount={1}
            cellSizeCache={this._cellCache}
            ref={r => this._cellMeasurer = r}
            rowCount={countWithLoading}
          >
            {({getRowHeight, }) => (
              <List
                height={height}
                width={width}
                onScroll={this._throttledOnScroll}
                scrollToIndex={this.state.isOnBottom ? this.state.loadedMessages.length : undefined}
                scrollToAlignment={'end'}
                scrollTop={this.state.scrollTop}
                rowCount={countWithLoading}
                rowHeight={getRowHeight}
                rowRenderer={loadingRenderer}
               />
            )}
          </CellMeasurer>
        )}
      </AutoSizer>
    )
  }

  _isRowLoaded ({index}) {
    return this.state.loadedMessages[index] != null
  }


  // Further optimization is to make the CellMeasurer's cache be smarter about prepending things
  render () {
    return (
      <Box style={{flex: 1}}>
        <style>{demoAnimation}</style>
        {false && this.state.loadedMessages.map((m, i) => <ChatMessage key={i} {...m} />)}
        {this._renderWithCellMeasurer()}
      </Box>
    )
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

const chatMessageMap = {
  component: ChatMessage,
  mocks: {
    'Normal': {username: 'marcopolo', messageLengths: [8, 3, 5, 9, 9, 3, 9]},
  },
}

const chatDemo = {
  component: ChatDemo,
  mocks: {
    'Normal': {parentProps: {style: {display: 'flex', flex: 1}}},
  },
}

export default {
  ChatMessage: chatMessageMap,
  ChatDemo: chatDemo,
  ChatClass: ChatDemo,
}
