// @flow
import * as Constants from '../../../constants/chat2'
import {connect, type TypedState} from '../../../util/container'
import Error from '.'

const mapStateToProps = (state: TypedState): * => {
  const conversationIDKey = Constants.getSelectedConversation(state)
  return {
    text: Constants.getMeta(state, conversationIDKey).snippet,
  }
}

export default connect(mapStateToProps)(Error)
