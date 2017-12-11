// @flow
import * as React from 'react'
import UserInput from '../search/user-input/container'
import {compose, withState, lifecycle} from 'recompose'

const _SearchHeader = props => (
  <UserInput
    autoFocus={true}
    searchKey={'chatSearch'}
    focusInputCounter={props.focusInputCounter}
    placeholder={props.placeholder}
    onExitSearch={props.onExitSearch}
  />
)

const SearchHeader = compose(
  withState('focusInputCounter', 'setFocusInputCounter', 0),
  lifecycle({
    componentWillReceiveProps(nextProps) {
      if (this.props.selectedConversationIDKey !== nextProps.selectedConversationIDKey) {
        nextProps.setFocusInputCounter(n => n + 1)
      }
    },
  })
)(_SearchHeader)

export default SearchHeader
