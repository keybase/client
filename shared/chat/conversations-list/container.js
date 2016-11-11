// @flow
import ConversationList from './index'
import {connect} from 'react-redux'
import {selectConversation} from '../../actions/chat'

import type {ConversationIDKey} from '../../constants/chat'
import type {TypedState} from '../../constants/reducer'

export default connect(
  (state: TypedState) => ({
    inbox: state.chat.get('inbox'),
    selectedConversation: state.chat.get('selectedConversation'),
  }),
  (dispatch: Dispatch) => ({
    onSelectConversation: (key: ConversationIDKey) => dispatch(selectConversation(key)),
  })
)(ConversationList)
