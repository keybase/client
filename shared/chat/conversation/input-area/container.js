// @flow
import * as React from 'react'
import * as Constants from '../../../constants/chat2'
import Normal from './normal/container'
import Preview from './preview/container'
import {connect} from '../../../util/container'
import type {TypedState} from '../../../util/container'

const mapStateToProps = (state: TypedState): * => {
  const selectedConversationIDKey = Constants.getSelectedConversation(state)
  const meta = Constants.getMeta(state, selectedConversationIDKey)
  return {
    isPreview: false, // TODO
    isReset: !meta.resetParticipants.isEmpty(),
  }
}

type Props = {
  isReset: boolean,
  isPreview: boolean,
}
class InputArea extends React.PureComponent<Props> {
  render() {
    if (this.props.isReset) {
      return null
    }
    if (this.props.isPreview) {
      return <Preview />
    }
    return <Normal />
  }
}

export default connect(mapStateToProps)(InputArea)
