// @flow
//
import React, {Component} from 'react'
import {Text} from '../../common-adapters'
import {NativeListView} from '../../common-adapters/index.native'
import hoc from './list-hoc'
import messageFactory from './messages'

import type {Props} from './list'
import type {ServerMessage} from '../../constants/chat'

type State = {
  dataSource: NativeListView.DataSource,
}

class ConversationList extends Component <void, Props, State> {
  state: State;

  constructor (props: Props) {
    super(props)
    const ds = new NativeListView.DataSource({rowHasChanged: (r1, r2) => r1.key !== r2.key})
    this.state = {
      dataSource: ds.cloneWithRows(props.messages.toArray()),
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

  _onAction = (message: ServerMessage, event: any) => {
    if (this.props.onMessageAction) { this.props.onMessageAction(message) }
  }

  _renderRow = (message, sectionID, rowID) => {
    const isFirstMessage = rowID === 0
    const prevMessage = this.props.messages.get(rowID - 1)
    const isSelected = false
    const isScrolling = false
    const options = this.props.optionsFn(message, prevMessage, isFirstMessage, isSelected, isScrolling, 'key', {}, this._onAction)

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
        dataSource={this.state.dataSource}
        renderRow={this._renderRow}
      />
    )
  }
}

export default hoc(ConversationList)
