// @flow
import * as React from 'react'
import * as Constants from '../constants/chat'
import UserInput from '../search/user-input/container'
import {compose, withState, lifecycle} from 'recompose'

type OwnProps = {
  selectedConversationIDKey: ?Constants.ConversationIDKey,
  onExitSearch: () => void,
}

const _SearchHeader = props => (
  <UserInput
    autoFocus={true}
    searchKey={'chatSearch'}
    focusInputCounter={props.focusInputCounter}
    placeholder={props.placeholder}
    onExitSearch={props.onExitSearch}
  />
)

const SearchHeader: Class<React.Component<OwnProps, void>> = compose(
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
