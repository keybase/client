// @flow
import * as React from 'react'
import * as Constants from '../../constants/chat2'
import {connect, type TypedState} from '../../util/container'
import Normal from './normal/container'
import NoConversation from './no-conversation'
import Error from './error/container'

type SwitchProps = {
  showError: boolean,
  showNoConvo: boolean,
  showRekey: boolean,
}

class Conversation extends React.PureComponent<SwitchProps> {
  render() {
    if (this.showNoConvo) {
      return <NoConversation />
    }
    // if (this.props.showRekey) {
    // return <Rekey />
    // }
    if (this.props.showError) {
      return <Error />
    }
    return <Normal />
  }
}

const mapStateToProps = (state: TypedState): * => {
  const conversationIDKey = Constants.getSelectedConversation(state)

  return {
    showError: conversationIDKey && Constants.getMeta(state, conversationIDKey).trustedState === 'error',
    showNoConvo: !conversationIDKey && !state.chat2.isSearching,
    showRekey: false, // TODO
  }
}

export default connect(mapStateToProps)(Conversation)
